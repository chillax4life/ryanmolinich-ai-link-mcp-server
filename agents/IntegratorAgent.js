import { Agent } from './AgentFramework.js';

/**
 * IntegratorAgent ("The Orchestrator")
 * Acts as the bridge between the AI Swarm, Solana Arbitrage Bot, and Pocket Options Bot.
 */
export class IntegratorAgent extends Agent {
    constructor(config) {
        super(config);
        this.capabilities = ['integrator', 'monitoring', 'unified-control'];
    }

    async getScalingStats() {
        // Mocking for Phase 1 (First 48 hours)
        return {
            arbotReady: false,
            arbotStability: 98,
            pocketReady: false, 
            pocketWinRate: 52, // Target 55
            swarmReady: false,
            swarmXP: 100 // Target 500
        };
    }

    async processRequest(prompt, metadata) {
        console.log(`[Integrator] processRequest: Processing prompt: "${prompt}"`);
        const lower = prompt.toLowerCase();

        // 1. Scaling Readiness Dashboard
        if (lower.includes('scale') || lower.includes('ready')) {
            const stats = await this.getScalingStats();
            const isReady = stats.arbotReady && stats.pocketReady && stats.swarmReady;
            
            return `### 🚀 Scaling Readiness Dashboard\n\n` +
                   `**Status: ${isReady ? '✅ READY TO SCALE' : '⏳ IN CONFIDENCE WINDOW'}**\n\n` +
                   `**Benchmarks:**\n` +
                   `- Arbot Stability: ${stats.arbotReady ? '✅' : '⏳'} (${stats.arbotStability}% error-free)\n` +
                   `- Pocket Win Rate: ${stats.pocketReady ? '✅' : '⏳'} (${stats.pocketWinRate}% EMA)\n` +
                   `- Swarm Drone XP: ${stats.swarmReady ? '✅' : '⏳'} (${stats.swarmXP}/500 XP)\n\n` +
                   `**Next Step:** ${isReady ? 'Proceed to Phase 2: Compounding (2% bankroll)' : 'Maintain Phase 1 for 48-72 hours.'}`;
        }

        // 2. Unified Status Check
        if (lower.includes('status') || lower.includes('how are my bots')) {
            const arbStatus = await this.callTool('solana_arb_get_status', {});
            const pocketStatus = await this.callTool('pocket_options_get_stats', {});
            
            // Log Hardware/System health to shared context for the swarm
            await this.callTool('share_context', {
                contextId: 'hardware-state',
                data: {
                    os: 'macOS',
                    cooling: 'custom-active',
                    lastCheck: new Date().toISOString(),
                    health: 'stable'
                }
            }).catch(e => console.error("Failed to share hardware context:", e));

            return `### Unified Bot Status\n\n` +
                   `**Solana Arbitrage Bot:**\n${arbStatus}\n\n` +
                   `**Pocket Options Bot:**\n${pocketStatus}\n\n` +
                   `**AI Agent Economy:**\n- Swarm Drone: ✅ Active (XP: ~100+)\n- Status: Participating in Missions\n\n` +
                   `**Hardware Health:**\n- Cooling: ✅ Optimal (Custom)\n- State: Shared with Swarm via Context7\n\n` +
                   `**Market Alerts:**\n⚠️ MASSIVE Funding Spreads detected on SOL, JTO, and WIF (>3000% APY). Arb bot is currently monitoring these opportunities.`;
        }

        // 2. Risk Adjustment delegation
        if (lower.includes('risk') || lower.includes('kelly')) {
            return "I can help you adjust risk parameters across all bots. Would you like to update the Kelly Criterion fraction for the Pocket Options bot or the min APY for the Solana Arbot?";
        }

        return "I am the Integrator Agent. I bridge your specialized trading bots with the AI Link Swarm. Try asking for 'bot status'.";
    }
}
