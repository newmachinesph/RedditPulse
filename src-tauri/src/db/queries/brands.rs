use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::models::{Brand, CreateBrandInput, UpdateBrandInput};

fn row_to_brand(row: &Row) -> rusqlite::Result<Brand> {
    Ok(Brand {
        id: row.get("id")?,
        name: row.get("name")?,
        industry: row.get("industry")?,
        description: row.get("description")?,
        website: row.get("website")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

/// Get all brands
pub fn get_all_brands(conn: &Connection) -> rusqlite::Result<Vec<Brand>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, industry, description, website, created_at, updated_at
         FROM brands ORDER BY updated_at DESC"
    )?;

    let brands = stmt
        .query_map([], |row| row_to_brand(row))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(brands)
}

/// Get a brand by ID
pub fn get_brand(conn: &Connection, id: &str) -> rusqlite::Result<Option<Brand>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, industry, description, website, created_at, updated_at
         FROM brands WHERE id = ?"
    )?;

    let result = stmt.query_row([id], |row| row_to_brand(row));

    match result {
        Ok(brand) => Ok(Some(brand)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Create a new brand
pub fn create_brand(conn: &Connection, input: &CreateBrandInput) -> rusqlite::Result<Brand> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO brands (id, name, industry, description, website, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            id,
            input.name,
            input.industry,
            input.description,
            input.website,
            now,
            now
        ],
    )?;

    Ok(Brand {
        id,
        name: input.name.clone(),
        industry: input.industry.clone(),
        description: input.description.clone(),
        website: input.website.clone(),
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Update a brand
pub fn update_brand(conn: &Connection, id: &str, input: &UpdateBrandInput) -> rusqlite::Result<Option<Brand>> {
    // First check if brand exists
    let existing = get_brand(conn, id)?;
    if existing.is_none() {
        return Ok(None);
    }
    let existing = existing.unwrap();

    let now = chrono::Utc::now().to_rfc3339();

    let name = input.name.as_ref().unwrap_or(&existing.name);
    let industry = input.industry.as_ref().unwrap_or(&existing.industry);
    let description = input.description.clone().or(existing.description);
    let website = input.website.clone().or(existing.website);

    conn.execute(
        "UPDATE brands SET name = ?, industry = ?, description = ?, website = ?, updated_at = ?
         WHERE id = ?",
        params![name, industry, description, website, now, id],
    )?;

    Ok(Some(Brand {
        id: id.to_string(),
        name: name.clone(),
        industry: industry.clone(),
        description,
        website,
        created_at: existing.created_at,
        updated_at: now,
    }))
}

/// Delete a brand
pub fn delete_brand(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    let rows_affected = conn.execute("DELETE FROM brands WHERE id = ?", [id])?;
    Ok(rows_affected > 0)
}
