use solana_client::rpc_client::RpcClient;
use parking_lot::RwLock;
use std::sync::Arc;
use std::time::{Duration, Instant};
use anyhow::Result;
use tracing::{info, warn};

const MAX_REQUESTS_PER_SECOND: u32 = 50; // Per endpoint
const FALLBACK_ENDPOINTS: &[&str] = &[
    "https://api.devnet.solana.com",
    "https://api.testnet.solana.com",
];

#[derive(Clone)]
pub struct EndpointHealth {
    pub url: String,
    pub request_count: u32,
    pub last_reset: Instant,
    pub consecutive_failures: u32,
    pub is_healthy: bool,
}

impl EndpointHealth {
    fn new(url: String) -> Self {
        Self {
            url,
            request_count: 0,
            last_reset: Instant::now(),
            consecutive_failures: 0,
            is_healthy: true,
        }
    }

    fn should_throttle(&self) -> bool {
        if self.last_reset.elapsed() > Duration::from_secs(1) {
            return false; // Reset period
        }
        self.request_count >= MAX_REQUESTS_PER_SECOND
    }

    fn record_request(&mut self) {
        if self.last_reset.elapsed() > Duration::from_secs(1) {
            self.request_count = 0;
            self.last_reset = Instant::now();
        }
        self.request_count += 1;
    }

    fn record_failure(&mut self) {
        self.consecutive_failures += 1;
        if self.consecutive_failures >= 5 {
            self.is_healthy = false;
            warn!("Marking endpoint {} as unhealthy", self.url);
        }
    }

    fn record_success(&mut self) {
        self.consecutive_failures = 0;
        if !self.is_healthy {
            info!("Endpoint {} back online", self.url);
            self.is_healthy = true;
        }
    }
}

/// Multi-RPC endpoint manager with rate limiting and fallback
pub struct RpcManager {
    endpoints: Arc<RwLock<Vec<EndpointHealth>>>,
    current_index: Arc<RwLock<usize>>,
}

impl RpcManager {
    /// Create new RPC manager with Helius API keys
    pub fn new(helius_api_keys: Vec<String>) -> Self {
        let mut endpoints: Vec<EndpointHealth> = helius_api_keys
            .into_iter()
            .map(|key| {
                EndpointHealth::new(format!("https://mainnet.helius-rpc.com/?api-key={}", key))
            })
            .collect();

        // Add fallback public endpoints
        for &url in FALLBACK_ENDPOINTS {
            endpoints.push(EndpointHealth::new(url.to_string()));
        }

        info!("Initialized RPC manager with {} endpoints", endpoints.len());

        Self {
            endpoints: Arc::new(RwLock::new(endpoints)),
            current_index: Arc::new(RwLock::new(0)),
        }
    }

    /// Get next available RPC client (round-robin with health checks)
    pub fn get_client(&self) -> Result<RpcClient> {
        let endpoints = self.endpoints.read();
        let mut current_idx = self.current_index.write();

        let start_idx = *current_idx;
        let total = endpoints.len();

        loop {
            let endpoint = &endpoints[*current_idx];

            // Check if endpoint is healthy and not throttled
            if endpoint.is_healthy && !endpoint.should_throttle() {
                let url = endpoint.url.clone();
                let selected_idx = *current_idx;
                
                // Update  index for next call
                *current_idx = (*current_idx + 1) % total;
                
                drop(endpoints); // Release read lock
                drop(current_idx); // Release write lock

                // Record request after releasing locks
                self.endpoints.write()[selected_idx].record_request();

                return Ok(RpcClient::new(url));
            }

            // Move to next endpoint
            *current_idx = (*current_idx + 1) % total;

            // If we've checked all endpoints, fail
            if *current_idx == start_idx {
                anyhow::bail!("All RPC endpoints are throttled or unhealthy");
            }
        }
    }

    /// Record successful request to update health stats
    pub fn record_success(&self, endpoint_url: &str) {
        let mut endpoints = self.endpoints.write();
        if let Some(endpoint) = endpoints.iter_mut().find(|e| e.url == endpoint_url) {
            endpoint.record_success();
        }
    }

    /// Record failed request to update health stats
    pub fn record_failure(&self, endpoint_url: &str) {
        let mut endpoints = self.endpoints.write();
        if let Some(endpoint) = endpoints.iter_mut().find(|e| e.url == endpoint_url) {
            endpoint.record_failure();
        }
    }

    /// Get health status of all endpoints
    pub fn health_status(&self) -> Vec<(String, bool, u32)> {
        self.endpoints
            .read()
            .iter()
            .map(|e| (e.url.clone(), e.is_healthy, e.request_count))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rpc_manager() {
        let manager = RpcManager::new(vec!["test-key-1".to_string(), "test-key-2".to_string()]);
        assert_eq!(manager.endpoints.read().len(), 4); // 2 Helius + 2 fallback
    }

    #[test]
    fn test_throttling() {
        let mut health = EndpointHealth::new("test".to_string());
        for _ in 0..MAX_REQUESTS_PER_SECOND {
            health.record_request();
        }
        assert!(health.should_throttle());
    }
}
