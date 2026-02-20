use crate::pool_graph::PoolEdge;
use solana_sdk::pubkey::Pubkey;

pub struct RouteOptimizer {}

impl RouteOptimizer {
    pub fn new() -> Self {
        Self {}
    }

    /// Simulates a trade through a sequence of pools to calculate the final output amount.
    /// amount_in is the starting amount of the first token in the route.
    pub fn calculate_output_amount(
        &self,
        route: &Vec<(Pubkey, PoolEdge)>,
        amount_in: u64,
    ) -> u64 {
        let mut current_amount = amount_in;

        for (from_token, pool) in route {
            // Constant Product: (reserve_in * reserve_out) = (reserve_in + amount_in) * (reserve_out - amount_out)
            // amount_out = (amount_in * reserve_out) / (reserve_in + amount_in)
            
            let (reserve_in, reserve_out) = if *from_token == pool.token_a {
                (pool.reserve_a, pool.reserve_b)
            } else {
                (pool.reserve_b, pool.reserve_a)
            };

            if reserve_in == 0 || reserve_out == 0 {
                return 0;
            }

            // Apply fee
            let amount_after_fee = (current_amount as u128 * (10000 - pool.fee_bps as u128)) / 10000;
            
            // Calculate output
            let numerator = amount_after_fee * reserve_out as u128;
            let denominator = reserve_in as u128 + amount_after_fee;
            
            current_amount = (numerator / denominator) as u64;
        }

        current_amount
    }

    /// Compare multiple routes and find the one that yields the most output tokens.
    pub fn find_best_route<'a>(
        &self,
        routes: Vec<Vec<(Pubkey, PoolEdge)>>,
        amount_in: u64,
    ) -> Option<(usize, u64)> {
        let mut best_index = None;
        let mut max_output = 0;

        for (i, route) in routes.iter().enumerate() {
            let output = self.calculate_output_amount(route, amount_in);
            if output > max_output {
                max_output = output;
                best_index = Some(i);
            }
        }

        best_index.map(|i| (i, max_output))
    }
}
