mod analysis;
mod background;
mod commands;
mod csv_sanitize;
mod db;
mod models;
mod proxy;
pub mod retry;
mod scraper;
mod serper;

use background::JobRegistry;
use db::Database;
use reqwest::Client;
use std::sync::Arc;

/// App state containing shared resources
pub struct AppState {
    pub db: Arc<Database>,
    pub http_client: Client,
    pub job_registry: Arc<JobRegistry>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database
    let db = Database::new().expect("Failed to initialize database");

    // Create shared HTTP client with sensible defaults
    let http_client = Client::builder()
        .user_agent("RedditPulse/1.0")
        .timeout(std::time::Duration::from_secs(60))
        .connect_timeout(std::time::Duration::from_secs(10))
        .pool_max_idle_per_host(5)
        .build()
        .expect("Failed to build HTTP client");

    let state = AppState {
        db: Arc::new(db),
        http_client,
        job_registry: Arc::new(JobRegistry::new()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Settings
            commands::get_settings,
            commands::update_settings,
            // Brands
            commands::get_all_brands,
            commands::get_brand,
            commands::create_brand,
            commands::update_brand,
            commands::delete_brand,
            // Search & Scraping
            commands::search_reddit,
            commands::scrape_reddit_post,
            commands::scrape_reddit_posts,
            // Analysis
            commands::analyze_brand_mentions,
            commands::autofill_brand,
            commands::autofill_audience,
            commands::save_brand_analysis,
            commands::get_latest_brand_analysis,
            commands::get_brand_analysis_history,
            commands::delete_brand_analysis,
            commands::get_sentiment_trend,
            commands::get_all_brand_analysis_summaries,
            commands::start_background_analysis,
            // Proxy
            commands::test_proxy,
            // Competitors
            commands::add_competitor,
            commands::get_competitors_for_brand,
            commands::get_all_competitors,
            commands::remove_competitor,
            // Influencers
            commands::discover_influencers,
            commands::get_influencers,
            commands::remove_influencer,
            commands::delete_all_influencers,
            // Audiences
            commands::create_audience_cmd,
            commands::get_audiences,
            commands::get_audience,
            commands::get_audience_members_cmd,
            commands::remove_audience_member_cmd,
            commands::delete_audience_cmd,
            commands::update_audience_cmd,
            commands::refresh_audience,
            // Exports
            commands::export_analysis_csv,
            commands::export_influencers_csv,
            commands::export_audience_csv,
            commands::export_brands_summary_csv,
            // Jobs
            commands::get_all_jobs,
            commands::get_job,
            commands::get_brand_jobs,
            commands::create_job,
            commands::update_job_status,
            commands::update_job_progress,
            commands::update_job_output,
            commands::cancel_job,
            commands::fail_job,
            commands::delete_job,
            commands::delete_all_finished_jobs,
            commands::get_running_job_count,
            // Reset
            commands::reset_application,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
