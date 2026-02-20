use petgraph::graph::{DiGraph, NodeIndex};
use petgraph::algo::astar;
use solana_sdk::pubkey::Pubkey;
use std::collections::HashMap;
use anyhow::Result;

/// Supported DEX Types
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DexType {
    RaydiumV4,
    RaydiumCPMM,
    RaydiumCLMM,
    OrcaWhirlpool,
    MeteoraDLMM,
}

/// Represents a liquidity pool (Edge in the Graph)
#[derive(Debug, Clone)]
pub struct PoolEdge {
    pub pool_address: Pubkey,
    pub dex_type: DexType,
    pub token_a: Pubkey,
    pub token_b: Pubkey,
    pub reserve_a: u64,
    pub reserve_b: u64,
    pub fee_bps: u16,
}

impl PoolEdge {
    /// Calculate estimated slippage/price impact as an edge weight.
    /// Lower weight = better price.
    /// Weight = -ln(output_amount / input_amount) or similar.
    /// For A*, we need non-negative weights. Let's use % price impact.
    pub fn calculate_weight(&self, from_token: &Pubkey, amount_in: u64) -> f64 {
        if amount_in == 0 { return 0.0; }

        let (reserve_in, _reserve_out) = if *from_token == self.token_a {
            (self.reserve_a, self.reserve_b)
        } else {
            (self.reserve_b, self.reserve_a)
        };

        if reserve_in == 0 { return f64::MAX; }

        // Simple Constant Product Price Impact: amount_in / (reserve_in + amount_in)
        // This is a rough heuristic for the cost of moving through this pool.
        let price_impact = (amount_in as f64) / (reserve_in as f64 + amount_in as f64);
        
        // Add fee as a constant penalty (e.g. 0.3% = 0.003)
        let fee_impact = (self.fee_bps as f64) / 10000.0;
        
        price_impact + fee_impact
    }
}

/// Pool graph where Nodes are Tokens and Edges are Pools
pub struct PoolGraph {
    graph: DiGraph<Pubkey, PoolEdge>,
    token_to_node: HashMap<Pubkey, NodeIndex>,
}

impl PoolGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            token_to_node: HashMap::new(),
        }
    }

    fn get_or_create_node(&mut self, token: Pubkey) -> NodeIndex {
        if let Some(&idx) = this.token_to_node.get(&token) {
            idx
        } else {
            let idx = this.graph.add_node(token);
            this.token_to_node.insert(token, idx);
            idx
        }
    }

    /// Add a pool as two directed edges (A->B and B->A)
    pub fn add_pool(
        &mut self,
        pool_address: Pubkey,
        token_a: Pubkey,
        token_b: Pubkey,
        reserve_a: u64,
        reserve_b: u64,
        dex_type: DexType,
        fee_bps: u16,
    ) {
        let node_a = self.get_or_create_node(token_a);
        let node_b = self.get_or_create_node(token_b);

        let edge = PoolEdge {
            pool_address,
            dex_type,
            token_a,
            token_b,
            reserve_a,
            reserve_b,
            fee_bps,
        };

        // Add both directions
        self.graph.add_edge(node_a, node_b, edge.clone());
        self.graph.add_edge(node_b, node_a, edge);
    }

    /// Find optimal route between two tokens using A* algorithm
    pub fn find_route(
        &self,
        from_token: &Pubkey,
        to_token: &Pubkey,
        amount_in: u64,
    ) -> Result<Vec<(Pubkey, PoolEdge)>> {
        let start_idx = self.token_to_node.get(from_token)
            .ok_or_else(|| anyhow::anyhow!("Start token not in graph"))?;
        
        let end_idx = self.token_to_node.get(to_token)
            .ok_or_else(|| anyhow::anyhow!("End token not in graph"))?;

        // A* search for minimum cost (slippage + fees)
        let result = astar(
            &self.graph,
            *start_idx,
            |finish| finish == *end_idx,
            |e| {
                let edge_data = e.weight();
                let source_token = self.graph[e.source()];
                edge_data.calculate_weight(&source_token, amount_in)
            },
            |_| 0.0, // Heuristic: 0.0 makes it Dijkstra (safe)
        );

        if let Some((_cost, path)) = result {
            let mut route = Vec::new();
            for i in 0..path.len() - 1 {
                let u = path[i];
                let v = path[i+1];
                let edge_idx = self.graph.find_edge(u, v)
                    .ok_or_else(|| anyhow::anyhow!("Edge lost in path"))?;
                let edge = self.graph[edge_idx].clone();
                route.push((self.graph[u], edge));
            }
            Ok(route)
        } else {
            Err(anyhow::anyhow!("No route found"))
        }
    }

    /// Update pool reserves (High frequency update)
    pub fn update_reserves(
        &mut self,
        pool_address: &Pubkey,
        reserve_a: u64,
        reserve_b: u64,
    ) -> Result<()> {
        let mut found = false;
        for edge_idx in self.graph.edge_indices() {
            let edge = &mut self.graph[edge_idx];
            if edge.pool_address == *pool_address {
                edge.reserve_a = reserve_a;
                edge.reserve_b = reserve_b;
                found = true;
            }
        }
        if found { Ok(()) } else { Err(anyhow::anyhow!("Pool not found")) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routing() {
        let mut graph = PoolGraph::new();
        let sol = Pubkey::new_unique();
        let usdc = Pubkey::new_unique();
        let usdt = Pubkey::new_unique();

        // Add SOL -> USDC pool
        graph.add_pool(
            Pubkey::new_unique(),
            sol,
            usdc,
            1_000_000_000,
            150_000_000,
            DexType::RaydiumV4,
            30
        );

        // Add USDC -> USDT pool
        graph.add_pool(
            Pubkey::new_unique(),
            usdc,
            usdt,
            1_000_000_000,
            1_000_000_000,
            DexType::RaydiumV4,
            1
        );

        let route = graph.find_route(&sol, &usdt, 10_000_000).unwrap();
        assert_eq!(route.len(), 2);
        assert_eq!(route[0].0, sol);
        assert_eq!(route[1].0, usdc);
    }
}
