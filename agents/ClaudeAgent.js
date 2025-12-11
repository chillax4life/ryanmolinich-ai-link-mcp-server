import { CLIAgent } from './CLIAgent.js';

export class ClaudeAgent extends CLIAgent {
    constructor(config) {
        super({
            ...config,
            // Defaulting to 'claude' but can be overridden
            command: config.commandOverride || 'claude',
            metadata: { ...config.metadata, tool: 'claude-cli' }
        });
    }

    buildCommand(prompt) {
        // claude "prompt"
        const sanitizedPrompt = prompt.replace(/"/g, '\\"');
        return `${this.command} "${sanitizedPrompt}"`;
    }
}
