import { EventEmitter } from 'events';

// --- Types & Interfaces ---

interface AgentResponse {
    agentName: string;
    output: string;
    confidence: number;
}

interface AgentCapability {
    name: string;
    keywords: string[];
}

interface Agent {
    name: string;
    role: string;
    capabilities: AgentCapability[];
    process(task: string, context?: any): Promise<AgentResponse>;
}

// --- The Core Hub ---

class AgentHub extends EventEmitter {
    private agents: Map<string, Agent> = new Map();

    constructor() {
        super();
        console.log("🌌 Antigravity Agent Hub Initializing...");
    }

    registerAgent(agent: Agent) {
        this.agents.set(agent.name, agent);
        console.log(`✅ Registered Agent: ${agent.name} (${agent.role})`);
    }

    async routeTask(task: string): Promise<AgentResponse[]> {
        console.log(`\n📨 Received Task: "${task}"`);
        console.log("----------------------------------------");

        // Simple keyword-based routing for V1
        // In V2, we'll use an LLM embedding or classifier here.
        const selectedAgents: Agent[] = [];

        const taskLower = task.toLowerCase();

        for (const agent of this.agents.values()) {
            if (agent.capabilities.some(cap =>
                cap.keywords.some(kw => taskLower.includes(kw))
            )) {
                selectedAgents.push(agent);
            }
        }

        // Default to Visionary (Gemini) if no specific technical agent matches
        if (selectedAgents.length === 0) {
            const gemini = this.agents.get("Gemini");
            if (gemini) selectedAgents.push(gemini);
        }

        console.log(`🔍 Routing to: [${selectedAgents.map(a => a.name).join(', ')}]`);

        // Parallel execution
        const promises = selectedAgents.map(agent => agent.process(task));
        const results = await Promise.all(promises);

        return results;
    }
}

// --- Mock Agents (Phase 1) ---

class MockAgent implements Agent {
    public name: string;
    public role: string;
    public capabilities: AgentCapability[];

    constructor(
        name: string,
        role: string,
        capabilities: AgentCapability[]
    ) {
        this.name = name;
        this.role = role;
        this.capabilities = capabilities;
    }

    async process(task: string): Promise<AgentResponse> {
        // Simulate "thinking" delay
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1000));

        return {
            agentName: this.name,
            output: `[${this.name}] I have analyzed "${task}" based on my role as ${this.role}. Here is my mocked output.`,
            confidence: 0.95
        };
    }
}

// --- Setup & Run ---

async function main() {
    const hub = new AgentHub();

    // 1. The Visionary
    hub.registerAgent(new MockAgent("Gemini", "Visionary Strategist", [
        { name: "Strategy", keywords: ["plan", "strategy", "vision", "architect", "why"] }
    ]));

    // 2. The Builder (Rust)
    hub.registerAgent(new MockAgent("Agent-Rust", "Performance Architect", [
        { name: "Rust Dev", keywords: ["rust", "unsafe", "performance", "concurrency", "low-level"] }
    ]));

    // 3. The Reliability Expert (TS)
    hub.registerAgent(new MockAgent("Agent-TS", "Reliability Engineer", [
        { name: "TS Dev", keywords: ["typescript", "node", "api", "interface", "react"] }
    ]));

    // 4. The Guard Rail (Security)
    hub.registerAgent(new MockAgent("Agent-Sec", "Security Auditor", [
        { name: "Audit", keywords: ["audit", "security", "check", "verify", "safe"] }
    ]));

    // --- Demo Execution ---

    // Check for CLI args
    const task = process.argv[2] || "Build a high-performance Rust trading engine";

    const results = await hub.routeTask(task);

    console.log("\n🏁 Final Results:");
    results.forEach(r => {
        console.log(`\n🔹 ${r.agentName}: ${r.output}`);
    });
}

main().catch(console.error);
