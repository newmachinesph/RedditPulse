use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Audience {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub brand_id: Option<String>,
    pub member_count: i32,
    pub filters: AudienceFilters,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AudienceFilters {
    #[serde(default)]
    pub subreddits: Vec<String>,
    #[serde(default)]
    pub min_karma: Option<i32>,
    #[serde(default)]
    pub min_posts: Option<i32>,
    #[serde(default)]
    pub tiers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudienceMember {
    pub audience_id: String,
    pub author_id: String,
    pub username: String,
    pub total_karma: i32,
    pub post_count: i32,
    pub avg_score: f64,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAudienceInput {
    pub name: String,
    pub description: Option<String>,
    pub brand_id: Option<String>,
    pub filters: AudienceFilters,
}

pub fn create_audience(conn: &Connection, input: &CreateAudienceInput) -> rusqlite::Result<Audience> {
    let id = uuid::Uuid::new_v4().to_string();
    let filters_json = serde_json::to_string(&input.filters).unwrap_or_else(|_| "{}".to_string());

    conn.execute(
        "INSERT INTO audiences (id, name, description, brand_id, filters) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, input.name, input.description, input.brand_id, filters_json],
    )?;

    get_audience_by_id(conn, &id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn get_audience_by_id(conn: &Connection, id: &str) -> rusqlite::Result<Option<Audience>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, brand_id, member_count, filters, created_at FROM audiences WHERE id = ?1",
    )?;

    let result = stmt.query_row(params![id], |row| {
        let filters_json: String = row.get(5)?;
        let filters: AudienceFilters = serde_json::from_str(&filters_json).unwrap_or_default();

        Ok(Audience {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            brand_id: row.get(3)?,
            member_count: row.get(4)?,
            filters,
            created_at: row.get(6)?,
        })
    });

    match result {
        Ok(audience) => Ok(Some(audience)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn get_all_audiences(conn: &Connection) -> rusqlite::Result<Vec<Audience>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, brand_id, member_count, filters, created_at FROM audiences ORDER BY created_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        let filters_json: String = row.get(5)?;
        let filters: AudienceFilters = serde_json::from_str(&filters_json).unwrap_or_default();

        Ok(Audience {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            brand_id: row.get(3)?,
            member_count: row.get(4)?,
            filters,
            created_at: row.get(6)?,
        })
    })?;

    rows.collect()
}

pub fn update_audience_member_count(conn: &Connection, audience_id: &str, count: i32) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE audiences SET member_count = ?1 WHERE id = ?2",
        params![count, audience_id],
    )?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAudienceInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub brand_id: Option<Option<String>>,
    pub filters: Option<AudienceFilters>,
}

pub fn update_audience(conn: &Connection, id: &str, input: &UpdateAudienceInput) -> rusqlite::Result<Option<Audience>> {
    // Build dynamic update query
    let mut updates = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref name) = input.name {
        updates.push("name = ?");
        params_vec.push(Box::new(name.clone()));
    }

    if let Some(ref description) = input.description {
        updates.push("description = ?");
        params_vec.push(Box::new(description.clone()));
    }

    if let Some(ref brand_id) = input.brand_id {
        updates.push("brand_id = ?");
        params_vec.push(Box::new(brand_id.clone()));
    }

    if let Some(ref filters) = input.filters {
        updates.push("filters = ?");
        let filters_json = serde_json::to_string(filters).unwrap_or_else(|_| "{}".to_string());
        params_vec.push(Box::new(filters_json));
    }

    if updates.is_empty() {
        return get_audience_by_id(conn, id);
    }

    let query = format!("UPDATE audiences SET {} WHERE id = ?", updates.join(", "));
    params_vec.push(Box::new(id.to_string()));

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    conn.execute(&query, params_refs.as_slice())?;

    get_audience_by_id(conn, id)
}

