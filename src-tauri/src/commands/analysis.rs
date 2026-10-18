use serde::{Deserialize, Serialize};
use tauri::State;

use crate::analysis::{BrandAnalysisResult, ClaudeClient, OpenAIClient};
use crate::db::queries::analyses::{BrandAnalysisRecord, BrandAnalysisSummary, SaveAnalysisInput, SentimentTrendPoint};
use crate::db::queries::jobs as job_queries;
use crate::models::{CreateJobInput, JobType};
use crate::retry::{with_retry, RetryConfig};
use crate::scraper::RedditPost;
use crate::AppState;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeBrandInput {
    pub brand_name: String,
    pub posts: Vec<RedditPost>,
}

#[tauri::command]
pub async fn analyze_brand_mentions(
    state: State<'_, AppState>,
    input: AnalyzeBrandInput,
) -> Result<BrandAnalysisResult, String> {
    let settings = state
        .db
        .with_conn(|conn| crate::db::queries::settings::load_settings(conn))
        .map_err(|e| e.to_string())?;

    if settings.ai_provider == "claude" {
        let api_key = settings.claude_api_key;
        if api_key.is_empty() {
            return Err("Claude API key not configured. Please add it in Settings.".to_string());
        }
        let client = ClaudeClient::with_client(state.http_client.clone(), api_key).map_err(|e| e.to_string())?;
        client
            .analyze_brand_mentions(&input.brand_name, &input.posts)
            .await
            .map_err(|e| e.to_string())
    } else {
        let api_key = settings.openai_api_key;
        if api_key.is_empty() {
            return Err("OpenAI API key not configured. Please add it in Settings.".to_string());
        }
        let client = OpenAIClient::with_client(state.http_client.clone(), api_key).map_err(|e| e.to_string())?;
        client
            .analyze_brand_mentions(&input.brand_name, &input.posts)
            .await
            .map_err(|e| e.to_string())
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAnalysisCommandInput {
    pub brand_id: String,
    pub analysis: BrandAnalysisResult,
    pub posts: Vec<RedditPost>,
}

#[tauri::command]
pub fn save_brand_analysis(
    state: State<'_, AppState>,
    input: SaveAnalysisCommandInput,
) -> Result<BrandAnalysisRecord, String> {
    let analysis_json = serde_json::to_string(&input.analysis).map_err(|e| e.to_string())?;
    let posts_json = serde_json::to_string(&input.posts).map_err(|e| e.to_string())?;

    let save_input = SaveAnalysisInput {
        brand_id: input.brand_id,
        analysis_data: analysis_json,
        posts_data: posts_json,
        post_count: input.posts.len() as i32,
        overall_sentiment_score: input.analysis.overall_sentiment.score,
        overall_sentiment_label: input.analysis.overall_sentiment.label.clone(),
    };

    state
        .db
        .with_conn(|conn| crate::db::queries::analyses::save_analysis(conn, &save_input))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_latest_brand_analysis(
    state: State<'_, AppState>,
    brand_id: String,
) -> Result<Option<BrandAnalysisRecord>, String> {
    state
        .db
        .with_conn(|conn| crate::db::queries::analyses::get_latest_analysis_for_brand(conn, &brand_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_brand_analysis_history(
    state: State<'_, AppState>,
    brand_id: String,
) -> Result<Vec<BrandAnalysisRecord>, String> {
    state
        .db
        .with_conn(|conn| crate::db::queries::analyses::get_all_analyses_for_brand(conn, &brand_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_brand_analysis(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    state
        .db
        .with_conn(|conn| crate::db::queries::analyses::delete_analysis(conn, &id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_sentiment_trend(
    state: State<'_, AppState>,
    brand_id: String,
    limit: Option<i32>,
) -> Result<Vec<SentimentTrendPoint>, String> {
    let limit = limit.unwrap_or(30);
    state
        .db
        .with_conn(|conn| crate::db::queries::analyses::get_sentiment_trend(conn, &brand_id, limit))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_brand_analysis_summaries(
    state: State<'_, AppState>,
) -> Result<Vec<BrandAnalysisSummary>, String> {
    state
        .db
        .with_conn(|conn| crate::db::queries::analyses::get_all_brand_analysis_summaries(conn))
        .map_err(|e| e.to_string())
}

/// Input for starting background analysis
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartBackgroundAnalysisInput {
    pub brand_id: String,
}

/// Response from starting background analysis
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartBackgroundAnalysisResponse {
    pub job_id: String,
}

/// Start a background analysis job that continues even when navigating away
#[tauri::command]
pub fn start_background_analysis(
    state: State<'_, AppState>,
    input: StartBackgroundAnalysisInput,
) -> Result<StartBackgroundAnalysisResponse, String> {
    // Load settings to check concurrency limit
    let settings = state
        .db
        .with_conn(|conn| crate::db::queries::settings::load_settings(conn))
        .map_err(|e| e.to_string())?;

    // Enforce max concurrent jobs
    let running_count = state
        .db
        .with_conn(|conn| job_queries::count_running_jobs(conn))
        .map_err(|e| e.to_string())?;

    if running_count >= settings.jobs.max_concurrent {
        return Err(format!(
            "Maximum concurrent jobs reached ({}). Wait for a running job to finish or increase the limit in Settings.",
            settings.jobs.max_concurrent
        ));
    }

    // Get the brand to validate it exists and get the name
    let brand = state
        .db
        .with_conn(|conn| crate::db::queries::brands::get_brand(conn, &input.brand_id))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Brand not found".to_string())?;

    // Create a job record
    let job_input = CreateJobInput {
        job_type: JobType::BrandAnalysis,
        brand_id: Some(input.brand_id.clone()),
    };

    let job = state
        .db
        .with_conn(|conn| job_queries::create_job(conn, &job_input))
        .map_err(|e| e.to_string())?;

    let job_id = job.id.clone();

    // Register the job for cancellation support
    let cancel_token = state.job_registry.register(&job_id);

    // Clone shared resources to move into the spawned task
    let db = state.db.clone();
    let http_client = state.http_client.clone();
    let job_registry = state.job_registry.clone();
    let brand_id = input.brand_id;
    let brand_name = brand.name;
    let spawned_job_id = job_id.clone();
    let timeout_minutes = settings.jobs.timeout_minutes.max(1) as u64;

    // Spawn the background task with timeout
    tauri::async_runtime::spawn(async move {
        let analysis_future = crate::background::run_brand_analysis(
            db.clone(), http_client, cancel_token, job_registry.clone(),
            spawned_job_id.clone(), brand_id, brand_name,
        );

        match tokio::time::timeout(
            std::time::Duration::from_secs(timeout_minutes * 60),
            analysis_future,
        ).await {
            Ok(()) => {} // completed normally
            Err(_) => {
                // Timed out
                let _ = db.with_conn(|conn| job_queries::fail_job(
                    conn, &spawned_job_id, &format!("Job timed out after {} minutes", timeout_minutes),
                ));
                job_registry.remove(&spawned_job_id);
            }
        }
    });

    Ok(StartBackgroundAnalysisResponse { job_id: job.id })
}

/// Response from brand autofill
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutofillBrandResponse {
    pub industry: String,
    pub description: String,
}

/// Use AI to auto-fill industry and description for a brand name
#[tauri::command]
pub async fn autofill_brand(
    state: State<'_, AppState>,
    brand_name: String,
) -> Result<AutofillBrandResponse, String> {
    let settings = state
        .db
        .with_conn(|conn| crate::db::queries::settings::load_settings(conn))
        .map_err(|e| e.to_string())?;

    let system_prompt = "You are a brand research assistant. Given a brand name, respond with a JSON object containing \"industry\" (a short industry category, e.g. \"Technology\", \"Automotive\", \"Consumer Electronics\") and \"description\" (a concise 1-2 sentence description of the brand). Respond ONLY with valid JSON, no markdown.";
    let user_prompt = format!("Brand: {}", brand_name);

    let text = if settings.ai_provider == "claude" {
        let api_key = settings.claude_api_key;
        if api_key.is_empty() {
            return Err("Claude API key not configured. Please add it in Settings.".to_string());
        }

        #[derive(Serialize)]
        struct ClaudeMsg {
            role: String,
            content: String,
        }
        #[derive(Serialize)]
        struct ClaudeReq {
            model: String,
            max_tokens: u32,
            system: String,
            messages: Vec<ClaudeMsg>,
        }
        #[derive(Deserialize)]
        struct ClaudeContent {
            text: String,
        }
        #[derive(Deserialize)]
        struct ClaudeResp {
            content: Vec<ClaudeContent>,
        }

        let request = ClaudeReq {
            model: "claude-sonnet-4-20250514".to_string(),
            max_tokens: 256,
            system: system_prompt.to_string(),
            messages: vec![ClaudeMsg {
                role: "user".to_string(),
                content: user_prompt,
            }],
        };

        let retry_config = RetryConfig::default();
        let response = with_retry(&retry_config, || {
            state
                .http_client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
        })
        .await
        .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Claude API error {}: {}", status, body));
        }

        let resp: ClaudeResp = response.json().await.map_err(|e| e.to_string())?;
        resp.content
            .first()
            .map(|c| c.text.clone())
            .unwrap_or_default()
    } else {
        let api_key = settings.openai_api_key;
        if api_key.is_empty() {
            return Err("OpenAI API key not configured. Please add it in Settings.".to_string());
        }

        #[derive(Serialize)]
        struct Msg {
            role: String,
            content: String,
        }
        #[derive(Serialize)]
        struct Req {
            model: String,
            messages: Vec<Msg>,
            max_tokens: u32,
            temperature: f32,
        }
        #[derive(Deserialize)]
        struct Choice {
            message: MsgResp,
        }
        #[derive(Deserialize)]
        struct MsgResp {
            content: String,
        }
        #[derive(Deserialize)]
        struct Resp {
            choices: Vec<Choice>,
        }

        let request = Req {
            model: "gpt-5.1-mini".to_string(),
            max_tokens: 256,
            temperature: 0.3,
            messages: vec![
                Msg {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                Msg {
                    role: "user".to_string(),
                    content: user_prompt,
                },
            ],
        };

        let retry_config = RetryConfig::default();
        let response = with_retry(&retry_config, || {
            state
                .http_client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
        })
        .await
        .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI API error {}: {}", status, body));
        }

        let resp: Resp = response.json().await.map_err(|e| e.to_string())?;
        resp.choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default()
    };

    // Parse the JSON response
    let text = text.trim();
    // Strip markdown code fences if present
    let text = text
        .strip_prefix("```json")
        .or_else(|| text.strip_prefix("```"))
        .unwrap_or(text);
    let text = text.strip_suffix("```").unwrap_or(text).trim();

    #[derive(Deserialize)]
    struct AutofillJson {
        industry: String,
        description: String,
    }

    let parsed: AutofillJson =
        serde_json::from_str(text).map_err(|e| format!("Failed to parse AI response: {}", e))?;

    Ok(AutofillBrandResponse {
        industry: parsed.industry,
        description: parsed.description,
    })
}

/// Response from audience autofill
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutofillAudienceResponse {
    pub name: String,
    pub description: String,
    pub min_karma: Option<i32>,
    pub min_posts: Option<i32>,
    pub tiers: Vec<String>,
}

/// Use AI to auto-fill audience details, optionally based on a brand
#[tauri::command]
pub async fn autofill_audience(
    state: State<'_, AppState>,
    brand_name: Option<String>,
) -> Result<AutofillAudienceResponse, String> {
    let settings = state
        .db
        .with_conn(|conn| crate::db::queries::settings::load_settings(conn))
        .map_err(|e| e.to_string())?;

    let system_prompt = "You are an audience research assistant for Reddit. Given a request, respond with a JSON object containing: \"name\" (a short audience segment name, e.g. \"Tech Early Adopters\", \"Gaming Enthusiasts\"), \"description\" (1-2 sentence description of this audience), \"minKarma\" (suggested minimum karma as integer or null), \"minPosts\" (suggested minimum post count as integer or null), \"tiers\" (array of influencer tiers from [\"mega\",\"macro\",\"micro\",\"nano\"], pick 1-3 relevant tiers). Respond ONLY with valid JSON, no markdown.";

    let user_prompt = match &brand_name {
        Some(name) => format!(
            "Suggest a Reddit audience segment for the brand \"{}\". The audience should be people who would discuss or be interested in this brand on Reddit.",
            name
        ),
        None => "Suggest a creative Reddit audience segment. Pick an interesting niche community of Reddit users.".to_string(),
    };

    let text = if settings.ai_provider == "claude" {
        let api_key = settings.claude_api_key;
        if api_key.is_empty() {
            return Err("Claude API key not configured. Please add it in Settings.".to_string());
        }

        #[derive(Serialize)]
        struct ClaudeMsg {
            role: String,
            content: String,
        }
        #[derive(Serialize)]
        struct ClaudeReq {
            model: String,
            max_tokens: u32,
            system: String,
            messages: Vec<ClaudeMsg>,
        }
        #[derive(Deserialize)]
        struct ClaudeContent {
            text: String,
        }
        #[derive(Deserialize)]
        struct ClaudeResp {
            content: Vec<ClaudeContent>,
        }

        let request = ClaudeReq {
            model: "claude-sonnet-4-20250514".to_string(),
            max_tokens: 300,
            system: system_prompt.to_string(),
            messages: vec![ClaudeMsg {
                role: "user".to_string(),
                content: user_prompt,
            }],
        };

        let retry_config = RetryConfig::default();
        let response = with_retry(&retry_config, || {
            state
                .http_client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
        })
        .await
        .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Claude API error {}: {}", status, body));
        }

        let resp: ClaudeResp = response.json().await.map_err(|e| e.to_string())?;
        resp.content
            .first()
            .map(|c| c.text.clone())
            .unwrap_or_default()
    } else {
        let api_key = settings.openai_api_key;
        if api_key.is_empty() {
            return Err("OpenAI API key not configured. Please add it in Settings.".to_string());
        }

        #[derive(Serialize)]
        struct Msg {
            role: String,
            content: String,
        }
        #[derive(Serialize)]
        struct Req {
            model: String,
            messages: Vec<Msg>,
            max_tokens: u32,
            temperature: f32,
        }
        #[derive(Deserialize)]
        struct Choice {
            message: MsgResp,
        }
        #[derive(Deserialize)]
        struct MsgResp {
            content: String,
        }
        #[derive(Deserialize)]
        struct Resp {
            choices: Vec<Choice>,
        }

        let request = Req {
            model: "gpt-5.1-mini".to_string(),
            max_tokens: 300,
            temperature: 0.7,
            messages: vec![
                Msg {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                Msg {
                    role: "user".to_string(),
                    content: user_prompt,
                },
            ],
        };

        let retry_config = RetryConfig::default();
        let response = with_retry(&retry_config, || {
            state
                .http_client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
        })
        .await
        .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI API error {}: {}", status, body));
        }

        let resp: Resp = response.json().await.map_err(|e| e.to_string())?;
        resp.choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default()
    };

    let text = text.trim();
    let text = text
        .strip_prefix("```json")
        .or_else(|| text.strip_prefix("```"))
        .unwrap_or(text);
    let text = text.strip_suffix("```").unwrap_or(text).trim();

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct AutofillJson {
        name: String,
        description: String,
        min_karma: Option<i32>,
        min_posts: Option<i32>,
        tiers: Vec<String>,
    }

    let parsed: AutofillJson =
        serde_json::from_str(text).map_err(|e| format!("Failed to parse AI response: {}", e))?;

    // Validate tiers
    let valid_tiers: Vec<String> = parsed
        .tiers
        .into_iter()
        .filter(|t| ["mega", "macro", "micro", "nano"].contains(&t.as_str()))
        .collect();

    Ok(AutofillAudienceResponse {
        name: parsed.name,
        description: parsed.description,
        min_karma: parsed.min_karma,
        min_posts: parsed.min_posts,
        tiers: valid_tiers,
    })
}
