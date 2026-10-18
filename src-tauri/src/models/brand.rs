use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Brand {
    pub id: String,
    pub name: String,
    pub industry: String,
    pub description: Option<String>,
    pub website: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBrandInput {
    pub name: String,
    pub industry: String,
    pub description: Option<String>,
    pub website: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBrandInput {
    pub name: Option<String>,
    pub industry: Option<String>,
    pub description: Option<String>,
    pub website: Option<String>,
}
