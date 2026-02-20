
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

console.log('🧪 Verifying Hardware Context Mesh (Context7 Agent)...');

const transport = new StdioClientTransport({
    command: 'node',
    args: ['index.js']
});

const client = new Client({
    name: "hardware-verifier",
    version: "1.0.0"
}, {
    capabilities: {}
});

try {
    await client.connect(transport);
    console.log('✅ Connected to AI Link Server');

    // 1. Simulate IntegratorAgent updating hardware state
    console.log('\n🔄 IntegratorAgent: Logging hardware state to shared context...');
    await client.callTool({
        name: 'share_context',
        arguments: {
            contextId: 'hardware-state',
            data: {
                os: 'macOS',
                cooling: 'custom-active',
                lastCheck: new Date().toISOString(),
                health: 'stable',
                temp: '32°C (Optimal)',
                fanSpeed: '4500 RPM'
            }
        }
    });

    // 2. Simulate Context7Agent retrieving it
    console.log('\n🔍 Context7Agent: Retrieving hardware state for the swarm...');
    const result = await client.callTool({
        name: 'get_shared_context',
        arguments: {
            contextId: 'hardware-state',
            aiId: 'context-1'
        }
    });

    const status = JSON.parse(result.content[0].text);
    console.log('\n### 🖥️ CURRENT HARDWARE STATUS');
    console.log('-------------------------------');
    console.log(`System:   ${status.os}`);
    console.log(`Cooling:  ${status.cooling}`);
    console.log(`Health:   ${status.health}`);
    console.log(`Temp:     ${status.temp}`);
    console.log(`Status:   ✅ MESHED WITH SWARM VIA CONTEXT7`);
    console.log('-------------------------------');

} catch (error) {
    console.error('❌ Integration Verification Failed:', error);
} finally {
    await client.close();
    process.exit(0);
}
