use mcp_rust_sdk::client::Client;
use mcp_rust_sdk::transport::stdio::StdioTransport;
use serde_json::json;
use std::sync::Arc;
use log::{info, error};

pub async fn broadcast_opportunity_to_ai_link(opportunity_json: String) -> anyhow::Result<()> {
    info!("[AI-Link] Broadcasting opportunity...");

    // 1. Initialize the transport. It returns the transport and a message receiver.
    let (transport, _rx) = StdioTransport::new();
    let transport = Arc::new(transport);

    // 2. Initialize the MCP Client
    let client = Client::new(transport);

    // 3. Call the 'submit_task' tool using the 'request' method.
    let task_params = json!({
        "description": format!("Arbitrage Opportunity Found: {}", opportunity_json),
        "requiredCapabilities": ["arbitrage-execution", "flash-loan"]
    });
    
    let response = client.request(
        "tool/call", 
        Some(json!({
            "tool_name": "submit_task",
            "arguments": task_params
        }))
    ).await?;
    
    info!("[AI-Link] Task submission response: {:?}", response);

    // 4. Disconnect is handled by dropping the client and transport.
    info!("[AI-Link] Broadcast complete.");

    Ok(())
}
