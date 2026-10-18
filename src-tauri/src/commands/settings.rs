use tauri::State;

use crate::db::queries::settings as settings_queries;
use crate::models::Settings;
use crate::AppState;

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<Settings, String> {
    state
        .db
        .with_conn(|conn| settings_queries::load_settings(conn))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_settings(state: State<AppState>, settings: Settings) -> Result<(), String> {
    state
        .db
        .with_conn(|conn| settings_queries::save_settings(conn, &settings))
        .map_err(|e| e.to_string())
}
