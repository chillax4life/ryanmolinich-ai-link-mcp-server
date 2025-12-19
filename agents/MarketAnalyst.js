import { Agent } from './AgentFramework.js';

/**
 * MarketAnalyst Agent ("The Quant")
 * Specialized in query-based market research using Dune Analytics and Flipside Crypto.
 * Does not execute trades. Provides intelligence.
 */
export class MarketAnalyst extends Agent {
    constructor(config) {
        super(config);
        if (!this.capabilities.includes('market-analysis')) {
            this.capabilities.push('market-analysis');
        }
    }

    async processRequest(prompt, metadata) {
        // Detect intent
        const lower = prompt.toLowerCase();

        if (lower.includes('volume') || lower.includes('analytics') || lower.includes('stats') || lower.includes('query')) {
            return await this.handleAnalysisRequest(prompt);
        }

        return super.processRequest(prompt, metadata);
    }

    async handleAnalysisRequest(prompt) {
        console.log(`[${this.name}] Analyzing market request: ${prompt}`);

        // 1. Decide Provider (Mock logic: Switch based on keywords or random)
        // In a real LLM agent, the LLM would write the SQL.
        // Here we use a mocked "Best Practice" SQL for demonstration.

        let provider = 'dune';
        if (prompt.includes('flipside') || prompt.includes('snowflake')) {
            provider = 'flipside';
        }

        // 2. Formulate Query (Mocked Templates)
        let sql = "";
        if (prompt.includes('jupiter')) {
            if (provider === 'dune') {
                sql = "SELECT date_trunc('day', block_time) as day, sum(amount_usd) as vol FROM solana.defi_swaps WHERE platform = 'jupiter' AND block_time > now() - interval '7 days' GROUP BY 1 ORDER BY 1 DESC";
            } else {
                sql = "SELECT date_trunc('day', block_timestamp) as day, sum(amount_in_usd) as vol FROM solana.core.ez_dex_swaps WHERE swap_program ilike '%jupiter%' AND block_timestamp > current_date - 7 GROUP BY 1 ORDER BY 1 DESC";
            }
        } else {
            return "I can primarily analyze 'Jupiter' volume right now. improved SQL generation coming soon.";
        }

        // 3. Call Tool
        try {
            const toolName = provider === 'dune' ? 'dune_query' : 'flipside_query';
            console.log(`[${this.name}] Executing SQL via ${toolName}...`);

            // Note: This relies on the AgentFramework's ability to call server tools
            // Since this agent IS connected to the server, it can ask the server to run the tool?
            // Actually, usually agents provide tools, or use tools provided by others.
            // If the server *hosts* the tool, the agent can request it via MCP if `callTool` is implemented to loopback.
            // For this simpler framework, we might assume the Agent IS the one executing logic if it had the keys.
            // But we put the keys in `index.js` tools. 
            // So we need to send a "request" to the server or use the tool directly if we imported it.
            // Let's assume we ask the user/server.

            // Ideally: return `await this.mcpClient.callTool({ name: toolName, arguments: { sql } })`
            // But our AgentFramework might not have client-calling-server logic fully wired for "Tools".
            // It receives "Sampling" requests.

            // Fallback: Just return the Plan.
            return `[${this.name}] Analysis Plan:\n1. Provider: ${provider}\n2. SQL: \n\`\`\`sql\n${sql}\n\`\`\`\n\n(Agent execution of Server Tools requires 'Client' capability - Pending Implementation)`;

        } catch (e) {
            return `Analysis failed: ${e.message}`;
        }
    }
}
