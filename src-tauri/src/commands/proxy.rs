use serde::Serialize;
use tauri::State;

use crate::proxy::ProxyPool;
use crate::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyTestResponse {
    pub success: bool,
    pub external_ip: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn test_proxy(state: State<'_, AppState>) -> Result<ProxyTestResponse, String> {
    // Get settings
    let settings = state
        .db
        .with_conn(|conn| crate::db::queries::settings::load_settings(conn))
        .map_err(|e| e.to_string())?;

    if !settings.proxy.enabled {
        return Ok(ProxyTestResponse {
            success: false,
            external_ip: None,
            error: Some("Proxy is not enabled in settings".to_string()),
        });
    }

    let proxy_pool = ProxyPool::from_settings(&settings.proxy);

    if !proxy_pool.is_configured() {
        return Ok(ProxyTestResponse {
            success: false,
            external_ip: None,
            error: Some("Proxy server not configured".to_string()),
        });
    }

    match proxy_pool.get_external_ip().await {
        Ok(ip) => Ok(ProxyTestResponse {
            success: true,
            external_ip: Some(ip),
            error: None,
        }),
        Err(e) => Ok(ProxyTestResponse {
            success: false,
            external_ip: None,
            error: Some(e.to_string()),
        }),
    }
}
