import { Agent } from './AgentFramework.js';

/**
 * Perplexity Agent
 * 
 * Connected via credentials found in mcp_config.json
 */
export class PerplexityAgent extends Agent {
    constructor(config) {
        super({
            ...config,
            metadata: { ...config.metadata, backend: 'perplexity-api', model: 'sonar-pro' }
        });
        this.apiKey = process.env.PERPLEXITY_API_KEY;
        if (!this.apiKey) {
            console.warn(`[${this.name}] PERPLEXITY_API_KEY not set. Agent will return mock responses.`);
        }
        this.endpoint = "https://api.perplexity.ai/chat/completions";
    }

    async processRequest(prompt, metadata) {
        console.log(`[${this.name}] Searching with Perplexity...`);

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "sonar-pro",
                    messages: [
                        { role: "system", content: "You are a helpful AI assistant." },
                        { role: "user", content: prompt }
                    ]
                })
            });

            if (!response.ok) {
                // Fallback for demo if API key is invalid/expired
                console.warn(`[${this.name}] API Error: ${response.statusText}. Using mock response.`);
                return `[Perplexity Mock] I found several results for "${prompt}"...`;
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error(`[${this.name}] Connection failed:`, error.message);
            return `[Perplexity Error] Could not reach API.`;
        }
    }
}
