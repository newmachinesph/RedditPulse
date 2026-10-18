use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandAnalysisRecord {
    pub id: String,
    pub brand_id: String,
    pub analysis_data: String,
    pub posts_data: String,
    pub post_count: i32,
    pub overall_sentiment_score: f64,
    pub overall_sentiment_label: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAnalysisInput {
    pub brand_id: String,
    pub analysis_data: String,
    pub posts_data: String,
    pub post_count: i32,
    pub overall_sentiment_score: f64,
    pub overall_sentiment_label: String,
}

pub fn save_analysis(conn: &Connection, input: &SaveAnalysisInput) -> rusqlite::Result<BrandAnalysisRecord> {
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        r#"
        INSERT INTO brand_analyses (id, brand_id, analysis_data, posts_data, post_count, overall_sentiment_score, overall_sentiment_label)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        params![
            id,
            input.brand_id,
            input.analysis_data,
            input.posts_data,
            input.post_count,
            input.overall_sentiment_score,
            input.overall_sentiment_label,
        ],
    )?;

    get_analysis_by_id(conn, &id)?.ok_or_else(|| {
        rusqlite::Error::QueryReturnedNoRows
    })
}

pub fn get_analysis_by_id(conn: &Connection, id: &str) -> rusqlite::Result<Option<BrandAnalysisRecord>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, brand_id, analysis_data, posts_data, post_count, overall_sentiment_score, overall_sentiment_label, created_at
        FROM brand_analyses
        WHERE id = ?1
        "#,
    )?;

    let result = stmt.query_row(params![id], |row| {
        Ok(BrandAnalysisRecord {
            id: row.get(0)?,
            brand_id: row.get(1)?,
            analysis_data: row.get(2)?,
            posts_data: row.get(3)?,
            post_count: row.get(4)?,
            overall_sentiment_score: row.get(5)?,
            overall_sentiment_label: row.get(6)?,
            created_at: row.get(7)?,
        })
    });

    match result {
        Ok(record) => Ok(Some(record)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn get_latest_analysis_for_brand(conn: &Connection, brand_id: &str) -> rusqlite::Result<Option<BrandAnalysisRecord>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, brand_id, analysis_data, posts_data, post_count, overall_sentiment_score, overall_sentiment_label, created_at
        FROM brand_analyses
        WHERE brand_id = ?1
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )?;

    let result = stmt.query_row(params![brand_id], |row| {
        Ok(BrandAnalysisRecord {
            id: row.get(0)?,
            brand_id: row.get(1)?,
            analysis_data: row.get(2)?,
            posts_data: row.get(3)?,
            post_count: row.get(4)?,
            overall_sentiment_score: row.get(5)?,
            overall_sentiment_label: row.get(6)?,
            created_at: row.get(7)?,
        })
    });

    match result {
        Ok(record) => Ok(Some(record)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn get_all_analyses_for_brand(conn: &Connection, brand_id: &str) -> rusqlite::Result<Vec<BrandAnalysisRecord>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, brand_id, analysis_data, posts_data, post_count, overall_sentiment_score, overall_sentiment_label, created_at
        FROM brand_analyses
        WHERE brand_id = ?1
        ORDER BY created_at DESC
        "#,
    )?;

    let rows = stmt.query_map(params![brand_id], |row| {
        Ok(BrandAnalysisRecord {
            id: row.get(0)?,
            brand_id: row.get(1)?,
            analysis_data: row.get(2)?,
            posts_data: row.get(3)?,
            post_count: row.get(4)?,
            overall_sentiment_score: row.get(5)?,
            overall_sentiment_label: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;

    rows.collect()
}

pub fn delete_analysis(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    let affected = conn.execute(
        "DELETE FROM brand_analyses WHERE id = ?1",
        params![id],
    )?;
    Ok(affected > 0)
}

#[allow(dead_code)]
pub fn delete_analyses_for_brand(conn: &Connection, brand_id: &str) -> rusqlite::Result<u64> {
    let affected = conn.execute(
        "DELETE FROM brand_analyses WHERE brand_id = ?1",
        params![brand_id],
    )?;
    Ok(affected as u64)
}

/// Summary of analysis for a brand (used in brand list)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandAnalysisSummary {
    pub brand_id: String,
    pub overall_sentiment_score: f64,
    pub overall_sentiment_label: String,
    pub post_count: i32,
    pub last_analyzed_at: String,
}

/// Get latest analysis summary for all brands
pub fn get_all_brand_analysis_summaries(conn: &Connection) -> rusqlite::Result<Vec<BrandAnalysisSummary>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT brand_id, overall_sentiment_score, overall_sentiment_label, post_count, created_at
        FROM brand_analyses ba1
        WHERE created_at = (
            SELECT MAX(created_at) FROM brand_analyses ba2 WHERE ba2.brand_id = ba1.brand_id
        )
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(BrandAnalysisSummary {
            brand_id: row.get(0)?,
            overall_sentiment_score: row.get(1)?,
            overall_sentiment_label: row.get(2)?,
            post_count: row.get(3)?,
            last_analyzed_at: row.get(4)?,
        })
    })?;

    rows.collect()
}

/// Lightweight trend data point for charts
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SentimentTrendPoint {
    pub date: String,
    pub sentiment_score: f64,
    pub sentiment_label: String,
    pub post_count: i32,
}

/// Get sentiment trend data for a brand (lightweight, for charts)
pub fn get_sentiment_trend(conn: &Connection, brand_id: &str, limit: i32) -> rusqlite::Result<Vec<SentimentTrendPoint>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT DATE(created_at) as date, overall_sentiment_score, overall_sentiment_label, post_count
        FROM brand_analyses
        WHERE brand_id = ?1
        ORDER BY created_at ASC
        LIMIT ?2
        "#,
    )?;

    let rows = stmt.query_map(params![brand_id, limit], |row| {
        Ok(SentimentTrendPoint {
            date: row.get(0)?,
            sentiment_score: row.get(1)?,
            sentiment_label: row.get(2)?,
            post_count: row.get(3)?,
        })
    })?;

    rows.collect()
}
