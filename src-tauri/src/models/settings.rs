use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub serper_api_key: String,
    #[serde(default)]
    pub openai_api_key: String,
    #[serde(default)]
    pub claude_api_key: String,
    /// Which AI provider to use: "openai" or "claude"
    #[serde(default = "default_ai_provider")]
    pub ai_provider: String,
    #[serde(default)]
    pub proxy: ProxySettings,
    #[serde(default)]
    pub analysis: AnalysisSettings,
    #[serde(default)]
    pub jobs: JobSettings,
}

fn default_ai_provider() -> String {
    "openai".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxySettings {
    pub enabled: bool,
    pub server: String,
    pub username: String,
    pub password: String,
    pub protocol: String,
}

impl Default for ProxySettings {
    fn default() -> Self {
        Self {
            enabled: false,
            server: String::new(),
            username: String::new(),
            password: String::new(),
            protocol: "http".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisSettings {
    pub max_mentions_per_brand: i32,
    pub max_subreddits: i32,
    pub sentiment_confidence_threshold: i32,
}

impl Default for AnalysisSettings {
    fn default() -> Self {
        Self {
            max_mentions_per_brand: 50,
            max_subreddits: 10,
            sentiment_confidence_threshold: 70,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobSettings {
    pub max_concurrent: i32,
    pub timeout_minutes: i32,
}

impl Default for JobSettings {
    fn default() -> Self {
        Self {
            max_concurrent: 3,
            timeout_minutes: 10,
        }
    }
}
