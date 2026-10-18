use tauri::State;

use crate::csv_sanitize::csv_quote;
use crate::db::queries::analyses::get_latest_analysis_for_brand;
use crate::db::queries::audiences::{get_audience_by_id, get_audience_members};
use crate::db::queries::brands::get_all_brands;
use crate::db::queries::influencers::get_all_influencers;
use crate::AppState;

/// Export brand analysis to CSV format
#[tauri::command]
pub fn export_analysis_csv(
    state: State<'_, AppState>,
    brand_id: String,
) -> Result<String, String> {
    let analysis = state
        .db
        .with_conn(|conn| get_latest_analysis_for_brand(conn, &brand_id))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No analysis found for this brand".to_string())?;

    let mut csv = String::new();

    // Header
    csv.push_str("Category,Field,Value\n");

    // Basic info
    csv.push_str(&format!("Analysis,Brand ID,{}\n", csv_quote(&analysis.brand_id)));
    csv.push_str(&format!("Analysis,Analyzed At,{}\n", csv_quote(&analysis.created_at)));
    csv.push_str(&format!("Analysis,Posts Analyzed,{}\n", analysis.post_count));

    // Parse the analysis data JSON
    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&analysis.analysis_data) {
        // Overall sentiment
        if let Some(sentiment) = data.get("overallSentiment") {
            if let Some(score) = sentiment.get("score") {
                csv.push_str(&format!("Sentiment,Overall Score,{}\n", score));
            }
            if let Some(label) = sentiment.get("label") {
                csv.push_str(&format!("Sentiment,Label,{}\n", csv_quote(label.as_str().unwrap_or(""))));
            }
        }

        // Key themes
        if let Some(themes) = data.get("keyThemes").and_then(|t| t.as_array()) {
            for (i, theme) in themes.iter().enumerate() {
                if let Some(name) = theme.get("name") {
                    csv.push_str(&format!("Theme {},Name,{}\n", i + 1, csv_quote(name.as_str().unwrap_or(""))));
                }
                if let Some(sentiment) = theme.get("sentiment") {
                    csv.push_str(&format!("Theme {},Sentiment,{}\n", i + 1, csv_quote(sentiment.as_str().unwrap_or(""))));
                }
                if let Some(count) = theme.get("mentionCount") {
                    csv.push_str(&format!("Theme {},Mentions,{}\n", i + 1, count));
                }
            }
        }

        // Top posts
        if let Some(posts) = data.get("topPosts").and_then(|p| p.as_array()) {
            for (i, post) in posts.iter().enumerate() {
                if let Some(title) = post.get("title") {
                    csv.push_str(&format!("Top Post {},Title,{}\n", i + 1, csv_quote(title.as_str().unwrap_or(""))));
                }
                if let Some(score) = post.get("score") {
                    csv.push_str(&format!("Top Post {},Score,{}\n", i + 1, score));
                }
                if let Some(subreddit) = post.get("subreddit") {
                    csv.push_str(&format!("Top Post {},Subreddit,{}\n", i + 1, csv_quote(subreddit.as_str().unwrap_or(""))));
                }
            }
        }
    }

    Ok(csv)
}

/// Export all influencers to CSV format
#[tauri::command]
pub fn export_influencers_csv(state: State<'_, AppState>) -> Result<String, String> {
    let influencers = state
        .db
        .with_conn(|conn| get_all_influencers(conn))
        .map_err(|e| e.to_string())?;

    let mut csv = String::new();

    // Header
    csv.push_str("Username,Tier,Total Karma,Post Count,Avg Score,Engagement Rate,Expertise Tags,Created At,Reddit Profile\n");

    for inf in influencers {
        let tags = inf.expertise_tags.join("; ");

        csv.push_str(&format!(
            "{},{},{},{},{:.1},{:.2},{},{},{}\n",
            csv_quote(&inf.username),
            csv_quote(&inf.tier),
            inf.total_karma,
            inf.post_count,
            inf.avg_score,
            inf.engagement_rate,
            csv_quote(&tags),
            csv_quote(&inf.created_at),
            csv_quote(&format!("https://reddit.com/user/{}", inf.username))
        ));
    }

    Ok(csv)
}

/// Export audience members to CSV format
#[tauri::command]
pub fn export_audience_csv(
    state: State<'_, AppState>,
    audience_id: String,
) -> Result<String, String> {
    let audience = state
        .db
        .with_conn(|conn| get_audience_by_id(conn, &audience_id))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Audience not found".to_string())?;

    let members = state
        .db
        .with_conn(|conn| get_audience_members(conn, &audience_id))
        .map_err(|e| e.to_string())?;

    let mut csv = String::new();

    // Audience info header
    csv.push_str(&format!("# Audience: {}\n", audience.name));
    if let Some(desc) = &audience.description {
        csv.push_str(&format!("# Description: {}\n", desc));
    }
    csv.push_str(&format!("# Total Members: {}\n", audience.member_count));
    csv.push_str("#\n");

    // Data header
    csv.push_str("Username,Total Karma,Post Count,Avg Score,Added At,Reddit Profile\n");

    for member in members {
        csv.push_str(&format!(
            "{},{},{},{:.1},{},{}\n",
            csv_quote(&member.username),
            member.total_karma,
            member.post_count,
            member.avg_score,
            csv_quote(&member.added_at),
            csv_quote(&format!("https://reddit.com/user/{}", member.username))
        ));
    }

    Ok(csv)
}

/// Export all brands summary to CSV
#[tauri::command]
pub fn export_brands_summary_csv(state: State<'_, AppState>) -> Result<String, String> {
    let brands = state
        .db
        .with_conn(|conn| get_all_brands(conn))
        .map_err(|e| e.to_string())?;

    let mut csv = String::new();

    // Header
    csv.push_str("Brand Name,Industry,Description,Website,Created At,Updated At\n");

    for brand in brands {
        csv.push_str(&format!(
            "{},{},{},{},{},{}\n",
            csv_quote(&brand.name),
            csv_quote(&brand.industry),
            csv_quote(&brand.description.unwrap_or_default()),
            csv_quote(&brand.website.unwrap_or_default()),
            csv_quote(&brand.created_at),
            csv_quote(&brand.updated_at)
        ));
    }

    Ok(csv)
}
