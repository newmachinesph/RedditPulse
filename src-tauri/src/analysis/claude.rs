use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::shared;
use super::types::BrandAnalysisResult;
use crate::retry::{with_retry, RetryConfig};
use crate::scraper::RedditPost;

const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL: &str = "claude-sonnet-4-20250514";

#[derive(Debug, Error)]
pub enum AnalysisError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("API key not configured")]
    MissingApiKey,
    #[error("API error: {0}")]
    ApiError(String),
    #[error("Failed to parse response: {0}")]
    Parse(String),
}

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<ClaudeMessage>,
}

#[derive(Debug, Serialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContent {
    text: String,
}

pub struct ClaudeClient {
    client: Client,
    api_key: String,
}

impl ClaudeClient {
    pub fn new(api_key: String) -> Result<Self, AnalysisError> {
        if api_key.is_empty() {
            return Err(AnalysisError::MissingApiKey);
        }

        Ok(Self {
            client: Client::new(),
            api_key,
        })
    }

    /// Create with a shared HTTP client (preferred - reuses connection pool)
    pub fn with_client(client: Client, api_key: String) -> Result<Self, AnalysisError> {
        if api_key.is_empty() {
            return Err(AnalysisError::MissingApiKey);
        }

        Ok(Self { client, api_key })
    }

    /// Analyze Reddit posts for brand sentiment
    pub async fn analyze_brand_mentions(
        &self,
        brand_name: &str,
        posts: &[RedditPost],
    ) -> Result<BrandAnalysisResult, AnalysisError> {
        let prompt = shared::build_analysis_prompt(brand_name, posts);

        let request = ClaudeRequest {
            model: CLAUDE_MODEL.to_string(),
            max_tokens: 4096,
            system: "You are an expert brand analyst. Analyze Reddit posts and provide sentiment analysis in JSON format.".to_string(),
            messages: vec![ClaudeMessage {
                role: "user".to_string(),
                content: prompt,
            }],
        };

        let retry_config = RetryConfig::default();
        let response = with_retry(&retry_config, || {
            self.client
                .post(CLAUDE_API_URL)
                .header("x-api-key", &self.api_key)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
        })
        .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            let body = if body.len() > 500 { format!("{}...", &body[..500]) } else { body };
            return Err(AnalysisError::ApiError(format!(
                "Status {}: {}",
                status, body
            )));
        }

        let claude_response: ClaudeResponse = response.json().await?;

        let text = claude_response
            .content
            .first()
            .map(|c| c.text.clone())
            .unwrap_or_default();

        shared::parse_analysis_response(brand_name, &text, posts)
            .map_err(AnalysisError::Parse)
    }
}
