import { Agent } from './AgentFramework.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * MasterAgent ("The Brain")
 * Orchestrates other agents using LLM reasoning (Gemini) or rule-based fallbacks.
 */
export class MasterAgent extends Agent {
    constructor(config) {
        super(config);

        // Capabilities
        if (!this.capabilities.includes('orchestrator')) {
            this.capabilities.push('orchestrator');
        }

        // Gemini Config
        this.apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
        this.genAI = null;
        this.model = null;

        if (this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            console.log(`[${this.name}] Intelligence Level: HIGH (Gemini 2.0 Flash Active)`);
        } else {
            console.warn(`[${this.name}] Intelligence Level: LOW (Regex Fallback - No API Key)`);
        }

        // Knowledge of Sub-Agents
        // Initialize with core local agents, but will refresh dynamically
        this.registry = {
            'price': 'oracle-1',
            'oracle': 'oracle-1',
            'drift': 'drift-1',
            'trade': 'drift-1',
            'long': 'drift-1',
            'short': 'drift-1',
            'position': 'drift-1',
            'flash': 'flash-guardian',
            'guardian': 'flash-guardian',
            'strategy': 'arb-1',
            'arb': 'arb-1',
            'scan': 'arb-1',
            'financier': 'flash-1'
        };

        // Refresh registry periodically to find new Remote Agents (Satellites)
        setInterval(async () => {
            await this.refreshRegistry();
        }, 10000); // Check for new friends every 10s
    }

    async refreshRegistry() {
        try {
            const { getAllAIs } = await import('../database.js');
            const agents = await getAllAIs();
            for (const agent of agents) {
                // Map capabilities/names to registry keys
                if (agent.name) this.registry[agent.name.toLowerCase()] = agent.aiId;
                if (agent.capabilities) {
                    agent.capabilities.forEach(cap => {
                        this.registry[cap.toLowerCase()] = agent.aiId;
                    });
                }
            }
        } catch (e) {
            // silent fail on loop
        }
    }

    async processRequest(prompt, metadata) {
        // 1. LLM Router Path
        if (this.model) {
            return await this.llmRoute(prompt);
        }

        // 2. Regex Fallback Path
        return await this.regexRoute(prompt);
    }

    /**
     * Use Gemini to decide what to do
     */
    async llmRoute(prompt) {
        const systemPrompt = `
        You are the Master Agent for a Solana Trading Swarm.
        Your goal is to parse user requests and delegate them to the correct sub-agent.
        
        Available Agents:
        1. ID: "oracle-1" | Function: Check Token Prices, Monitor Pools.
        2. ID: "drift-1"  | Function: Open/Close Perpetual Futures positions, Check Account Health.

        Output Format: JSON ONLY.
        {
            "action": "delegate" | "respond",
            "targetAiId": "oracle-1" | "drift-1" | null,
            "message": "The specific instruction for the sub-agent"
        }

        User Request: "${prompt}"
        `;

        try {
            const result = await this.model.generateContent(systemPrompt);
            const response = result.response.text();

            // Clean JSON (remove backticks if present)
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const plan = JSON.parse(cleanJson);

            if (plan.action === 'delegate' && plan.targetAiId) {
                console.log(`[${this.name}] Delegating to ${plan.targetAiId}: "${plan.message}"`);

                // execute the delegation
                // We use sendConnection to wait for a response? 
                // Currently sendMessage is fire-and-forget in AgentFramework (it returns void mostly).
                // But successful agent systems usually need a return value.
                // For this MVP, we'll send a message and tell the user we did so.
                // Ideal: The sub-agent would reply to US, and we'd reply to the user.
                // But simpler: We return "I have assigned X to do Y."

                await this.sendMessage(plan.targetAiId, plan.message, 'request');
                return `Delegated task to ${plan.targetAiId}: ${plan.message}`;
            } else {
                return plan.message || "I couldn't determine a clear action.";
            }

        } catch (e) {
            console.error(`[${this.name}] LLM Error: ${e.message}. Falling back to rules.`);
            return this.regexRoute(prompt);
        }
    }

    /**
     * Simple keyword matching fallback
     */
    async regexRoute(prompt) {
        const lower = prompt.toLowerCase();

        let targetId = null;
        for (const [key, id] of Object.entries(this.registry)) {
            if (lower.includes(key)) {
                targetId = id;
                break;
            }
        }

        if (targetId) {
            await this.sendMessage(targetId, prompt, 'request');
            return `Routed request to ${targetId} (Rule-Based).`;
        }

        return "I am the Master Agent, but I don't know who to handle that request. Try 'check price' or 'open long'.";
    }
}
