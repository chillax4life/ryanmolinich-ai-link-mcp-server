use scanner_bot::ScannerBot;
use rpc_manager::RpcManager;
use anyhow::Result;
use tracing_subscriber;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Load environment variables
    dotenvy::dotenv().ok();

    // Parse configuration from environment
    let helius_keys: Vec<String> = std::env::var("HELIUS_API_KEYS")
        .unwrap_or_else(|_| String::new())
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if helius_keys.is_empty() {
        eprintln!("⚠️  WARNING: No HELIUS_API_KEYS found in .env, using fallback endpoints only");
    }

    let min_profit_bps: u64 = std::env::var("MIN_PROFIT_BPS")
        .unwrap_or_else(|_| "3".to_string())
        .parse()?;

    let scan_interval_ms: u64 = std::env::var("SCAN_INTERVAL_MS")
        .unwrap_or_else(|_| "1500".to_string())
        .parse()?;

    // Initialize RPC manager
    let rpc_manager = RpcManager::new(helius_keys);

    // Create and run scanner bot
    let scanner = ScannerBot::new(rpc_manager, min_profit_bps, scan_interval_ms);
    
    println!("🚀 Flash Arbitrage Scanner Bot v0.1.0");
    println!("   Min Profit: {} bps ({}%)", min_profit_bps, min_profit_bps as f64 / 100.0);
    println!("   Scan Rate: {}ms", scan_interval_ms);
    println!();

    scanner.run().await
}