pub fn add_audience_member(conn: &Connection, audience_id: &str, author_id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO audience_members (audience_id, author_id) VALUES (?1, ?2)",
        params![audience_id, author_id],
    )?;
    Ok(())
}

pub fn clear_audience_members(conn: &Connection, audience_id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM audience_members WHERE audience_id = ?1",
        params![audience_id],
    )?;
    Ok(())
}

pub fn get_audience_members(conn: &Connection, audience_id: &str) -> rusqlite::Result<Vec<AudienceMember>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT am.audience_id, am.author_id, a.username, a.total_karma, a.post_count, a.avg_score, am.added_at
        FROM audience_members am
        JOIN authors a ON a.id = am.author_id
        WHERE am.audience_id = ?1
        ORDER BY a.avg_score DESC
        "#,
    )?;

    let rows = stmt.query_map(params![audience_id], |row| {
        Ok(AudienceMember {
            audience_id: row.get(0)?,
            author_id: row.get(1)?,
            username: row.get(2)?,
            total_karma: row.get(3)?,
            post_count: row.get(4)?,
            avg_score: row.get(5)?,
            added_at: row.get(6)?,
        })
    })?;

    rows.collect()
}

pub fn remove_audience_member(conn: &Connection, audience_id: &str, author_id: &str) -> rusqlite::Result<bool> {
    let affected = conn.execute(
        "DELETE FROM audience_members WHERE audience_id = ?1 AND author_id = ?2",
        params![audience_id, author_id],
    )?;
    Ok(affected > 0)
}

pub fn delete_audience(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    // Members are deleted via CASCADE
    let affected = conn.execute("DELETE FROM audiences WHERE id = ?1", params![id])?;
    Ok(affected > 0)
}

pub fn get_matching_authors(
    conn: &Connection,
    filters: &AudienceFilters,
) -> rusqlite::Result<Vec<(String, String, i32, i32, f64)>> {
    // Build dynamic query based on filters
    let mut query = String::from(
        "SELECT DISTINCT a.id, a.username, a.total_karma, a.post_count, a.avg_score FROM authors a",
    );

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // JOIN influencers only when tier filter is used
    if !filters.tiers.is_empty() {
        query.push_str(" JOIN influencers i ON i.author_id = a.id");
    }

    // JOIN author_subreddits + subreddits when subreddit filter is used
    if !filters.subreddits.is_empty() {
        query.push_str(" JOIN author_subreddits asub ON asub.author_id = a.id");
        query.push_str(" JOIN subreddits s ON s.id = asub.subreddit_id");
    }

    query.push_str(" WHERE 1=1");

    if let Some(min_karma) = filters.min_karma {
        query.push_str(" AND a.total_karma >= ?");
        params_vec.push(Box::new(min_karma));
    }

    if let Some(min_posts) = filters.min_posts {
        query.push_str(" AND a.post_count >= ?");
        params_vec.push(Box::new(min_posts));
    }

    if !filters.tiers.is_empty() {
        let placeholders: Vec<&str> = filters.tiers.iter().map(|_| "?").collect();
        query.push_str(&format!(" AND i.tier IN ({})", placeholders.join(",")));
        for tier in &filters.tiers {
            params_vec.push(Box::new(tier.clone()));
        }
    }

    if !filters.subreddits.is_empty() {
        let placeholders: Vec<&str> = filters.subreddits.iter().map(|_| "?").collect();
        query.push_str(&format!(" AND s.name IN ({})", placeholders.join(",")));
        for sub in &filters.subreddits {
            params_vec.push(Box::new(sub.clone()));
        }
    }

    query.push_str(" ORDER BY a.avg_score DESC LIMIT 200");

    let mut stmt = conn.prepare(&query)?;

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let rows = stmt.query_map(params_refs.as_slice(), |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i32>(2)?,
            row.get::<_, i32>(3)?,
            row.get::<_, f64>(4)?,
        ))
    })?;

    rows.collect()
}
