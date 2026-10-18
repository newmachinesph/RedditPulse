use serde::Deserialize;
use tauri::State;

use crate::db::queries::jobs as job_queries;
use crate::models::{CreateJobInput, Job, JobStatus, JobType};
use crate::AppState;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobRequest {
    pub job_type: String,
    pub brand_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJobProgressRequest {
    pub id: String,
    pub progress: i32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJobStatusRequest {
    pub id: String,
    pub status: String,
}

#[tauri::command]
pub fn get_all_jobs(state: State<AppState>, status: Option<String>) -> Result<Vec<Job>, String> {
    let job_status = status.map(|s| JobStatus::from_str(&s));

    state
        .db
        .with_conn(|conn| job_queries::get_jobs(conn, job_status))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_job(state: State<AppState>, id: String) -> Result<Option<Job>, String> {
    state
        .db
        .with_conn(|conn| job_queries::get_job(conn, &id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_brand_jobs(state: State<AppState>, brand_id: String) -> Result<Vec<Job>, String> {
    state
        .db
        .with_conn(|conn| job_queries::get_jobs_by_brand(conn, &brand_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_job(state: State<AppState>, input: CreateJobRequest) -> Result<Job, String> {
    let job_input = CreateJobInput {
        job_type: JobType::from_str(&input.job_type),
        brand_id: input.brand_id,
    };

    state
        .db
        .with_conn(|conn| job_queries::create_job(conn, &job_input))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_job_status(state: State<AppState>, input: UpdateJobStatusRequest) -> Result<bool, String> {
    let status = JobStatus::from_str(&input.status);

    state
        .db
        .with_conn(|conn| job_queries::update_job_status(conn, &input.id, status))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_job_progress(
    state: State<AppState>,
    input: UpdateJobProgressRequest,
) -> Result<bool, String> {
    state
        .db
        .with_conn(|conn| job_queries::update_job_progress(conn, &input.id, input.progress))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_job(state: State<AppState>, id: String) -> Result<bool, String> {
    // Signal the running task to stop (if it's still running)
    state.job_registry.cancel(&id);

    state
        .db
        .with_conn(|conn| job_queries::update_job_status(conn, &id, JobStatus::Cancelled))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_job(state: State<AppState>, id: String) -> Result<bool, String> {
    state
        .db
        .with_conn(|conn| job_queries::delete_job(conn, &id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_all_finished_jobs(state: State<AppState>) -> Result<usize, String> {
    state
        .db
        .with_conn(|conn| job_queries::delete_all_finished_jobs(conn))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_running_job_count(state: State<AppState>) -> Result<i32, String> {
    state
        .db
        .with_conn(|conn| job_queries::count_running_jobs(conn))
        .map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJobOutputRequest {
    pub id: String,
    pub output: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailJobRequest {
    pub id: String,
    pub error: String,
}

#[tauri::command]
pub fn update_job_output(state: State<AppState>, input: UpdateJobOutputRequest) -> Result<bool, String> {
    state
        .db
        .with_conn(|conn| job_queries::update_job_output(conn, &input.id, &input.output))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fail_job(state: State<AppState>, input: FailJobRequest) -> Result<bool, String> {
    state
        .db
        .with_conn(|conn| job_queries::fail_job(conn, &input.id, &input.error))
        .map_err(|e| e.to_string())
}
