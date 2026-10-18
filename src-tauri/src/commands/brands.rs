use tauri::State;

use crate::db::queries::brands as brand_queries;
use crate::models::{Brand, CreateBrandInput, UpdateBrandInput};
use crate::AppState;

#[tauri::command]
pub fn get_all_brands(state: State<AppState>) -> Result<Vec<Brand>, String> {
    state
        .db
        .with_conn(|conn| brand_queries::get_all_brands(conn))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_brand(state: State<AppState>, id: String) -> Result<Option<Brand>, String> {
    state
        .db
        .with_conn(|conn| brand_queries::get_brand(conn, &id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_brand(state: State<AppState>, input: CreateBrandInput) -> Result<Brand, String> {
    if input.name.len() > 100 {
        return Err("Brand name must be 100 characters or fewer.".to_string());
    }
    if let Some(ref desc) = input.description {
        if desc.len() > 500 {
            return Err("Brand description must be 500 characters or fewer.".to_string());
        }
    }

    state
        .db
        .with_conn(|conn| brand_queries::create_brand(conn, &input))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_brand(state: State<AppState>, id: String, input: UpdateBrandInput) -> Result<Option<Brand>, String> {
    state
        .db
        .with_conn(|conn| brand_queries::update_brand(conn, &id, &input))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_brand(state: State<AppState>, id: String) -> Result<bool, String> {
    state
        .db
        .with_conn(|conn| brand_queries::delete_brand(conn, &id))
        .map_err(|e| e.to_string())
}
