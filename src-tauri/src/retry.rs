use reqwest::Response;
use std::time::Duration;

/// Configuration for retry behavior
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_retries: u32,
    pub initial_delay: Duration,
    pub max_delay: Duration,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(30),
        }
    }
}

/// Determines if a response status code is retryable
fn is_retryable_status(status: reqwest::StatusCode) -> bool {
    status == reqwest::StatusCode::TOO_MANY_REQUESTS
        || status.is_server_error()
}

/// Execute an async operation with exponential backoff retry.
///
/// The closure `f` must return a `Result<Response, reqwest::Error>`.
/// Retries on 429 (rate limited) and 5xx (server error) responses.
/// Respects `Retry-After` header when present.
pub async fn with_retry<F, Fut>(config: &RetryConfig, f: F) -> Result<Response, reqwest::Error>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<Response, reqwest::Error>>,
{
    let mut last_err = None;
    let mut delay = config.initial_delay;

    for attempt in 0..=config.max_retries {
        match f().await {
            Ok(response) => {
                if attempt < config.max_retries && is_retryable_status(response.status()) {
                    // Check for Retry-After header
                    let retry_after = response
                        .headers()
                        .get("retry-after")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|v| v.parse::<u64>().ok())
                        .map(Duration::from_secs);

                    let wait = retry_after.unwrap_or(delay).min(config.max_delay);
                    tokio::time::sleep(wait).await;
                    delay = (delay * 2).min(config.max_delay);
                    continue;
                }
                return Ok(response);
            }
            Err(e) => {
                if attempt < config.max_retries && (e.is_timeout() || e.is_connect()) {
                    last_err = Some(e);
                    tokio::time::sleep(delay).await;
                    delay = (delay * 2).min(config.max_delay);
                    continue;
                }
                return Err(e);
            }
        }
    }

    Err(last_err.expect("retry loop should have set last_err"))
}
