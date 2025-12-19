import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GeminiAgent } from "./agents/GeminiAgent.js";
// --- Configuration ---
const SERVER_SCRIPT_PATH = "index.js"; // Path to the AI Link MCP Server entry point
// --- The Core Hub ---
class AgentHub {
    client;
    agents = new Map();
    transport;
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
        }
        catch (error) {
            console.error("❌ Failed to start Hub:", error);
            process.exit(1);
        }
    }
    async setupAgents() {
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
    async routeTask(task) {
        console.log(`\n📨 Received Task: "${task}"`);
        console.log("----------------------------------------");
        // Simple keyword routing for now
        const taskLower = task.toLowerCase();
        let targetAgent;
        if (taskLower.includes('rust') || taskLower.includes('performance')) {
            targetAgent = this.agents.get('Agent-Rust');
        }
        else if (taskLower.includes('typescript') || taskLower.includes('node') || taskLower.includes('js')) {
            targetAgent = this.agents.get('Agent-TS');
        }
        else if (taskLower.includes('audit') || taskLower.includes('security') || taskLower.includes('hack')) {
            targetAgent = this.agents.get('Agent-Sec');
        }
        else {
            targetAgent = this.agents.get('Gemini-Visionary');
        }
        if (!targetAgent) {
            console.error("❌ No suitable agent found.");
            return;
        }
        console.log(`🔍 Routing to: ${targetAgent.name}`);
        // We use the agent's internal helper to send the message
        // But wait, the agent sends a message TO another AI ID.
        // In this architecture, the Hub is the "User" interface triggering the agents.
        // We can simulate a direct request by just calling processRequest directly?
        // NO, the "Agent" class is designed to handle messages from the SERVER.
        // BUT, since we are instantiating the agent object HERE, we can just call its LLM function directly
        // for this "CLI" use case, OR we can send a message to it via the server and listen for response.
        // Direct call is faster for this CLI tool, but sending via server verifies the MCP plumbing.
        // Let's do the Direct Call for the "Router" functionality, effectively treating the Hub as the orchestrator
        // that owns these agent instances.
        try {
            const result = await targetAgent.processRequest(task);
            console.log(`\n🏁 ${targetAgent.name} Output:\n`);
            console.log(result);
        }
        catch (err) {
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
    }
    else {
        console.log("Usage: npx ts-node agent_hub.ts \"Your task here\"");
    }
    // Allow some time for async cleanup if needed, though client.close() should handle it
    setTimeout(() => {
        hub.close().then(() => process.exit(0));
    }, 1000); // Wait a bit for pending logs
}
main().catch(console.error);
