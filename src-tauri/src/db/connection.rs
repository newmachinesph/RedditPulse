use parking_lot::Mutex;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Arc;

use super::schema::{init_schema, run_migrations};

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Failed to get app data directory")]
    NoDataDir,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type DbResult<T> = Result<T, DbError>;

/// Thread-safe database wrapper
#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Create a new database connection
    pub fn new() -> DbResult<Self> {
        let db_path = Self::get_db_path()?;

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path)?;

        // Enable foreign keys
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        // Initialize schema
        init_schema(&conn)?;

        // Run migrations for existing databases
        run_migrations(&conn)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Get the database file path.
    fn get_db_path() -> DbResult<PathBuf> {
        let data_dir = dirs::data_local_dir().ok_or(DbError::NoDataDir)?;
        Ok(data_dir.join("redditpulse").join("data.db"))
    }

    /// Execute a function with the database connection
    pub fn with_conn<F, T>(&self, f: F) -> DbResult<T>
    where
        F: FnOnce(&Connection) -> rusqlite::Result<T>,
    {
        let conn = self.conn.lock();
        f(&conn).map_err(DbError::from)
    }

    /// Execute a function with a mutable database connection
    pub fn with_conn_mut<F, T>(&self, f: F) -> DbResult<T>
    where
        F: FnOnce(&mut Connection) -> rusqlite::Result<T>,
    {
        let mut conn = self.conn.lock();
        f(&mut conn).map_err(DbError::from)
    }
}
