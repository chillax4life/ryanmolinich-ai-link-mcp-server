
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SolanaAgent } from './SolanaAgent.js';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, '../index.js');

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || "scan arbitrage";

    const transport = new StdioClientTransport({
        command: 'node',
        args: [SERVER_PATH]
    });

    const client = new Client({ name: "SolanaRunner", version: "1.0" }, { capabilities: {} });
    await client.connect(transport);

    const agent = new SolanaAgent({
        aiId: 'solana-scanner',
        name: 'Solana Scanner',
        capabilities: ['solana', 'arbitrage']
    });

    await agent.initialize(client);

    console.log(`[${agent.name}] Online. Executing: "${command}"...`);

    const result = await agent.processRequest(command, {});
    console.log("\n" + result);

    // In a real daemon, we'd loop. For now, exit after scan.
    process.exit(0);
}

main();
