use serde::{Deserialize, Serialize};

/// Request payload for Serper search API
#[derive(Debug, Clone, Serialize)]
pub struct SerperSearchRequest {
    pub q: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
}

/// A single organic search result from Serper
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerperOrganicResult {
    pub title: String,
    pub link: String,
    #[serde(default)]
    pub snippet: Option<String>,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub position: Option<u32>,
}

/// Response from Serper search API
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SerperSearchResponse {
    #[serde(default)]
    pub organic: Vec<SerperOrganicResult>,
}

/// Parsed Reddit post from search results
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedditSearchResult {
    pub title: String,
    pub url: String,
    pub subreddit: Option<String>,
    pub snippet: Option<String>,
    pub date: Option<String>,
}

impl From<SerperOrganicResult> for RedditSearchResult {
    fn from(result: SerperOrganicResult) -> Self {
        // Extract subreddit from Reddit URL
        // Format: https://www.reddit.com/r/subreddit/...
        let subreddit = result.link
            .split("/r/")
            .nth(1)
            .and_then(|s| s.split('/').next())
            .map(|s| s.to_string());

        RedditSearchResult {
            title: result.title,
            url: result.link,
            subreddit,
            snippet: result.snippet,
            date: result.date,
        }
    }
}
