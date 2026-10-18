use serde::{Deserialize, Serialize};
use tauri::State;

use crate::proxy::ProxyPool;
use crate::serper::{RedditSearchResult, SerperClient};
use crate::AppState;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchRedditInput {
    pub query: String,
    pub subreddit: Option<String>,
    pub num_results: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchRedditResponse {
    pub results: Vec<RedditSearchResult>,
    pub query: String,
}

#[tauri::command]
pub async fn search_reddit(
    state: State<'_, AppState>,
    input: SearchRedditInput,
) -> Result<SearchRedditResponse, String> {
    // Get settings
    let settings = state
        .db
        .with_conn(|conn| crate::db::queries::settings::load_settings(conn))
        .map_err(|e| e.to_string())?;

    let api_key = settings.serper_api_key;
    if api_key.is_empty() {
        return Err("Serper API key not configured. Please add it in Settings.".to_string());
    }

    // Create client with or without proxy
    let proxy_pool = ProxyPool::from_settings(&settings.proxy);
    let client = if proxy_pool.is_configured() {
        SerperClient::with_proxy(api_key, &proxy_pool).map_err(|e| e.to_string())?
    } else {
        SerperClient::with_client(state.http_client.clone(), api_key).map_err(|e| e.to_string())?
    };

    let results = if let Some(ref subreddit) = input.subreddit {
        client
            .search_subreddit(&input.query, subreddit, input.num_results)
            .await
            .map_err(|e| e.to_string())?
    } else {
        client
            .search_reddit(&input.query, input.num_results)
            .await
            .map_err(|e| e.to_string())?
    };

    Ok(SearchRedditResponse {
        results,
        query: input.query,
    })
}
