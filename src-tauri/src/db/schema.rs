use rusqlite::Connection;

/// Initialize the database schema
pub fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(SCHEMA_SQL)?;
    Ok(())
}

const SCHEMA_SQL: &str = r#"
-- Brands table
CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT NOT NULL DEFAULT '',
    description TEXT,
    website TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Brand analyses table (stores full Claude analysis result as JSON)
CREATE TABLE IF NOT EXISTS brand_analyses (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL,
    analysis_data TEXT NOT NULL,
    posts_data TEXT NOT NULL DEFAULT '[]',
    post_count INTEGER NOT NULL DEFAULT 0,
    overall_sentiment_score REAL NOT NULL DEFAULT 0,
    overall_sentiment_label TEXT NOT NULL DEFAULT 'neutral',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

-- Subreddits table
CREATE TABLE IF NOT EXISTS subreddits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    subscribers INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Brand-Subreddit junction table
CREATE TABLE IF NOT EXISTS brand_subreddits (
    brand_id TEXT NOT NULL,
    subreddit_id TEXT NOT NULL,
    mention_count INTEGER NOT NULL DEFAULT 0,
    avg_sentiment REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (brand_id, subreddit_id),
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
    FOREIGN KEY (subreddit_id) REFERENCES subreddits(id) ON DELETE CASCADE
);

-- Mentions table
CREATE TABLE IF NOT EXISTS mentions (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL,
    subreddit_id TEXT NOT NULL,
    reddit_post_id TEXT NOT NULL,
    author TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    score INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    sentiment TEXT NOT NULL DEFAULT 'neutral',
    sentiment_score REAL NOT NULL DEFAULT 0,
    url TEXT NOT NULL,
    reddit_created_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
    FOREIGN KEY (subreddit_id) REFERENCES subreddits(id) ON DELETE CASCADE
);

-- Authors table
CREATE TABLE IF NOT EXISTS authors (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    total_karma INTEGER NOT NULL DEFAULT 0,
    post_count INTEGER NOT NULL DEFAULT 0,
    avg_score REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Author-Subreddit activity junction table
CREATE TABLE IF NOT EXISTS author_subreddits (
    author_id TEXT NOT NULL,
    subreddit_id TEXT NOT NULL,
    post_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (author_id, subreddit_id),
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
    FOREIGN KEY (subreddit_id) REFERENCES subreddits(id) ON DELETE CASCADE
);

-- Audiences table
CREATE TABLE IF NOT EXISTS audiences (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    brand_id TEXT,
    member_count INTEGER NOT NULL DEFAULT 0,
    filters TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
);

-- Audience members junction table
CREATE TABLE IF NOT EXISTS audience_members (
    audience_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (audience_id, author_id),
    FOREIGN KEY (audience_id) REFERENCES audiences(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
);

-- Influencers table
CREATE TABLE IF NOT EXISTS influencers (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL UNIQUE,
    tier TEXT NOT NULL DEFAULT 'nano',
    expertise_tags TEXT NOT NULL DEFAULT '[]',
    engagement_rate REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
);

-- Influencer-Brand junction table (which brands an influencer discusses)
CREATE TABLE IF NOT EXISTS influencer_brands (
    influencer_id TEXT NOT NULL,
    brand_id TEXT NOT NULL,
    mention_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (influencer_id, brand_id),
    FOREIGN KEY (influencer_id) REFERENCES influencers(id) ON DELETE CASCADE,
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

-- Competitors table
CREATE TABLE IF NOT EXISTS competitors (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL,
    competitor_brand_id TEXT NOT NULL,
    relationship TEXT NOT NULL DEFAULT 'direct',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (brand_id, competitor_brand_id),
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
    FOREIGN KEY (competitor_brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

-- Pricing calculations table
CREATE TABLE IF NOT EXISTS pricing_calculations (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL,
    base_price REAL NOT NULL DEFAULT 100,
    sentiment_penalty REAL NOT NULL DEFAULT 0,
    trust_penalty REAL NOT NULL DEFAULT 0,
    difficulty_premium REAL NOT NULL DEFAULT 0,
    final_price REAL NOT NULL DEFAULT 100,
    volume_recommendation INTEGER NOT NULL DEFAULT 100,
    scenarios TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    brand_id TEXT,
    report_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'markdown',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    brand_id TEXT,
    progress INTEGER NOT NULL DEFAULT 0,
    output TEXT NOT NULL DEFAULT '',
    error TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_mentions_brand_id ON mentions(brand_id);
CREATE INDEX IF NOT EXISTS idx_mentions_subreddit_id ON mentions(subreddit_id);
CREATE INDEX IF NOT EXISTS idx_mentions_author ON mentions(author);
CREATE INDEX IF NOT EXISTS idx_brand_analyses_brand_id ON brand_analyses(brand_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_brand_id ON jobs(brand_id);
CREATE INDEX IF NOT EXISTS idx_influencers_author_id ON influencers(author_id);
CREATE INDEX IF NOT EXISTS idx_influencers_tier ON influencers(tier);
CREATE INDEX IF NOT EXISTS idx_audience_members_audience_id ON audience_members(audience_id);
CREATE INDEX IF NOT EXISTS idx_audience_members_author_id ON audience_members(author_id);
CREATE INDEX IF NOT EXISTS idx_competitors_brand_id ON competitors(brand_id);
CREATE INDEX IF NOT EXISTS idx_competitors_competitor_brand_id ON competitors(competitor_brand_id);
CREATE INDEX IF NOT EXISTS idx_author_subreddits_author_id ON author_subreddits(author_id);
CREATE INDEX IF NOT EXISTS idx_influencer_brands_influencer_id ON influencer_brands(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_brands_brand_id ON influencer_brands(brand_id);
"#;

/// Run migrations for schema changes on existing databases
pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    // Add brand_id column to audiences if it doesn't exist
    let has_brand_id: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('audiences') WHERE name = 'brand_id'")?
        .query_row([], |row| row.get::<_, i32>(0))
        .map(|c| c > 0)
        .unwrap_or(false);

    if !has_brand_id {
        conn.execute_batch("ALTER TABLE audiences ADD COLUMN brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL")?;
    }

    // Create index after ensuring column exists
    conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_audiences_brand_id ON audiences(brand_id)")?;

    // Create influencer_brands junction table if it doesn't exist
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS influencer_brands (
            influencer_id TEXT NOT NULL,
            brand_id TEXT NOT NULL,
            mention_count INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (influencer_id, brand_id),
            FOREIGN KEY (influencer_id) REFERENCES influencers(id) ON DELETE CASCADE,
            FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_influencer_brands_influencer_id ON influencer_brands(influencer_id);
        CREATE INDEX IF NOT EXISTS idx_influencer_brands_brand_id ON influencer_brands(brand_id);"
    )?;

    Ok(())
}
