use std::collections::HashMap;
use parking_lot::Mutex;
use tokio_util::sync::CancellationToken;

/// Registry that tracks running jobs and their cancellation tokens.
/// This allows the `cancel_job` command to actually stop running tasks.
pub struct JobRegistry {
    tokens: Mutex<HashMap<String, CancellationToken>>,
}

impl JobRegistry {
    pub fn new() -> Self {
        Self {
            tokens: Mutex::new(HashMap::new()),
        }
    }

    /// Register a new job and return its cancellation token.
    pub fn register(&self, job_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        let mut tokens = self.tokens.lock();
        tokens.insert(job_id.to_string(), token.clone());
        token
    }

    /// Cancel a running job by ID.
    /// Returns true if the job was found and cancelled.
    pub fn cancel(&self, job_id: &str) -> bool {
        let tokens = self.tokens.lock();
        if let Some(token) = tokens.get(job_id) {
            token.cancel();
            true
        } else {
            false
        }
    }

    /// Remove a job from the registry (called when job finishes).
    pub fn remove(&self, job_id: &str) {
        let mut tokens = self.tokens.lock();
        tokens.remove(job_id);
    }
}
