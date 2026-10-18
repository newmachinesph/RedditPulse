use reqwest::Client;
use thiserror::Error;

use super::types::{RedditSearchResult, SerperSearchRequest, SerperSearchResponse};
use crate::proxy::ProxyPool;
use crate::retry::{with_retry, RetryConfig};

const SERPER_API_URL: &str = "https://google.serper.dev/search";

#[derive(Debug, Error)]
pub enum SerperError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("API key not configured")]
    MissingApiKey,
    #[error("API error: {0}")]
    ApiError(String),
    #[error("Proxy error: {0}")]
    Proxy(String),
}

pub struct SerperClient {
    client: Client,
    api_key: String,
}

impl SerperClient {
    pub fn new(api_key: String) -> Result<Self, SerperError> {
        if api_key.is_empty() {
            return Err(SerperError::MissingApiKey);
        }

        Ok(Self {
            client: Client::new(),
            api_key,
        })
    }

    /// Create with a shared HTTP client (preferred - reuses connection pool)
    pub fn with_client(client: Client, api_key: String) -> Result<Self, SerperError> {
        if api_key.is_empty() {
            return Err(SerperError::MissingApiKey);
        }

        Ok(Self { client, api_key })
    }

    /// Create a new client with proxy support
    pub fn with_proxy(api_key: String, proxy_pool: &ProxyPool) -> Result<Self, SerperError> {
        if api_key.is_empty() {
            return Err(SerperError::MissingApiKey);
        }

        let client = proxy_pool
            .create_client()
            .map_err(|e| SerperError::Proxy(e.to_string()))?;

        Ok(Self { client, api_key })
    }

    /// Search Reddit for posts about a brand
    pub async fn search_reddit(
        &self,
        query: &str,
        num_results: Option<u32>,
    ) -> Result<Vec<RedditSearchResult>, SerperError> {
        // Add site:reddit.com to restrict to Reddit
        let reddit_query = format!("site:reddit.com {}", query);

        let request = SerperSearchRequest {
            q: reddit_query,
            num: num_results.or(Some(20)),
            page: None,
        };

        let retry_config = RetryConfig::default();
        let response = with_retry(&retry_config, || {
            self.client
                .post(SERPER_API_URL)
                .header("X-API-KEY", &self.api_key)
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
        })
        .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            let body = if body.len() > 500 { format!("{}...", &body[..500]) } else { body };
            return Err(SerperError::ApiError(format!(
                "Status {}: {}",
                status, body
            )));
        }

        let search_response: SerperSearchResponse = response.json().await?;

        // Convert to Reddit-specific results
        let results: Vec<RedditSearchResult> = search_response
            .organic
            .into_iter()
            .filter(|r| r.link.contains("reddit.com"))
            .map(RedditSearchResult::from)
            .collect();

        Ok(results)
    }

    /// Search Reddit for posts in specific subreddits about a brand
    pub async fn search_subreddit(
        &self,
        query: &str,
        subreddit: &str,
        num_results: Option<u32>,
    ) -> Result<Vec<RedditSearchResult>, SerperError> {
        let subreddit_query = format!("site:reddit.com/r/{} {}", subreddit, query);

        let request = SerperSearchRequest {
            q: subreddit_query,
            num: num_results.or(Some(20)),
            page: None,
        };

        let retry_config = RetryConfig::default();
        let response = with_retry(&retry_config, || {
            self.client
                .post(SERPER_API_URL)
                .header("X-API-KEY", &self.api_key)
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
        })
        .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            let body = if body.len() > 500 { format!("{}...", &body[..500]) } else { body };
            return Err(SerperError::ApiError(format!(
                "Status {}: {}",
                status, body
            )));
        }

        let search_response: SerperSearchResponse = response.json().await?;

        let results: Vec<RedditSearchResult> = search_response
            .organic
            .into_iter()
            .filter(|r| r.link.contains("reddit.com"))
            .map(RedditSearchResult::from)
            .collect();

        Ok(results)
    }
}
