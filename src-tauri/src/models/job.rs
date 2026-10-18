use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl JobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            JobStatus::Pending => "pending",
            JobStatus::Running => "running",
            JobStatus::Completed => "completed",
            JobStatus::Failed => "failed",
            JobStatus::Cancelled => "cancelled",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "running" => JobStatus::Running,
            "completed" => JobStatus::Completed,
            "failed" => JobStatus::Failed,
            "cancelled" => JobStatus::Cancelled,
            _ => JobStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobType {
    BrandAnalysis,
    RedditSearch,
    RedditScrape,
}

impl JobType {
    pub fn as_str(&self) -> &'static str {
        match self {
            JobType::BrandAnalysis => "brand_analysis",
            JobType::RedditSearch => "reddit_search",
            JobType::RedditScrape => "reddit_scrape",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "reddit_search" => JobType::RedditSearch,
            "reddit_scrape" => JobType::RedditScrape,
            _ => JobType::BrandAnalysis,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub job_type: JobType,
    pub status: JobStatus,
    pub brand_id: Option<String>,
    pub progress: i32,
    pub output: String,
    pub error: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobInput {
    pub job_type: JobType,
    pub brand_id: Option<String>,
}
