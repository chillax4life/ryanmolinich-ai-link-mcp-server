import { Agent } from './AgentFramework.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
export class GeminiAgent extends Agent {
    apiKey;
    genAI;
    model;
    systemInstruction;
    modelName;
    constructor(config) {
        super({
            ...config,
            metadata: {
                ...config.metadata,
                tool: 'gemini-sdk',
                backend: 'cloud',
                provider: 'google',
                persona: config.systemInstruction ? 'specialized' : 'general'
            }
        });
        this.systemInstruction = config.systemInstruction;
        this.modelName = config.modelName || 'gemini-1.5-flash';
        this.apiKey = process.env.GOOGLE_API_KEY;
        if (!this.apiKey) {
            console.warn(`[${config.name}] Warning: GOOGLE_API_KEY not set`);
        }
        this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
        this.model = null;
    }
    async processRequest(prompt, metadata) {
        if (!this.genAI) {
            return '[GEMINI AGENT ERROR] GOOGLE_API_KEY not configured';
        }
        try {
            console.log(`[${this.name}] Thinking...`);
            if (!this.model) {
                this.model = this.genAI.getGenerativeModel({
                    model: this.modelName,
                    systemInstruction: this.systemInstruction
                });
            }
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            return text;
        }
        catch (error) {
            console.error(`[${this.name}] API error:`, error.message);
            return `[GEMINI AGENT ERROR] ${error.message}`;
        }
    }
}
