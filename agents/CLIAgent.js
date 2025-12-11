import { Agent } from './AgentFramework.js';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

/**
 * CLI Agent
 * 
 * A generic agent that wraps a command-line interface tool.
 */
export class CLIAgent extends Agent {
    constructor(config) {
        super({
            ...config,
            metadata: { ...config.metadata, backend: 'cli', tool: config.command }
        });
        this.command = config.command;
        this.args = config.args || []; // Function that takes prompt and returns args array
    }

    async processRequest(prompt, metadata) {
        console.log(`[${this.name}] Running CLI command: ${this.command}...`);

        try {
            // Build command arguments
            const commandString = this.buildCommand(prompt);

            console.log(`[${this.name}] Executing: ${commandString}`);
            const { stdout, stderr } = await execAsync(commandString);

            if (stderr && !stdout) {
                console.warn(`[${this.name}] CLI Warning: ${stderr}`);
            }

            return stdout || stderr || "[No output]";
        } catch (error) {
            console.error(`[${this.name}] CLI Execution execution failed:`, error.message);
            return `[CLI Error] Command failed: ${error.message}`;
        }
    }

    // Override this in subclasses or provide via config
    buildCommand(prompt) {
        // Default simple implementation: command + prompt wrapped in quotes
        // Be careful with injection here in a real app!
        const sanitizedPrompt = prompt.replace(/"/g, '\\"');
        return `${this.command} "${sanitizedPrompt}"`;
    }
}
