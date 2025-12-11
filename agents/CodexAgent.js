import { CLIAgent } from './CLIAgent.js';

export class CodexAgent extends CLIAgent {
    constructor(config) {
        super({
            ...config,
            command: 'codex',
            metadata: { ...config.metadata, tool: 'codex-cli' }
        });
    }

    buildCommand(prompt) {
        // codex "prompt"
        const sanitizedPrompt = prompt.replace(/"/g, '\\"');
        return `codex "${sanitizedPrompt}"`;
    }
}
