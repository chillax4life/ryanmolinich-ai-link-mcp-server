
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
    const transport = new StdioClientTransport({
        command: 'node',
        args: ['index.js']
    });

    const client = new Client({
        name: "SolanaTester",
        version: "1.0.0"
    }, { capabilities: {} });

    await client.connect(transport);
    console.log("Connected to AI Link Server");

    try {
        // Test Solana Balance (using a known devnet faucet address or random one)
        // This address is the Sol Faucet address on Devnet
        const result = await client.callTool({
            name: 'solana_get_balance',
            arguments: { address: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d' }
        });

        console.log("Solana Balance Result:", result.content[0].text);

    } catch (e) {
        console.error("Tool call failed:", e);
    }

    await client.close();
}

main().catch(console.error);
