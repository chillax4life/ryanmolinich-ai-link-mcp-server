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
            this.model = this.genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                generationConfig: {
                    responseMimeType: "application/json",
                }
            });
            console.log(`[${this.name}] Intelligence Level: HIGH (Gemini 2.0 Flash Active with JSON Mode)`);
        } else {
            console.warn(`[${this.name}] Intelligence Level: LOW (Regex Fallback - No API Key)`);
        }

        // Knowledge of Sub-Agents (Local Registry + Dynamic Updates)
        this.registry = new Map();
        
        // Seed with core local agents
        const defaultAgents = [
            { id: 'oracle-1', name: 'PriceOracleAgent', caps: ['price', 'oracle', 'monitor'] },
            { id: 'drift-1', name: 'DriftAgent', caps: ['drift', 'trade', 'long', 'short', 'position'] },
            { id: 'flash-guardian', name: 'FlashTradeAgent', caps: ['flash', 'guardian', 'perps'] },
            { id: 'arb-1', name: 'FlashArbAgent', caps: ['strategy', 'arb', 'scan'] },
            { id: 'flash-1', name: 'FlashLoanAgent', caps: ['financier', 'loans'] }
        ];

        for (const a of defaultAgents) {
            this.registry.set(a.id, { name: a.name, capabilities: a.caps });
        }

        // Refresh registry periodically to find new Remote Agents (Satellites)
        this.refreshInterval = setInterval(async () => {
            await this.refreshRegistry();
        }, 15000);
    }

    async refreshRegistry() {
        try {
            const { getAllAIs } = await import('../database.js');
            const agents = await getAllAIs();
            for (const agent of agents) {
                if (agent.aiId === this.aiId) continue; // Don't list self
                this.registry.set(agent.aiId, {
                    name: agent.name,
                    capabilities: agent.capabilities || [],
                    metadata: agent.metadata || {}
                });
            }
        } catch (e) {
            // silent fail on loop
        }
    }

    getRegistryDescription() {
        let desc = "Available Agents in the Swarm:\n";
        for (const [id, info] of this.registry.entries()) {
            desc += `- ID: "${id}" | Name: "${info.name}" | Capabilities: [${info.capabilities.join(', ')}]\n`;
        }
        return desc;
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
     * Use Gemini to decide what to do with structured JSON output
     */
    async llmRoute(prompt) {
        const agentList = this.getRegistryDescription();
        const systemPrompt = `
        You are the Master Agent for a Solana Trading Swarm.
        Your goal is to parse user requests and delegate them to the correct sub-agent.
        
        ${agentList}

        Instructions:
        - If the request requires a specific agent's capability, use "action": "delegate".
        - If you can answer directly (e.g., greetings, general info), use "action": "respond".
        - Provide the "targetAiId" only for delegation.
        - The "message" should be the refined instruction for the sub-agent or the direct response to the user.

        Output Schema:
        {
            "action": "delegate" | "respond",
            "targetAiId": string | null,
            "message": string
        }
        `;

        try {
            const result = await this.model.generateContent({
                contents: [{ role: "user", parts: [{ text: systemPrompt + `\n\nUser Request: "${prompt}"` }] }]
            });
            
            const responseText = result.response.text();
            const plan = JSON.parse(responseText);

            if (plan.action === 'delegate' && plan.targetAiId) {
                console.log(`[${this.name}] Delegating to ${plan.targetAiId}: "${plan.message}"`);
                await this.sendMessage(plan.targetAiId, plan.message, 'request');
                return `Delegated task to ${plan.targetAiId}: ${plan.message}`;
            } else {
                return plan.message || "I've processed your request but have no further instructions.";
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

        for (const [id, info] of this.registry.entries()) {
            const matchesCap = info.capabilities.some(cap => lower.includes(cap.toLowerCase()));
            const matchesName = info.name.toLowerCase().includes(lower) || lower.includes(info.name.toLowerCase());
            
            if (matchesCap || matchesName) {
                targetId = id;
                break;
            }
        }

        if (targetId) {
            await this.sendMessage(targetId, prompt, 'request');
            return `Routed request to ${targetId} (Rule-Based Fallback).`;
        }

        return "I am the Master Agent. I couldn't identify a specialized agent for this task. Please be more specific, e.g., 'check price' or 'open long'.";
    }
}
