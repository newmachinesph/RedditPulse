use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::proxy::ProxyPool;
use crate::retry::{with_retry, RetryConfig};

#[derive(Debug, Error)]
pub enum ScraperError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("Failed to parse response: {0}")]
    Parse(String),
    #[error("Invalid Reddit URL: {0}")]
    InvalidUrl(String),
    #[error("Proxy error: {0}")]
    Proxy(String),
    #[error("Rate limited")]
    RateLimited,
}

/// Scraped Reddit post with comments
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedditPost {
    pub id: String,
    pub title: String,
    pub author: String,
    pub subreddit: String,
    pub selftext: Option<String>,
    pub url: String,
    pub permalink: String,
    pub score: i32,
    pub num_comments: i32,
    pub created_utc: f64,
    pub comments: Vec<RedditComment>,
}

/// A single Reddit comment
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedditComment {
    pub id: String,
    pub author: String,
    pub body: String,
    pub score: i32,
    pub created_utc: f64,
}

pub struct RedditScraper {
    client: Client,
}

impl RedditScraper {
    pub fn new() -> Result<Self, ScraperError> {
        let client = Client::builder()
            .user_agent("RedditPulse/1.0 (Reddit Brand Intelligence Tool)")
            .build()?;

        Ok(Self { client })
    }

    /// Create with a shared HTTP client (preferred - reuses connection pool)
    pub fn with_client(client: Client) -> Self {
        Self { client }
    }

    pub fn with_proxy(proxy_pool: &ProxyPool) -> Result<Self, ScraperError> {
        let client = proxy_pool
            .create_client()
            .map_err(|e| ScraperError::Proxy(e.to_string()))?;

        Ok(Self { client })
    }

    /// Fetch a Reddit post and its comments
    pub async fn fetch_post(&self, url: &str) -> Result<RedditPost, ScraperError> {
        // Convert Reddit URL to JSON endpoint
        let json_url = self.to_json_url(url)?;

        let retry_config = RetryConfig {
            max_retries: 2,
            ..RetryConfig::default()
        };
        let response = with_retry(&retry_config, || {
            self.client
                .get(&json_url)
                .header("User-Agent", "RedditPulse/1.0")
                .timeout(std::time::Duration::from_secs(15))
                .send()
        })
        .await?;

        if response.status() == 429 {
            return Err(ScraperError::RateLimited);
        }

        if !response.status().is_success() {
            return Err(ScraperError::Request(
                response.error_for_status().unwrap_err(),
            ));
        }

        let json: serde_json::Value = response.json().await?;

        self.parse_post_response(&json)
    }

    /// Convert a Reddit URL to its JSON API endpoint
    fn to_json_url(&self, url: &str) -> Result<String, ScraperError> {
        let url = url.trim_end_matches('/');

        // Parse the URL properly to prevent SSRF attacks.
        // We must validate the scheme and host rather than just checking
        // if the string contains "reddit.com".
        let parsed = reqwest::Url::parse(url)
            .map_err(|_| ScraperError::InvalidUrl(url.to_string()))?;

        // Enforce HTTPS
        if parsed.scheme() != "https" {
            return Err(ScraperError::InvalidUrl(format!(
                "Only HTTPS URLs are allowed, got scheme '{}'",
                parsed.scheme()
            )));
        }

        // Validate the host is exactly a known Reddit domain
        let host = parsed
            .host_str()
            .ok_or_else(|| ScraperError::InvalidUrl("Missing host".to_string()))?;

        match host {
            "reddit.com" | "www.reddit.com" | "old.reddit.com" => {}
            _ => {
                return Err(ScraperError::InvalidUrl(format!(
                    "Host '{}' is not a valid Reddit domain",
                    host
                )));
            }
        }

        // Remove query params and add .json
        let base_url = url.split('?').next().unwrap_or(url);
        Ok(format!("{}.json", base_url))
    }

    /// Parse Reddit JSON response into our structured types
    fn parse_post_response(&self, json: &serde_json::Value) -> Result<RedditPost, ScraperError> {
        // Reddit returns an array: [post_data, comments_data]
        let listings = json
            .as_array()
            .ok_or_else(|| ScraperError::Parse("Expected array response".to_string()))?;

        if listings.is_empty() {
            return Err(ScraperError::Parse("Empty response".to_string()));
        }

        // First element contains the post
        let post_data = &listings[0]["data"]["children"][0]["data"];

        let post = RedditPost {
            id: post_data["id"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            title: post_data["title"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            author: post_data["author"]
                .as_str()
                .unwrap_or("[deleted]")
                .to_string(),
            subreddit: post_data["subreddit"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            selftext: post_data["selftext"]
                .as_str()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string()),
            url: post_data["url"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            permalink: format!(
                "https://reddit.com{}",
                post_data["permalink"].as_str().unwrap_or_default()
            ),
            score: post_data["score"].as_i64().unwrap_or(0) as i32,
            num_comments: post_data["num_comments"].as_i64().unwrap_or(0) as i32,
            created_utc: post_data["created_utc"].as_f64().unwrap_or(0.0),
            comments: self.parse_comments(listings.get(1)),
        };

        Ok(post)
    }

    /// Parse comments from the response
    fn parse_comments(&self, comments_listing: Option<&serde_json::Value>) -> Vec<RedditComment> {
        let mut comments = Vec::new();

        if let Some(listing) = comments_listing {
            if let Some(children) = listing["data"]["children"].as_array() {
                for child in children {
                    if child["kind"].as_str() == Some("t1") {
                        let data = &child["data"];
                        comments.push(RedditComment {
                            id: data["id"].as_str().unwrap_or_default().to_string(),
                            author: data["author"]
                                .as_str()
                                .unwrap_or("[deleted]")
                                .to_string(),
                            body: data["body"].as_str().unwrap_or_default().to_string(),
                            score: data["score"].as_i64().unwrap_or(0) as i32,
                            created_utc: data["created_utc"].as_f64().unwrap_or(0.0),
                        });
                    }
                }
            }
        }

        comments
    }

    /// Fetch multiple posts with rate limiting
    pub async fn fetch_posts(&self, urls: &[String]) -> Vec<Result<RedditPost, ScraperError>> {
        let mut results = Vec::with_capacity(urls.len());

        for url in urls {
            let result = self.fetch_post(url).await;
            results.push(result);

            // Respect Reddit's rate limits - add delay between requests
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }

        results
    }
}
