use anyhow::Result;
use solana_sdk::pubkey::Pubkey;
use solana_client::nonblocking::rpc_client::RpcClient;

// Use the orca client crate
use orca_whirlpools_client::{Whirlpool, WHIRLPOOL_ID};

pub struct OrcaClient {}

impl OrcaClient {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn get_whirlpool_price(&self, rpc: &RpcClient, pool_address: &Pubkey) -> Result<f64> {
        let account_data = rpc.get_account_data(pool_address).await?;
        
        // Deserialize using the SDK
        // Note: In real logic, we'd check owner == standard Whirlpool Program ID
        use anchor_lang::AccountDeserialize;
        let pool = Whirlpool::try_deserialize(&mut account_data.as_slice())?;

        // Price from sqrt_price
        // Price = (sqrt_price / 2^64)^2
        let sqrt_price_x64 = pool.sqrt_price;
        let price = (sqrt_price_x64 as f64 / ((1u128 << 64) as f64)).powi(2);

        Ok(price)
    }
}
