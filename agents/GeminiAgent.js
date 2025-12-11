import { Agent } from './AgentFramework.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiAgent extends Agent {
    constructor(config) {
        super({
            ...config,
            metadata: { ...config.metadata, tool: 'gemini-sdk', backend: 'cloud', provider: 'google' }
        });
        
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
            console.log(`[${this.name}] Sending request to Gemini API...`);
            
            if (!this.model) {
                this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            }

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return text;
        } catch (error) {
            console.error(`[${this.name}] API error:`, error.message);
            return `[GEMINI AGENT ERROR] ${error.message}`;
        }
    }
}
