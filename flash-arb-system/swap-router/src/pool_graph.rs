use petgraph::graph::{Graph, NodeIndex};
use petgraph::algo::astar;
use solana_sdk::pubkey::Pubkey;
use std::collections::HashMap;
use anyhow::Result;

/// Represents a liquidity pool in the DEX network
#[derive(Debug, Clone)]
pub struct PoolNode {
    pub pool_address: Pubkey,
    pub token_a: Pubkey,
    pub token_b: Pubkey,
    pub dex_type: DexType,
    pub liquidity_a: u64,
    pub liquidity_b: u64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DexType {
    RaydiumV4,
    RaydiumCPMM,
    RaydiumCLMM,
    OrcaWhirlpool,
    MeteoraDLMM,
}

/// Pool graph for pathfinding across DEXs
pub struct PoolGraph {
    graph: Graph<PoolNode, f64>,
    token_to_nodes: HashMap<Pubkey, Vec<NodeIndex>>,
}

impl PoolGraph {
    pub fn new() -> Self {
        Self {
            graph: Graph::new(),
            token_to_nodes: HashMap::new(),
        }
    }

    /// Add a pool to the graph
    pub fn add_pool(&mut self, pool: PoolNode) -> NodeIndex {
        let node_idx = self.graph.add_node(pool.clone());
        
        self.token_to_nodes
            .entry(pool.token_a)
            .or_insert_with(Vec::new)
            .push(node_idx);
        
        self.token_to_nodes
            .entry(pool.token_b)
            .or_insert_with(Vec::new)
            .push(node_idx);

        node_idx
    }

    /// Find optimal route between two tokens using A* algorithm
    pub fn find_route(
        &self,
        from_token: &Pubkey,
        to_token: &Pubkey,
        amount_in: u64,
    ) -> Result<Vec<PoolNode>> {
        // Get all pools containing from_token
        let start_nodes = self.token_to_nodes
            .get(from_token)
            .ok_or_else(|| anyhow::anyhow!("No pools found for start token"))?;

        let end_nodes = self.token_to_nodes
            .get(to_token)
            .ok_or_else(|| anyhow::anyhow!("No pools found for end token"))?;

        // A* search for minimum slippage path
        // TODO: Implement actual slippage calculation as edge weights
        // For now, using placeholder logic
        
        let mut best_route = None;
        let mut best_score = f64::MAX;

        for &start_idx in start_nodes {
            for &end_idx in end_nodes {
                if let Some((cost, path)) = astar(
                    &self.graph,
                    start_idx,
                    |idx| idx == end_idx,
                    |e| *e.weight(), // Edge weight = estimated slippage
                    |_| 0.0, // Heuristic (can be improved)
                ) {
                    if cost < best_score {
                        best_score = cost;
                        best_route = Some(
                            path.into_iter()
                                .map(|idx| self.graph[idx].clone())
                                .collect::<Vec<_>>()
                        );
                    }
                }
            }
        }

        best_route.ok_or_else(|| anyhow::anyhow!("No path found between tokens"))
    }

    /// Update pool liquidity (called periodically from on-chain data)
    pub fn update_pool_liquidity(
        &mut self,
        pool_address: &Pubkey,
        liquidity_a: u64,
        liquidity_b: u64,
    ) -> Result<()> {
        for node_idx in self.graph.node_indices() {
            if self.graph[node_idx].pool_address == *pool_address {
                let node = &mut self.graph[node_idx];
                node.liquidity_a = liquidity_a;
                node.liquidity_b = liquidity_b;
                return Ok(());
            }
        }
        Err(anyhow::anyhow!("Pool not found: {}", pool_address))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_pool() {
        let mut graph = PoolGraph::new();
        let sol = Pubkey::new_unique();
        let usdc = Pubkey::new_unique();
        
        let pool = PoolNode {
            pool_address: Pubkey::new_unique(),
            token_a: sol,
            token_b: usdc,
            dex_type: DexType::RaydiumV4,
            liquidity_a: 1_000_000,
            liquidity_b: 245_000_000,
        };

        graph.add_pool(pool);
        assert_eq!(graph.graph.node_count(), 1);
    }
}
