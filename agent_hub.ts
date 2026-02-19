import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GeminiAgent } from "./agents/GeminiAgent.js";
import { Agent } from "./agents/AgentFramework.js";

// --- Configuration ---

const SERVER_SCRIPT_PATH = "index.js"; // Path to the AI Link MCP Server entry point

// Model Routing Strategy:
// - Engineering/code tasks → glm-5 (via OpenCode)
// - Vision/tools/trading → gemini-3-flash (via Google Antigravity)
// - Long context research → kimi-k2.5 (via OpenCode)

const MODEL_ROUTING = {
    engineering: ['rust', 'performance', 'code', 'refactor', 'debug', 'implement', 'fix'],
    trading: ['trade', 'position', 'long', 'short', 'analyze', 'price', 'market', 'signal'],
    research: ['research', 'explain', 'summarize', 'document', 'compare', 'analyze architecture'],
    security: ['audit', 'security', 'hack', 'vulnerability', 'exploit']
};

// --- The Core Hub ---

class AgentHub {
    private client: Client;
    private agents: Map<string, Agent> = new Map();
    private transport: StdioClientTransport;

    constructor() {
        console.log("🌌 Antigravity Agent Hub (v2) Initializing...");

        // 1. Setup Transport to Local Server
        this.transport = new StdioClientTransport({
            command: "node",
            args: [SERVER_SCRIPT_PATH]
        });

        // 2. Setup Client
        this.client = new Client({
            name: "Antigravity-Hub",
            version: "2.0.0"
        }, { capabilities: {} });
    }

    async start() {
        try {
            // Connect to the Server
            await this.client.connect(this.transport);
            console.log("✅ Connected to Local AI Link Server");

            // Register Setup Agents
            await this.setupAgents();

        } catch (error) {
            console.error("❌ Failed to start Hub:", error);
            process.exit(1);
        }
    }

    private async setupAgents() {
        // 1. Visionary (General Gemini)
        const gemini = new GeminiAgent({
            aiId: 'gemini-visionary',
            name: 'Gemini-Visionary',
            capabilities: ['strategy', 'planning', 'general'],
            systemInstruction: "You are the Visionary Strategist for the Antigravity project. You provide high-level architectural advice, trade-off analysis, and creative direction. You think in systems and long-term goals."
        });

        // 2. Rust Expert
        const rustAgent = new GeminiAgent({
            aiId: 'agent-rust',
            name: 'Agent-Rust',
            capabilities: ['rust', 'performance', 'systems'],
            systemInstruction: "You are a World-Class Rust Developer and Performance Architect. You write unsafe code only when necessary and documented. You prioritize zero-cost abstractions, memory safety, and concurrency. You provide code snippets that are idiomatic and highly optimized."
        });

        // 3. TypeScript Expert
        const tsAgent = new GeminiAgent({
            aiId: 'agent-ts',
            name: 'Agent-TS',
            capabilities: ['typescript', 'node', 'react', 'reliability'],
            systemInstruction: "You are a Senior TypeScript Reliability Engineer. You love strict typing, defensive programming, and robust error handling. You write clean, maintainable Node.js and React code."
        });

        // 4. Security Auditor
        const secAgent = new GeminiAgent({
            aiId: 'agent-sec',
            name: 'Agent-Sec',
            capabilities: ['security', 'audit', 'smart-contract'],
            systemInstruction: "You are an Elite Security Auditor. You look for reentrancy attacks, overflow bugs, logic errors, and insecure dependencies. You are paranoid and thorough. You output your findings in a structured vulnerability report."
        });

        const agents = [gemini, rustAgent, tsAgent, secAgent];

        for (const agent of agents) {
            this.agents.set(agent.name, agent);
            await agent.initialize(this.client);
        }
    }

    async routeTask(task: string) {
        console.log(`\n📨 Received Task: "${task}"`);
        console.log("----------------------------------------");

        const taskLower = task.toLowerCase();
        let targetAgent: Agent | undefined;
        let routedVia: string = '';

        // Task-based routing using MODEL_ROUTING config
        if (MODEL_ROUTING.engineering.some(k => taskLower.includes(k))) {
            if (taskLower.includes('rust')) {
                targetAgent = this.agents.get('Agent-Rust');
                routedVia = 'engineering/rust';
            } else {
                targetAgent = this.agents.get('Agent-TS');
                routedVia = 'engineering/typescript';
            }
        } else if (MODEL_ROUTING.security.some(k => taskLower.includes(k))) {
            targetAgent = this.agents.get('Agent-Sec');
            routedVia = 'security';
        } else if (MODEL_ROUTING.trading.some(k => taskLower.includes(k))) {
            targetAgent = this.agents.get('Gemini-Visionary');
            routedVia = 'trading (gemini-3-flash)';
        } else {
            targetAgent = this.agents.get('Gemini-Visionary');
            routedVia = 'general (gemini-3-flash)';
        }

        if (!targetAgent) {
            console.error("❌ No suitable agent found.");
            return;
        }

        console.log(`🔍 Routing via: ${routedVia}`);
        console.log(`🎯 Target: ${targetAgent.name}`);

        try {
            const result = await targetAgent.processRequest(task);
            console.log(`\n🏁 ${targetAgent.name} Output:\n`);
            console.log(result);
        } catch (err: any) {
            console.error(`❌ Error processing task: ${err.message}`);
        }
    }

    async close() {
        await this.client.close();
    }
}

// --- Main Execution ---

async function main() {
    const hub = new AgentHub();
    await hub.start();

    const task = process.argv[2];
    if (task) {
        await hub.routeTask(task);
    } else {
        console.log("Usage: npx ts-node agent_hub.ts \"Your task here\"");
    }

    // Allow some time for async cleanup if needed, though client.close() should handle it
    setTimeout(() => {
        hub.close().then(() => process.exit(0));
    }, 1000); // Wait a bit for pending logs
}

main().catch(console.error);
