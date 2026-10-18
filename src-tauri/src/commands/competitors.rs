use serde::Deserialize;
use tauri::State;

use crate::db::queries::competitors::{
    Competitor, CompetitorWithBrand, CreateCompetitorInput,
};
use crate::AppState;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddCompetitorInput {
    pub brand_id: String,
    pub competitor_brand_id: String,
    pub relationship: Option<String>,
}

#[tauri::command]
pub fn add_competitor(
    state: State<'_, AppState>,
    input: AddCompetitorInput,
) -> Result<Competitor, String> {
    // Prevent adding self as competitor
    if input.brand_id == input.competitor_brand_id {
        return Err("Cannot add a brand as its own competitor".to_string());
    }

    // Check if already exists
    let exists = state
        .db
        .with_conn(|conn| {
            crate::db::queries::competitors::check_competitor_exists(
                conn,
                &input.brand_id,
                &input.competitor_brand_id,
            )
        })
        .map_err(|e| e.to_string())?;

    if exists {
        return Err("This competitor relationship already exists".to_string());
    }

    let create_input = CreateCompetitorInput {
        brand_id: input.brand_id,
        competitor_brand_id: input.competitor_brand_id,
        relationship: input.relationship,
    };

    state
        .db
        .with_conn(|conn| crate::db::queries::competitors::add_competitor(conn, &create_input))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_competitors_for_brand(
    state: State<'_, AppState>,
    brand_id: String,
) -> Result<Vec<CompetitorWithBrand>, String> {
    state
        .db
        .with_conn(|conn| crate::db::queries::competitors::get_competitors_for_brand(conn, &brand_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_competitors(
    state: State<'_, AppState>,
) -> Result<Vec<CompetitorWithBrand>, String> {
    state
        .db
        .with_conn(|conn| crate::db::queries::competitors::get_all_competitor_pairs(conn))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_competitor(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    state
        .db
        .with_conn(|conn| crate::db::queries::competitors::remove_competitor(conn, &id))
        .map_err(|e| e.to_string())
}
