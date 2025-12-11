
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CLIAgent } from './CLIAgent.js';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, '../index.js');

async function main() {
    // Parse args: node run_cli.js <aiId> <command>
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("Usage: node run_cli.js <aiId> <command>");
        process.exit(1);
    }

    const aiId = args[0];
    const command = args[1];

    const transport = new StdioClientTransport({
        command: 'node',
        args: [SERVER_PATH]
    });

    const client = new Client({ name: `${aiId}-Client`, version: "1.0" }, { capabilities: {} });
    await client.connect(transport);

    const agent = new CLIAgent({
        aiId,
        name: `CLI Agent (${command})`,
        capabilities: ['cli-execution'],
        command: command,
        metadata: { tool: command }
    });

    // Initialize agent (Registers it)
    await agent.initialize(client);

    console.log(`[${aiId}] Online. Wraps: "${command}"`);

    // Use agent's internal message loop if it has one, or shared loop?
    // CLIAgent extends Agent (AgentFramework).
    // AgentFramework usually doesn't have a loop unless we implemented one?
    // Let's check AgentFramework.js

    // Polling Loop
    setInterval(async () => {
        try {
            await agent.checkMessages();
        } catch (e) {
            console.error(e.message);
        }
    }, 2000);
}

main();
