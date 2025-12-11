
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
    const transport = new StdioClientTransport({
        command: 'node',
        args: ['index.js']
    });

    const client = new Client({
        name: "DriftTester",
        version: "1.0.0"
    }, { capabilities: {} });

    await client.connect(transport);
    console.log("Connected to AI Link Server");

    try {
        console.log("Testing drift_get_market_summary for SOL-PERP...");
        const result = await client.callTool({
            name: 'drift_get_market_summary',
            arguments: { symbol: 'SOL-PERP' }
        });

        console.log("Drift Market Result:", result.content[0].text);

    } catch (e) {
        console.error("Tool call failed:", e);
    }

    await client.close();
}

main().catch(console.error);
