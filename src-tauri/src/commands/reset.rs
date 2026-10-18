use tauri::State;

use crate::AppState;

#[tauri::command]
pub async fn reset_application(state: State<'_, AppState>) -> Result<(), String> {
    state
        .db
        .with_conn(|conn| {
            // Disable foreign keys temporarily for clean deletion
            conn.execute_batch("PRAGMA foreign_keys = OFF;")?;

            // Delete from junction/child tables first, then parent tables
            conn.execute_batch(
                "
                DELETE FROM audience_members;
                DELETE FROM author_subreddits;
                DELETE FROM brand_subreddits;
                DELETE FROM influencer_brands;
                DELETE FROM brand_analyses;
                DELETE FROM mentions;
                DELETE FROM pricing_calculations;
                DELETE FROM reports;
                DELETE FROM competitors;
                DELETE FROM influencers;
                DELETE FROM authors;
                DELETE FROM audiences;
                DELETE FROM subreddits;
                DELETE FROM jobs;
                DELETE FROM brands;
                ",
            )?;

            // Re-enable foreign keys
            conn.execute_batch("PRAGMA foreign_keys = ON;")?;

            Ok(())
        })
        .map_err(|e| e.to_string())
}
