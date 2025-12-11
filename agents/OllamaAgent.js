import { Agent } from './AgentFramework.js';

/**
 * Ollama Agent
 * 
 * An agent that processes requests using a local Ollama model.
 * Demonstrates keeping code privacy by using local models.
 */
export class OllamaAgent extends Agent {
    constructor(config) {
        super({
            ...config,
            metadata: { ...config.metadata, backend: 'ollama', model: config.model || 'qwen3-coder' }
        });
        this.model = config.model || 'qwen3-coder';
        this.endpoint = config.endpoint || 'http://localhost:11434/api/generate';
    }

    async processRequest(prompt, metadata) {
        console.log(`[${this.name}] Analyzing with local model ${this.model}...`);

        // Construct a specialized system prompt based on capabilities
        const systemPrompt = `You are a specialized AI agent with these capabilities: ${this.capabilities.join(', ')}.
    Answer the user request concisely and accurately.`;

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: `${systemPrompt}\n\nRequest: ${prompt}`,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error(`[${this.name}] Ollama connection failed. Is Ollama running?`);
            return `[MOCK RESPONSE from ${this.name} using ${this.model}] 
      I am unable to connect to real Ollama right now (${error.message}), but here is what I would say:
      Based on static analysis, the code looks solid but could use better error handling.`;
        }
    }
}
