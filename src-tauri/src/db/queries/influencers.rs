use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    pub id: String,
    pub username: String,
    pub total_karma: i32,
    pub post_count: i32,
    pub avg_score: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Influencer {
    pub id: String,
    pub author_id: String,
    pub tier: String,
    pub expertise_tags: Vec<String>,
    pub engagement_rate: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InfluencerWithAuthor {
    pub id: String,
    pub username: String,
    pub total_karma: i32,
    pub post_count: i32,
    pub avg_score: f64,
    pub tier: String,
    pub expertise_tags: Vec<String>,
    pub engagement_rate: f64,
    pub brand_names: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredInfluencer {
    pub username: String,
    pub post_count: i32,
    pub total_score: i32,
    pub avg_score: f64,
    pub total_comments: i32,
    pub subreddits: Vec<String>,
    pub sentiment: String,
}

pub fn get_or_create_author(
    conn: &Connection,
    username: &str,
    karma: i32,
    post_count: i32,
    avg_score: f64,
) -> rusqlite::Result<Author> {
    // Try to find existing author
    let mut stmt = conn.prepare(
        "SELECT id, username, total_karma, post_count, avg_score, created_at FROM authors WHERE username = ?1",
    )?;

    let result = stmt.query_row(params![username], |row| {
        Ok(Author {
            id: row.get(0)?,
            username: row.get(1)?,
            total_karma: row.get(2)?,
            post_count: row.get(3)?,
            avg_score: row.get(4)?,
            created_at: row.get(5)?,
        })
    });

    match result {
        Ok(mut author) => {
            // Update existing author with new stats
            author.total_karma = karma;
            author.post_count = post_count;
            author.avg_score = avg_score;

            conn.execute(
                "UPDATE authors SET total_karma = ?1, post_count = ?2, avg_score = ?3 WHERE id = ?4",
                params![karma, post_count, avg_score, author.id],
            )?;

            Ok(author)
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // Create new author
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO authors (id, username, total_karma, post_count, avg_score) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, username, karma, post_count, avg_score],
            )?;

            let mut stmt = conn.prepare(
                "SELECT id, username, total_karma, post_count, avg_score, created_at FROM authors WHERE id = ?1",
            )?;

            stmt.query_row(params![id], |row| {
                Ok(Author {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    total_karma: row.get(2)?,
                    post_count: row.get(3)?,
                    avg_score: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
        }
        Err(e) => Err(e),
    }
}

pub fn create_or_update_influencer(
    conn: &Connection,
    author_id: &str,
    tier: &str,
    expertise_tags: &[String],
    engagement_rate: f64,
) -> rusqlite::Result<Influencer> {
    let tags_json = serde_json::to_string(expertise_tags).unwrap_or_else(|_| "[]".to_string());

    // Check if influencer already exists
    let mut stmt = conn.prepare("SELECT id FROM influencers WHERE author_id = ?1")?;
    let exists = stmt.exists(params![author_id])?;

    if exists {
        conn.execute(
            "UPDATE influencers SET tier = ?1, expertise_tags = ?2, engagement_rate = ?3 WHERE author_id = ?4",
            params![tier, tags_json, engagement_rate, author_id],
        )?;
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO influencers (id, author_id, tier, expertise_tags, engagement_rate) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, author_id, tier, tags_json, engagement_rate],
        )?;
    }

    get_influencer_by_author_id(conn, author_id)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
}

pub fn get_influencer_by_author_id(conn: &Connection, author_id: &str) -> rusqlite::Result<Option<Influencer>> {
    let mut stmt = conn.prepare(
        "SELECT id, author_id, tier, expertise_tags, engagement_rate, created_at FROM influencers WHERE author_id = ?1",
    )?;

    let result = stmt.query_row(params![author_id], |row| {
        let tags_json: String = row.get(3)?;
        let expertise_tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

        Ok(Influencer {
            id: row.get(0)?,
            author_id: row.get(1)?,
            tier: row.get(2)?,
            expertise_tags,
            engagement_rate: row.get(4)?,
            created_at: row.get(5)?,
        })
    });

    match result {
        Ok(influencer) => Ok(Some(influencer)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn get_all_influencers(conn: &Connection) -> rusqlite::Result<Vec<InfluencerWithAuthor>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT i.id, a.username, a.total_karma, a.post_count, a.avg_score,
               i.tier, i.expertise_tags, i.engagement_rate, i.created_at,
               GROUP_CONCAT(b.name, '||') AS brand_names
        FROM influencers i
        JOIN authors a ON a.id = i.author_id
        LEFT JOIN influencer_brands ib ON ib.influencer_id = i.id
        LEFT JOIN brands b ON b.id = ib.brand_id
        GROUP BY i.id
        ORDER BY a.avg_score DESC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        let tags_json: String = row.get(6)?;
        let expertise_tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        let brand_names_raw: Option<String> = row.get(9)?;
        let brand_names: Vec<String> = brand_names_raw
            .map(|s| s.split("||").map(|n| n.to_string()).collect())
            .unwrap_or_default();

        Ok(InfluencerWithAuthor {
            id: row.get(0)?,
            username: row.get(1)?,
            total_karma: row.get(2)?,
            post_count: row.get(3)?,
            avg_score: row.get(4)?,
            tier: row.get(5)?,
            expertise_tags,
            engagement_rate: row.get(7)?,
            brand_names,
            created_at: row.get(8)?,
        })
    })?;

    rows.collect()
}

pub fn delete_influencer(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    let affected = conn.execute("DELETE FROM influencers WHERE id = ?1", params![id])?;
    Ok(affected > 0)
}

pub fn delete_all_influencers(conn: &Connection) -> rusqlite::Result<usize> {
    let rows = conn.execute("DELETE FROM influencers", [])?;
    Ok(rows)
}

pub fn calculate_tier(avg_score: f64, post_count: i32) -> String {
    // Tier based on engagement and activity
    if avg_score >= 500.0 && post_count >= 10 {
        "mega".to_string()
    } else if avg_score >= 100.0 && post_count >= 5 {
        "macro".to_string()
    } else if avg_score >= 20.0 && post_count >= 2 {
        "micro".to_string()
    } else {
        "nano".to_string()
    }
}

pub fn link_influencer_brand(
    conn: &Connection,
    influencer_id: &str,
    brand_id: &str,
    mention_count: i32,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO influencer_brands (influencer_id, brand_id, mention_count) VALUES (?1, ?2, ?3)
         ON CONFLICT(influencer_id, brand_id) DO UPDATE SET mention_count = ?3",
        params![influencer_id, brand_id, mention_count],
    )?;
    Ok(())
}

pub fn get_influencer_brand_names(conn: &Connection, influencer_id: &str) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT b.name FROM influencer_brands ib JOIN brands b ON b.id = ib.brand_id WHERE ib.influencer_id = ?1 ORDER BY ib.mention_count DESC"
    )?;
    let rows = stmt.query_map(params![influencer_id], |row| row.get(0))?;
    rows.collect()
}

pub fn create_or_update_author_subreddit(
    conn: &Connection,
    author_id: &str,
    subreddit_name: &str,
    post_count: i32,
    total_score: i32,
) -> rusqlite::Result<()> {
    // Get or create subreddit
    let subreddit_id: Option<String> = conn
        .prepare("SELECT id FROM subreddits WHERE name = ?1")?
        .query_row(params![subreddit_name], |row| row.get(0))
        .ok();

    let subreddit_id = match subreddit_id {
        Some(id) => id,
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR IGNORE INTO subreddits (id, name) VALUES (?1, ?2)",
                params![id, subreddit_name],
            )?;
            // Re-fetch in case of race with OR IGNORE
            conn.prepare("SELECT id FROM subreddits WHERE name = ?1")?
                .query_row(params![subreddit_name], |row| row.get(0))?
        }
    };

    conn.execute(
        "INSERT INTO author_subreddits (author_id, subreddit_id, post_count, total_score) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(author_id, subreddit_id) DO UPDATE SET post_count = ?3, total_score = ?4",
        params![author_id, subreddit_id, post_count, total_score],
    )?;

    Ok(())
}
