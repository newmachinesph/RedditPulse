use reqwest::{Client, Proxy};
use thiserror::Error;

use crate::models::ProxySettings;

#[derive(Debug, Error)]
pub enum ProxyError {
    #[error("Failed to build proxy: {0}")]
    Build(String),
    #[error("Failed to create client: {0}")]
    Client(#[from] reqwest::Error),
}

/// Configuration for a single proxy
#[derive(Debug, Clone)]
pub struct ProxyConfig {
    pub server: String,
    pub protocol: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

impl ProxyConfig {
    pub fn from_settings(settings: &ProxySettings) -> Option<Self> {
        if !settings.enabled || settings.server.is_empty() {
            return None;
        }

        Some(Self {
            server: settings.server.clone(),
            protocol: settings.protocol.clone(),
            username: if settings.username.is_empty() {
                None
            } else {
                Some(settings.username.clone())
            },
            password: if settings.password.is_empty() {
                None
            } else {
                Some(settings.password.clone())
            },
        })
    }

    /// Build the proxy URL
    ///
    /// Returns an error if the protocol is not one of the allowed values.
    pub fn to_url(&self) -> Result<String, ProxyError> {
        // Validate protocol to prevent injection via arbitrary scheme
        let protocol = match self.protocol.as_str() {
            "http" | "https" | "socks5" => self.protocol.as_str(),
            _ => {
                return Err(ProxyError::Build(format!(
                    "Invalid proxy protocol '{}': must be http, https, or socks5",
                    self.protocol
                )));
            }
        };

        // URL-encode username and password to prevent injection through
        // special characters like @, :, or /
        let auth = match (&self.username, &self.password) {
            (Some(user), Some(pass)) => {
                let encoded_user = urlencoding::encode(user);
                let encoded_pass = urlencoding::encode(pass);
                format!("{}:{}@", encoded_user, encoded_pass)
            }
            (Some(user), None) => {
                let encoded_user = urlencoding::encode(user);
                format!("{}@", encoded_user)
            }
            _ => String::new(),
        };

        Ok(format!("{}://{}{}", protocol, auth, self.server))
    }
}

/// Pool for managing proxy connections
pub struct ProxyPool {
    config: Option<ProxyConfig>,
}

impl ProxyPool {
    pub fn new(config: Option<ProxyConfig>) -> Self {
        Self { config }
    }

    pub fn from_settings(settings: &ProxySettings) -> Self {
        Self::new(ProxyConfig::from_settings(settings))
    }

    /// Check if proxy is configured
    pub fn is_configured(&self) -> bool {
        self.config.is_some()
    }

    /// Create a reqwest Client with proxy configured
    pub fn create_client(&self) -> Result<Client, ProxyError> {
        let mut builder = Client::builder();

        if let Some(config) = &self.config {
            let proxy_url = config.to_url()?;
            let proxy = Proxy::all(&proxy_url)
                .map_err(|e| ProxyError::Build(e.to_string()))?;
            builder = builder.proxy(proxy);
        }

        builder.build().map_err(ProxyError::Client)
    }

    /// Get external IP through proxy (useful for verification)
    pub async fn get_external_ip(&self) -> Result<String, ProxyError> {
        let client = self.create_client()?;

        let response = client
            .get("https://httpbin.org/ip")
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .map_err(ProxyError::Client)?;

        let json: serde_json::Value = response.json().await.map_err(ProxyError::Client)?;

        Ok(json["origin"]
            .as_str()
            .unwrap_or("unknown")
            .to_string())
    }
}
