use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::shared;
use super::types::BrandAnalysisResult;
use crate::retry::{with_retry, RetryConfig};
use crate::scraper::RedditPost;

const OPENAI_API_URL: &str = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL: &str = "gpt-5.1";

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
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Debug, Serialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessageResponse,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessageResponse {
    content: String,
}

pub struct OpenAIClient {
    client: Client,
    api_key: String,
}

impl OpenAIClient {
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

        let request = OpenAIRequest {
            model: OPENAI_MODEL.to_string(),
            max_tokens: 4096,
            temperature: 0.3,
            messages: vec![
                OpenAIMessage {
                    role: "system".to_string(),
                    content: "You are an expert brand analyst. Analyze Reddit posts and provide sentiment analysis in JSON format.".to_string(),
                },
                OpenAIMessage {
                    role: "user".to_string(),
                    content: prompt,
                },
            ],
        };

        let retry_config = RetryConfig::default();
        let response = with_retry(&retry_config, || {
            self.client
                .post(OPENAI_API_URL)
                .header("Authorization", format!("Bearer {}", self.api_key))
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

        let openai_response: OpenAIResponse = response.json().await?;

        let text = openai_response
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default();

        shared::parse_analysis_response(brand_name, &text, posts)
            .map_err(AnalysisError::Parse)
    }
}
