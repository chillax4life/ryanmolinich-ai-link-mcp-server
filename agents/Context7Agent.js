/**
 * Context7Agent.js
 * 
 * Specialized agent for managing project-wide context using Upstash Context7.
 * Helps the AI Swarm understand library documentation and internal codebase context.
 */
import { Agent } from './AgentFramework.js';

export class Context7Agent extends Agent {
    constructor(config) {
        super(config);
        this.capabilities = ['context-retrieval', 'documentation-search', 'rag-provider'];
        this.libraryIds = {
            'ai-link': 'chillax4life/ai-link-mcp-server',
            'solana-arb': 'chillax4life/solana-arbitrage',
            'pocket-options': 'chillax4life/pocket-options-bot'
        };
    }

    async processRequest(prompt, metadata) {
        const lower = prompt.toLowerCase();

        // 1. Documentation Query
        if (lower.includes('docs') || lower.includes('how to use')) {
            const projectMatch = Object.keys(this.libraryIds).find(p => lower.includes(p));
            if (projectMatch) {
                const libId = this.libraryIds[projectMatch];
                try {
                    // Note: These tool calls assume the MCP server is available to the swarm
                    const docs = await this.callTool('query-docs', { libraryId: libId });
                    return `### 📚 Documentation for ${projectMatch}\n\n${docs}\n\n*Retrieved via Context7 MCP*`;
                } catch (e) {
                    return `I couldn't find documentation for ${projectMatch} on Context7 yet. Should I initialize the index?`;
                }
            }
        }

        // 2. Hardware/System Context Integration
        if (lower.includes('hardware') || lower.includes('cooling') || lower.includes('system health')) {
            // Retrieve shared context about the hardware state
            const systemContext = await this.callTool('get_shared_context', {
                contextId: 'hardware-state',
                aiId: this.aiId
            }).catch(() => null);

            if (!systemContext) {
                return "Hardware context is not yet shared. Please have the IntegratorAgent update the 'hardware-state' context.";
            }

            return `### 🖥️ Hardware State\n\n${systemContext}\n\n*Ensuring no conflicts with trading execution.*`;
        }

        return "I am the Context7 Agent. I provide documentation and system-wide context to the AI Swarm. Try asking for 'docs for solana-arb'.";
    }
}
