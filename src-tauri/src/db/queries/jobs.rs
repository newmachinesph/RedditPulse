use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::models::{CreateJobInput, Job, JobStatus, JobType};

fn row_to_job(row: &Row) -> rusqlite::Result<Job> {
    Ok(Job {
        id: row.get("id")?,
        job_type: JobType::from_str(&row.get::<_, String>("job_type")?),
        status: JobStatus::from_str(&row.get::<_, String>("status")?),
        brand_id: row.get("brand_id")?,
        progress: row.get("progress")?,
        output: row.get("output")?,
        error: row.get("error")?,
        started_at: row.get("started_at")?,
        completed_at: row.get("completed_at")?,
        created_at: row.get("created_at")?,
    })
}

/// Get all jobs, optionally filtered by status
pub fn get_jobs(conn: &Connection, status: Option<JobStatus>) -> rusqlite::Result<Vec<Job>> {
    let (sql, params): (&str, Vec<String>) = match status {
        Some(s) => (
            "SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC",
            vec![s.as_str().to_string()],
        ),
        None => ("SELECT * FROM jobs ORDER BY created_at DESC", vec![]),
    };

    let mut stmt = conn.prepare(sql)?;

    let jobs = if params.is_empty() {
        stmt.query_map([], |row| row_to_job(row))?
            .collect::<rusqlite::Result<Vec<_>>>()?
    } else {
        stmt.query_map([&params[0]], |row| row_to_job(row))?
            .collect::<rusqlite::Result<Vec<_>>>()?
    };

    Ok(jobs)
}

/// Get a job by ID
pub fn get_job(conn: &Connection, id: &str) -> rusqlite::Result<Option<Job>> {
    let mut stmt = conn.prepare("SELECT * FROM jobs WHERE id = ?")?;

    let result = stmt.query_row([id], |row| row_to_job(row));

    match result {
        Ok(job) => Ok(Some(job)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Get jobs for a specific brand
pub fn get_jobs_by_brand(conn: &Connection, brand_id: &str) -> rusqlite::Result<Vec<Job>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM jobs WHERE brand_id = ? ORDER BY created_at DESC",
    )?;

    let jobs = stmt
        .query_map([brand_id], |row| row_to_job(row))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(jobs)
}

/// Create a new job
pub fn create_job(conn: &Connection, input: &CreateJobInput) -> rusqlite::Result<Job> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO jobs (id, job_type, status, brand_id, progress, output, created_at)
         VALUES (?, ?, 'pending', ?, 0, '', ?)",
        params![id, input.job_type.as_str(), input.brand_id, now],
    )?;

    Ok(Job {
        id,
        job_type: input.job_type.clone(),
        status: JobStatus::Pending,
        brand_id: input.brand_id.clone(),
        progress: 0,
        output: String::new(),
        error: None,
        started_at: None,
        completed_at: None,
        created_at: now,
    })
}

/// Update job status
pub fn update_job_status(
    conn: &Connection,
    id: &str,
    status: JobStatus,
) -> rusqlite::Result<bool> {
    let now = chrono::Utc::now().to_rfc3339();

    let (started, completed) = match status {
        JobStatus::Running => (Some(now.clone()), None),
        JobStatus::Completed | JobStatus::Failed | JobStatus::Cancelled => (None, Some(now)),
        _ => (None, None),
    };

    let rows = if let Some(started_at) = started {
        conn.execute(
            "UPDATE jobs SET status = ?, started_at = ? WHERE id = ?",
            params![status.as_str(), started_at, id],
        )?
    } else if let Some(completed_at) = completed {
        conn.execute(
            "UPDATE jobs SET status = ?, completed_at = ? WHERE id = ?",
            params![status.as_str(), completed_at, id],
        )?
    } else {
        conn.execute(
            "UPDATE jobs SET status = ? WHERE id = ?",
            params![status.as_str(), id],
        )?
    };

    Ok(rows > 0)
}

/// Update job progress
pub fn update_job_progress(conn: &Connection, id: &str, progress: i32) -> rusqlite::Result<bool> {
    let rows = conn.execute(
        "UPDATE jobs SET progress = ? WHERE id = ?",
        params![progress, id],
    )?;
    Ok(rows > 0)
}

/// Update job output
pub fn update_job_output(conn: &Connection, id: &str, output: &str) -> rusqlite::Result<bool> {
    let rows = conn.execute(
        "UPDATE jobs SET output = ? WHERE id = ?",
        params![output, id],
    )?;
    Ok(rows > 0)
}

/// Mark job as failed with error message
pub fn fail_job(conn: &Connection, id: &str, error: &str) -> rusqlite::Result<bool> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE jobs SET status = 'failed', error = ?, completed_at = ? WHERE id = ?",
        params![error, now, id],
    )?;
    Ok(rows > 0)
}

/// Delete a job
pub fn delete_job(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    let rows = conn.execute("DELETE FROM jobs WHERE id = ?", [id])?;
    Ok(rows > 0)
}

/// Delete all completed, failed, and cancelled jobs
pub fn delete_all_finished_jobs(conn: &Connection) -> rusqlite::Result<usize> {
    let rows = conn.execute(
        "DELETE FROM jobs WHERE status IN ('completed', 'failed', 'cancelled')",
        [],
    )?;
    Ok(rows)
}

/// Get count of running jobs
pub fn count_running_jobs(conn: &Connection) -> rusqlite::Result<i32> {
    conn.query_row(
        "SELECT COUNT(*) FROM jobs WHERE status = 'running'",
        [],
        |row| row.get(0),
    )
}
