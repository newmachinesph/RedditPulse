use serde::{Deserialize, Serialize};
use tauri::State;

use crate::proxy::ProxyPool;
use crate::scraper::{RedditPost, RedditScraper};
use crate::AppState;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrapePostInput {
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrapePostsInput {
    pub urls: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrapePostResult {
    pub url: String,
    pub success: bool,
    pub post: Option<RedditPost>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn scrape_reddit_post(
    state: State<'_, AppState>,
    input: ScrapePostInput,
) -> Result<RedditPost, String> {
    let settings = state
        .db
        .with_conn(|conn| crate::db::queries::settings::load_settings(conn))
        .map_err(|e| e.to_string())?;

    let proxy_pool = ProxyPool::from_settings(&settings.proxy);
    let scraper = if proxy_pool.is_configured() {
        RedditScraper::with_proxy(&proxy_pool).map_err(|e| e.to_string())?
    } else {
        RedditScraper::with_client(state.http_client.clone())
    };

    scraper
        .fetch_post(&input.url)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scrape_reddit_posts(
    state: State<'_, AppState>,
    input: ScrapePostsInput,
) -> Result<Vec<ScrapePostResult>, String> {
    let settings = state
        .db
        .with_conn(|conn| crate::db::queries::settings::load_settings(conn))
        .map_err(|e| e.to_string())?;

    let proxy_pool = ProxyPool::from_settings(&settings.proxy);
    let scraper = if proxy_pool.is_configured() {
        RedditScraper::with_proxy(&proxy_pool).map_err(|e| e.to_string())?
    } else {
        RedditScraper::with_client(state.http_client.clone())
    };

    let results = scraper.fetch_posts(&input.urls).await;

    Ok(results
        .into_iter()
        .zip(input.urls.iter())
        .map(|(result, url)| match result {
            Ok(post) => ScrapePostResult {
                url: url.clone(),
                success: true,
                post: Some(post),
                error: None,
            },
            Err(e) => ScrapePostResult {
                url: url.clone(),
                success: false,
                post: None,
                error: Some(e.to_string()),
            },
        })
        .collect())
}
