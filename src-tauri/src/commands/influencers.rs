use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::queries::influencers::{
    self as influencer_queries,
    calculate_tier, create_or_update_author_subreddit, create_or_update_influencer,
    get_all_influencers, get_or_create_author, link_influencer_brand,
    delete_influencer, DiscoveredInfluencer, InfluencerWithAuthor,
};
use crate::db::queries::analyses::BrandAnalysisRecord;
use crate::scraper::RedditPost;
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverInfluencersResult {
    pub discovered: Vec<DiscoveredInfluencer>,
    pub saved_count: i32,
}

#[tauri::command]
pub fn discover_influencers(
    state: State<'_, AppState>,
) -> Result<DiscoverInfluencersResult, String> {
    // Get all brand analyses to extract authors from posts
    let analyses = state
        .db
        .with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, brand_id, analysis_data, posts_data, post_count, overall_sentiment_score, overall_sentiment_label, created_at FROM brand_analyses"
            )?;

            let rows = stmt.query_map([], |row| {
                Ok(BrandAnalysisRecord {
                    id: row.get(0)?,
                    brand_id: row.get(1)?,
                    analysis_data: row.get(2)?,
                    posts_data: row.get(3)?,
                    post_count: row.get(4)?,
                    overall_sentiment_score: row.get(5)?,
                    overall_sentiment_label: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })?;

            rows.collect::<rusqlite::Result<Vec<_>>>()
        })
        .map_err(|e| e.to_string())?;

    // Aggregate author stats across all posts
    let mut author_stats: HashMap<String, AuthorStats> = HashMap::new();

    for analysis in &analyses {
        let posts: Vec<RedditPost> = serde_json::from_str(&analysis.posts_data).unwrap_or_default();

        for post in posts {
            let stats = author_stats.entry(post.author.clone()).or_insert(AuthorStats {
                username: post.author.clone(),
                post_count: 0,
                total_score: 0,
                total_comments: 0,
                subreddits: Vec::new(),
                subreddit_stats: HashMap::new(),
                brand_mentions: HashMap::new(),
            });

            stats.post_count += 1;
            stats.total_score += post.score;
            stats.total_comments += post.num_comments;

            // Track which brand this post was from
            *stats.brand_mentions.entry(analysis.brand_id.clone()).or_insert(0) += 1;

            if !stats.subreddits.contains(&post.subreddit) {
                stats.subreddits.push(post.subreddit.clone());
            }

            let sub_stats = stats.subreddit_stats.entry(post.subreddit.clone()).or_insert((0, 0));
            sub_stats.0 += 1; // post_count
            sub_stats.1 += post.score; // total_score
        }
    }

    // Filter out deleted/bot users and create influencers
    let mut discovered: Vec<DiscoveredInfluencer> = Vec::new();
    let mut saved_count = 0;

    for (username, stats) in author_stats {
        // Skip deleted users and common bots
        if username == "[deleted]"
            || username.to_lowercase().contains("bot")
            || username == "AutoModerator"
        {
            continue;
        }

        let avg_score = if stats.post_count > 0 {
            stats.total_score as f64 / stats.post_count as f64
        } else {
            0.0
        };

        // Include users with at least 1 post (lowered from avg_score >= 5.0)
        if stats.post_count >= 1 {
            let tier = calculate_tier(avg_score, stats.post_count);

            // Save to database
            let brand_mentions = stats.brand_mentions.clone();
            let result = state.db.with_conn(|conn| {
                let author = get_or_create_author(
                    conn,
                    &username,
                    stats.total_score,
                    stats.post_count,
                    avg_score,
                )?;

                // Populate author_subreddits junction table
                for (sub_name, (sub_posts, sub_score)) in &stats.subreddit_stats {
                    let _ = create_or_update_author_subreddit(
                        conn,
                        &author.id,
                        sub_name,
                        *sub_posts,
                        *sub_score,
                    );
                }

                let engagement_rate = if stats.total_comments > 0 {
                    (stats.total_score as f64) / (stats.total_comments as f64)
                } else {
                    avg_score
                };

                let influencer = create_or_update_influencer(
                    conn,
                    &author.id,
                    &tier,
                    &stats.subreddits,
                    engagement_rate,
                )?;

                // Link influencer to brands
                for (brand_id, count) in &brand_mentions {
                    let _ = link_influencer_brand(conn, &influencer.id, brand_id, *count);
                }

                Ok(influencer)
            });

            if result.is_ok() {
                saved_count += 1;
            }

            discovered.push(DiscoveredInfluencer {
                username,
                post_count: stats.post_count,
                total_score: stats.total_score,
                avg_score,
                total_comments: stats.total_comments,
                subreddits: stats.subreddits,
                sentiment: "neutral".to_string(),
            });
        }
    }

    // Sort by avg_score descending
    discovered.sort_by(|a, b| b.avg_score.partial_cmp(&a.avg_score).unwrap_or(std::cmp::Ordering::Equal));

    Ok(DiscoverInfluencersResult {
        discovered,
        saved_count,
    })
}

#[tauri::command]
pub fn get_influencers(
    state: State<'_, AppState>,
) -> Result<Vec<InfluencerWithAuthor>, String> {
    state
        .db
        .with_conn(|conn| get_all_influencers(conn))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_influencer(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    state
        .db
        .with_conn(|conn| delete_influencer(conn, &id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_all_influencers(
    state: State<'_, AppState>,
) -> Result<usize, String> {
    state
        .db
        .with_conn(|conn| influencer_queries::delete_all_influencers(conn))
        .map_err(|e| e.to_string())
}

#[derive(Debug)]
#[allow(dead_code)]
struct AuthorStats {
    username: String,
    post_count: i32,
    total_score: i32,
    total_comments: i32,
    subreddits: Vec<String>,
    subreddit_stats: HashMap<String, (i32, i32)>, // subreddit -> (post_count, total_score)
    brand_mentions: HashMap<String, i32>,          // brand_id -> mention_count
}
