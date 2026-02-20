use crate::pool_graph::{PoolGraph, PoolEdge};
use solana_sdk::pubkey::Pubkey;
use anyhow::Result;

pub struct RouteFinder {
    pub graph: PoolGraph,
}

impl RouteFinder {
    pub fn new() -> Self {
        Self {
            graph: PoolGraph::new(),
        }
    }

    /// Finds the best route between two tokens based on liquidity and price impact.
    /// amount_in is the starting amount of the source token.
    pub fn find_optimal_route(
        &self,
        from_token: &Pubkey,
        to_token: &Pubkey,
        amount_in: u64,
    ) -> Result<Vec<(Pubkey, PoolEdge)>> {
        self.graph.find_route(from_token, to_token, amount_in)
    }

    /// Update an existing pool's reserves in the internal graph
    pub fn update_pool_reserves(
        &mut self,
        pool_address: &Pubkey,
        reserve_a: u64,
        reserve_b: u64,
    ) -> Result<()> {
        self.graph.update_reserves(pool_address, reserve_a, reserve_b)
    }
}
