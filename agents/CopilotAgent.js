import { CLIAgent } from './CLIAgent.js';

export class CopilotAgent extends CLIAgent {
    constructor(config) {
        super({
            ...config,
            command: 'gh copilot explain',
            metadata: { ...config.metadata, tool: 'gh-copilot' }
        });
    }

    buildCommand(prompt) {
        // gh copilot explain "prompt"
        const sanitizedPrompt = prompt.replace(/"/g, '\\"');
        return `gh copilot explain "${sanitizedPrompt}"`;
    }
}
