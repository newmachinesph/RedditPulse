use rusqlite::{params, Connection};

use crate::models::Settings;

/// Get a setting value by key
pub fn get_setting(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?")?;
    let result = stmt.query_row([key], |row| row.get::<_, String>(0));

    match result {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Set a setting value
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        params![key, value],
    )?;
    Ok(())
}

/// Load all settings from database
pub fn load_settings(conn: &Connection) -> rusqlite::Result<Settings> {
    let json = get_setting(conn, "app_settings")?;

    match json {
        Some(json_str) => {
            serde_json::from_str(&json_str).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })
        }
        None => Ok(Settings::default()),
    }
}

/// Save all settings to database
pub fn save_settings(conn: &Connection, settings: &Settings) -> rusqlite::Result<()> {
    let json = serde_json::to_string(settings).map_err(|e| {
        rusqlite::Error::ToSqlConversionFailure(Box::new(e))
    })?;

    set_setting(conn, "app_settings", &json)
}
