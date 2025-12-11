import { CLIAgent } from './CLIAgent.js';

export class OpencodeAgent extends CLIAgent {
    constructor(config) {
        super({
            ...config,
            command: 'opencode',
            metadata: { ...config.metadata, tool: 'opencode-cli' }
        });
    }

    buildCommand(prompt) {
        // opencode -p "prompt"
        const sanitizedPrompt = prompt.replace(/"/g, '\\"');
        return `opencode -p "${sanitizedPrompt}"`;
    }
}
