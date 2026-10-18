use serde::{Deserialize, Serialize};

/// Sentiment score from -2 (very negative) to +2 (very positive)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SentimentScore {
    pub score: f64,
    pub label: String,
    pub confidence: f64,
}

impl SentimentScore {
    pub fn from_score(score: f64, confidence: f64) -> Self {
        let label = match score {
            s if s >= 1.5 => "Very Positive",
            s if s >= 0.5 => "Positive",
            s if s >= -0.5 => "Neutral",
            s if s >= -1.5 => "Negative",
            _ => "Very Negative",
        }
        .to_string();

        Self {
            score,
            label,
            confidence,
        }
    }
}

/// Analysis of a single Reddit mention
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MentionAnalysis {
    pub post_id: String,
    pub sentiment: SentimentScore,
    pub topics: Vec<String>,
    pub key_points: Vec<String>,
    pub is_recommendation: bool,
    pub is_complaint: bool,
    pub author_intent: String,
}

/// Full brand analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandAnalysisResult {
    pub brand_name: String,
    pub overall_sentiment: SentimentScore,
    pub mention_analyses: Vec<MentionAnalysis>,
    pub top_themes: Vec<ThemeInsight>,
    pub recommendations: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeInsight {
    pub theme: String,
    pub frequency: i32,
    pub sentiment: f64,
    pub example_quotes: Vec<String>,
}
