use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Competitor {
    pub id: String,
    pub brand_id: String,
    pub competitor_brand_id: String,
    pub relationship: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompetitorWithBrand {
    pub id: String,
    pub brand_id: String,
    pub competitor_brand_id: String,
    pub competitor_name: String,
    pub competitor_industry: String,
    pub relationship: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCompetitorInput {
    pub brand_id: String,
    pub competitor_brand_id: String,
    pub relationship: Option<String>,
}

pub fn add_competitor(conn: &Connection, input: &CreateCompetitorInput) -> rusqlite::Result<Competitor> {
    let id = uuid::Uuid::new_v4().to_string();
    let relationship = input.relationship.clone().unwrap_or_else(|| "direct".to_string());

    conn.execute(
        r#"
        INSERT INTO competitors (id, brand_id, competitor_brand_id, relationship)
        VALUES (?1, ?2, ?3, ?4)
        "#,
        params![id, input.brand_id, input.competitor_brand_id, relationship],
    )?;

    get_competitor_by_id(conn, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn get_competitor_by_id(conn: &Connection, id: &str) -> rusqlite::Result<Option<Competitor>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, brand_id, competitor_brand_id, relationship, created_at
        FROM competitors
        WHERE id = ?1
        "#,
    )?;

    let result = stmt.query_row(params![id], |row| {
        Ok(Competitor {
            id: row.get(0)?,
            brand_id: row.get(1)?,
            competitor_brand_id: row.get(2)?,
            relationship: row.get(3)?,
            created_at: row.get(4)?,
        })
    });

    match result {
        Ok(competitor) => Ok(Some(competitor)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn get_competitors_for_brand(conn: &Connection, brand_id: &str) -> rusqlite::Result<Vec<CompetitorWithBrand>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT c.id, c.brand_id, c.competitor_brand_id, b.name, b.industry, c.relationship, c.created_at
        FROM competitors c
        JOIN brands b ON b.id = c.competitor_brand_id
        WHERE c.brand_id = ?1
        ORDER BY c.created_at DESC
        "#,
    )?;

    let rows = stmt.query_map(params![brand_id], |row| {
        Ok(CompetitorWithBrand {
            id: row.get(0)?,
            brand_id: row.get(1)?,
            competitor_brand_id: row.get(2)?,
            competitor_name: row.get(3)?,
            competitor_industry: row.get(4)?,
            relationship: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;

    rows.collect()
}

pub fn get_all_competitor_pairs(conn: &Connection) -> rusqlite::Result<Vec<CompetitorWithBrand>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT c.id, c.brand_id, c.competitor_brand_id, b.name, b.industry, c.relationship, c.created_at
        FROM competitors c
        JOIN brands b ON b.id = c.competitor_brand_id
        ORDER BY c.created_at DESC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(CompetitorWithBrand {
            id: row.get(0)?,
            brand_id: row.get(1)?,
            competitor_brand_id: row.get(2)?,
            competitor_name: row.get(3)?,
            competitor_industry: row.get(4)?,
            relationship: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;

    rows.collect()
}

pub fn remove_competitor(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    let affected = conn.execute(
        "DELETE FROM competitors WHERE id = ?1",
        params![id],
    )?;
    Ok(affected > 0)
}

pub fn check_competitor_exists(conn: &Connection, brand_id: &str, competitor_brand_id: &str) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare(
        "SELECT 1 FROM competitors WHERE brand_id = ?1 AND competitor_brand_id = ?2",
    )?;

    let exists = stmt.exists(params![brand_id, competitor_brand_id])?;
    Ok(exists)
}
