use std::sync::Arc;

use reqwest::Client;
use tokio_util::sync::CancellationToken;

use crate::analysis::{ClaudeClient, OpenAIClient};
use crate::background::JobRegistry;
use crate::db::queries::{analyses::SaveAnalysisInput, jobs as job_queries, settings::load_settings};
use crate::db::Database;
use crate::models::JobStatus;
use crate::proxy::ProxyPool;
use crate::scraper::RedditScraper;
use crate::serper::SerperClient;

/// Run brand analysis in the background
pub async fn run_brand_analysis(db: Arc<Database>, http_client: Client, cancel_token: CancellationToken, job_registry: Arc<JobRegistry>, job_id: String, brand_id: String, brand_name: String) {
    // Helper to update job progress
    let update_progress = |progress: i32| {
        let db_ref = db.clone();
        let job_id_ref = job_id.clone();
        async move {
            let _ = db_ref.with_conn(|conn| job_queries::update_job_progress(conn, &job_id_ref, progress));
        }
    };

    // Helper to fail job
    let fail_job = |error: String| {
        let db_ref = db.clone();
        let job_id_ref = job_id.clone();
        async move {
            let _ = db_ref.with_conn(|conn| job_queries::fail_job(conn, &job_id_ref, &error));
        }
    };

    // Set job to running
    if let Err(e) = db.with_conn(|conn| job_queries::update_job_status(conn, &job_id, JobStatus::Running)) {
        eprintln!("Failed to update job status: {}", e);
        return;
    }

    update_progress(5).await;

    // Load settings
    let settings = match db.with_conn(|conn| load_settings(conn)) {
        Ok(s) => s,
        Err(e) => {
            fail_job(format!("Failed to load settings: {}", e)).await;
            return;
        }
    };

    // Validate API keys
    if settings.serper_api_key.is_empty() {
        fail_job("Serper API key not configured. Please add it in Settings.".to_string()).await;
        return;
    }

    let use_claude = settings.ai_provider == "claude";
    if use_claude {
        if settings.claude_api_key.is_empty() {
            fail_job("Claude API key not configured. Please add it in Settings.".to_string()).await;
            return;
        }
    } else if settings.openai_api_key.is_empty() {
        fail_job("OpenAI API key not configured. Please add it in Settings.".to_string()).await;
        return;
    }

    update_progress(10).await;

    if cancel_token.is_cancelled() {
        fail_job("Job cancelled".to_string()).await;
        return;
    }

    // Step 1: Search Reddit
    let proxy_pool = ProxyPool::from_settings(&settings.proxy);
    let serper_client = if proxy_pool.is_configured() {
        match SerperClient::with_proxy(settings.serper_api_key.clone(), &proxy_pool) {
            Ok(c) => c,
            Err(e) => {
                fail_job(format!("Failed to create search client: {}", e)).await;
                return;
            }
        }
    } else {
        match SerperClient::with_client(http_client.clone(), settings.serper_api_key.clone()) {
            Ok(c) => c,
            Err(e) => {
                fail_job(format!("Failed to create search client: {}", e)).await;
                return;
            }
        }
    };

    let max_mentions = settings.analysis.max_mentions_per_brand.max(1) as u32;
    let max_subreddits = settings.analysis.max_subreddits.max(1) as u32;
    let confidence_threshold = settings.analysis.sentiment_confidence_threshold as f64 / 100.0;

    // Search Reddit - first do a general search
    let per_search = (max_mentions / 2).max(5);
    let mut all_results = match serper_client.search_reddit(&brand_name, Some(per_search)).await {
        Ok(r) => r,
        Err(e) => {
            fail_job(format!("Reddit search failed: {}", e)).await;
            return;
        }
    };

    // Collect unique subreddits from initial results for targeted searches
    let mut seen_subreddits: Vec<String> = Vec::new();
    for r in &all_results {
        if let Some(sub) = extract_subreddit(&r.url) {
            if !seen_subreddits.contains(&sub) {
                seen_subreddits.push(sub);
            }
        }
    }

    // Search in discovered subreddits (up to max_subreddits)
    let remaining = max_mentions.saturating_sub(all_results.len() as u32);
    if remaining > 0 && !seen_subreddits.is_empty() {
        let subs_to_search = seen_subreddits.iter().take(max_subreddits as usize);
        let per_sub = (remaining / seen_subreddits.len().min(max_subreddits as usize) as u32).max(3);

        for sub in subs_to_search {
            if cancel_token.is_cancelled() {
                fail_job("Job cancelled".to_string()).await;
                return;
            }
            if let Ok(sub_results) = serper_client.search_subreddit(&brand_name, sub, Some(per_sub)).await {
                for r in sub_results {
                    if !all_results.iter().any(|existing| existing.url == r.url) {
                        all_results.push(r);
                    }
                }
            }
        }
    }

    // Trim to max_mentions
    all_results.truncate(max_mentions as usize);

    if all_results.is_empty() {
        fail_job("No Reddit posts found for this brand".to_string()).await;
        return;
    }

    update_progress(30).await;

    if cancel_token.is_cancelled() {
        fail_job("Job cancelled".to_string()).await;
        return;
    }

    // Step 2: Scrape posts
    let scraper = if proxy_pool.is_configured() {
        match RedditScraper::with_proxy(&proxy_pool) {
            Ok(s) => s,
            Err(e) => {
                fail_job(format!("Failed to create scraper: {}", e)).await;
                return;
            }
        }
    } else {
        RedditScraper::with_client(http_client.clone())
    };

    let urls: Vec<String> = all_results.iter().map(|r| r.url.clone()).collect();
    let scrape_results = scraper.fetch_posts(&urls).await;

    let successful_posts: Vec<_> = scrape_results
        .into_iter()
        .filter_map(|r| r.ok())
        .collect();

    if successful_posts.is_empty() {
        fail_job("Failed to scrape any Reddit posts".to_string()).await;
        return;
    }

    update_progress(50).await;

    if cancel_token.is_cancelled() {
        fail_job("Job cancelled".to_string()).await;
        return;
    }

    // Step 3: Analyze with AI provider
    update_progress(60).await;

    let analysis = if use_claude {
        let client = match ClaudeClient::with_client(http_client.clone(), settings.claude_api_key.clone()) {
            Ok(c) => c,
            Err(e) => {
                fail_job(format!("Failed to create Claude client: {}", e)).await;
                return;
            }
        };
        match client.analyze_brand_mentions(&brand_name, &successful_posts).await {
            Ok(a) => a,
            Err(e) => {
                fail_job(format!("AI analysis failed: {}", e)).await;
                return;
            }
        }
    } else {
        let client = match OpenAIClient::with_client(http_client.clone(), settings.openai_api_key.clone()) {
            Ok(c) => c,
            Err(e) => {
                fail_job(format!("Failed to create OpenAI client: {}", e)).await;
                return;
            }
        };
        match client.analyze_brand_mentions(&brand_name, &successful_posts).await {
            Ok(a) => a,
            Err(e) => {
                fail_job(format!("AI analysis failed: {}", e)).await;
                return;
            }
        }
    };

    // Apply sentiment confidence threshold - filter out low-confidence mentions
    let mut analysis = analysis;
    if confidence_threshold > 0.0 {
        analysis.mention_analyses.retain(|m| m.sentiment.confidence >= confidence_threshold);
    }

    update_progress(85).await;

    if cancel_token.is_cancelled() {
        fail_job("Job cancelled".to_string()).await;
        return;
    }

    // Step 4: Save to database
    let analysis_json = match serde_json::to_string(&analysis) {
        Ok(j) => j,
        Err(e) => {
            fail_job(format!("Failed to serialize analysis: {}", e)).await;
            return;
        }
    };

    let posts_json = match serde_json::to_string(&successful_posts) {
        Ok(j) => j,
        Err(e) => {
            fail_job(format!("Failed to serialize posts: {}", e)).await;
            return;
        }
    };

    let save_input = SaveAnalysisInput {
        brand_id: brand_id.clone(),
        analysis_data: analysis_json,
        posts_data: posts_json,
        post_count: successful_posts.len() as i32,
        overall_sentiment_score: analysis.overall_sentiment.score,
        overall_sentiment_label: analysis.overall_sentiment.label,
    };

    if let Err(e) = db.with_conn(|conn| crate::db::queries::analyses::save_analysis(conn, &save_input)) {
        fail_job(format!("Failed to save analysis: {}", e)).await;
        return;
    }

    update_progress(100).await;

    // Mark job as completed
    let _ = db.with_conn(|conn| job_queries::update_job_status(conn, &job_id, JobStatus::Completed));

    // Remove from registry so the token can be freed
    job_registry.remove(&job_id);
}

/// Extract subreddit name from a Reddit URL
fn extract_subreddit(url: &str) -> Option<String> {
    // Match patterns like reddit.com/r/subreddit
    let url_lower = url.to_lowercase();
    if let Some(idx) = url_lower.find("/r/") {
        let rest = &url[idx + 3..];
        let end = rest.find('/').unwrap_or(rest.len());
        let sub = &rest[..end];
        if !sub.is_empty() {
            return Some(sub.to_string());
        }
    }
    None
}
