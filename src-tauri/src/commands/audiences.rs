use serde::Deserialize;
use tauri::State;

use crate::db::queries::audiences::{
    add_audience_member, clear_audience_members, create_audience, delete_audience,
    get_all_audiences, get_audience_by_id, get_audience_members, get_matching_authors,
    remove_audience_member, update_audience, update_audience_member_count,
    Audience, AudienceFilters, AudienceMember, CreateAudienceInput, UpdateAudienceInput,
};
use crate::AppState;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAudienceCommandInput {
    pub name: String,
    pub description: Option<String>,
    pub brand_id: Option<String>,
    pub filters: AudienceFilters,
}

#[tauri::command]
pub fn create_audience_cmd(
    state: State<'_, AppState>,
    input: CreateAudienceCommandInput,
) -> Result<Audience, String> {
    // First, check if we have any authors - if not, run influencer discovery
    let author_count = state
        .db
        .with_conn(|conn| {
            conn.query_row::<i32, _, _>("SELECT COUNT(*) FROM authors", [], |row| row.get(0))
        })
        .unwrap_or(0);

    if author_count == 0 {
        // Auto-discover influencers from brand analyses
        let _ = crate::commands::discover_influencers(state.clone());
    }

    let create_input = CreateAudienceInput {
        name: input.name,
        description: input.description,
        brand_id: input.brand_id,
        filters: input.filters.clone(),
    };

    // Create audience
    let audience = state
        .db
        .with_conn(|conn| create_audience(conn, &create_input))
        .map_err(|e| e.to_string())?;

    // Find matching authors and add them
    let members = state
        .db
        .with_conn(|conn| get_matching_authors(conn, &input.filters))
        .map_err(|e| e.to_string())?;

    let member_count = members.len() as i32;

    // Add members to audience
    for (author_id, _, _, _, _) in &members {
        let _ = state.db.with_conn(|conn| add_audience_member(conn, &audience.id, author_id));
    }

    // Update member count
    let _ = state
        .db
        .with_conn(|conn| update_audience_member_count(conn, &audience.id, member_count));

    // Return updated audience
    state
        .db
        .with_conn(|conn| get_audience_by_id(conn, &audience.id))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to retrieve created audience".to_string())
}

#[tauri::command]
pub fn get_audiences(state: State<'_, AppState>) -> Result<Vec<Audience>, String> {
    state
        .db
        .with_conn(|conn| get_all_audiences(conn))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_audience(state: State<'_, AppState>, id: String) -> Result<Option<Audience>, String> {
    state
        .db
        .with_conn(|conn| get_audience_by_id(conn, &id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_audience_members_cmd(
    state: State<'_, AppState>,
    audience_id: String,
) -> Result<Vec<AudienceMember>, String> {
    state
        .db
        .with_conn(|conn| get_audience_members(conn, &audience_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_audience_member_cmd(
    state: State<'_, AppState>,
    audience_id: String,
    author_id: String,
) -> Result<bool, String> {
    let removed = state
        .db
        .with_conn(|conn| remove_audience_member(conn, &audience_id, &author_id))
        .map_err(|e| e.to_string())?;

    if removed {
        // Update member count
        let members = state
            .db
            .with_conn(|conn| get_audience_members(conn, &audience_id))
            .map_err(|e| e.to_string())?;

        let _ = state
            .db
            .with_conn(|conn| update_audience_member_count(conn, &audience_id, members.len() as i32));
    }

    Ok(removed)
}

#[tauri::command]
pub fn delete_audience_cmd(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    state
        .db
        .with_conn(|conn| delete_audience(conn, &id))
        .map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAudienceCommandInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub brand_id: Option<Option<String>>,
    pub filters: Option<AudienceFilters>,
}

#[tauri::command]
pub fn update_audience_cmd(
    state: State<'_, AppState>,
    id: String,
    input: UpdateAudienceCommandInput,
) -> Result<Option<Audience>, String> {
    let filters_changed = input.filters.is_some();
    let new_filters = input.filters.clone();

    let update_input = UpdateAudienceInput {
        name: input.name,
        description: input.description,
        brand_id: input.brand_id,
        filters: input.filters,
    };

    state
        .db
        .with_conn(|conn| update_audience(conn, &id, &update_input))
        .map_err(|e| e.to_string())?;

    // Re-match members when filters changed
    if filters_changed {
        if let Some(filters) = new_filters {
            // Clear old members and re-populate
            let _ = state.db.with_conn(|conn| clear_audience_members(conn, &id));

            let members = state
                .db
                .with_conn(|conn| get_matching_authors(conn, &filters))
                .map_err(|e| e.to_string())?;

            let member_count = members.len() as i32;

            for (author_id, _, _, _, _) in &members {
                let _ = state.db.with_conn(|conn| add_audience_member(conn, &id, author_id));
            }

            let _ = state
                .db
                .with_conn(|conn| update_audience_member_count(conn, &id, member_count));
        }
    }

    state
        .db
        .with_conn(|conn| get_audience_by_id(conn, &id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn refresh_audience(state: State<'_, AppState>, id: String) -> Result<Audience, String> {
    // First, refresh influencer discovery to catch any new posts
    let _ = crate::commands::discover_influencers(state.clone());

    // Get current audience
    let audience = state
        .db
        .with_conn(|conn| get_audience_by_id(conn, &id))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Audience not found".to_string())?;

    // Clear old members and re-match based on current filters
    let _ = state.db.with_conn(|conn| clear_audience_members(conn, &id));

    let members = state
        .db
        .with_conn(|conn| get_matching_authors(conn, &audience.filters))
        .map_err(|e| e.to_string())?;

    let member_count = members.len() as i32;

    for (author_id, _, _, _, _) in &members {
        let _ = state.db.with_conn(|conn| add_audience_member(conn, &id, author_id));
    }

    let _ = state
        .db
        .with_conn(|conn| update_audience_member_count(conn, &id, member_count));

    // Return updated audience
    state
        .db
        .with_conn(|conn| get_audience_by_id(conn, &id))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to retrieve audience".to_string())
}
