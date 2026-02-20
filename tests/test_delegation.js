
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Spawn Agent Processes
// Spawn Agent Processes
// Log Agent Output
const log = (name, stream, data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(l => console.log(`[${name}:${stream}] ${l}`));
};

// Spawn Agent Processes Sequentially to avoid Registry Write Race Conditions
console.log("🚀 Spawning Independent Agent Processes...");

console.log("   -> Spawning Math Agent...");
const mathProc = spawn('node', [join(__dirname, 'agents/math_agent.js')], { stdio: 'pipe' });

mathProc.stdout.on('data', d => log('Math', 'out', d));
mathProc.stderr.on('data', d => log('Math', 'err', d));

await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for registration

console.log("   -> Spawning Review Agent...");
const reviewProc = spawn('node', [join(__dirname, 'agents/review_agent.js')], { stdio: 'pipe' });

reviewProc.stdout.on('data', d => log('Review', 'out', d));
reviewProc.stderr.on('data', d => log('Review', 'err', d));

// Wait for agents to boot
await new Promise(resolve => setTimeout(resolve, 2000));

async function main() {
    console.log("\n👨‍✈️ Orchestrator coming online...");
    const transport = new StdioClientTransport({
        command: 'node',
        args: ['index.js']
    });

    const client = new Client({ name: "Orchestrator", version: "1.0" }, { capabilities: {} });
    await client.connect(transport);

    // Register Orchestrator
    const myId = 'orchestrator';
    await client.callTool({
        name: 'register_ai',
        arguments: { aiId: myId, name: 'Orchestrator', capabilities: ['coordination'] }
    });

    console.log("📋 Connected AIs (via Persistence Check):");
    const connected = await client.callTool({ name: 'list_connected_ais' });
    const ais = JSON.parse(connected.content[0].text).ais;
    ais.forEach(ai => console.log(`   - ${ai.name} (${ai.aiId})`));

    // 1. Delegate Math Task
    console.log("\n1️⃣  Delegating Math Task: '50+50' -> math_agent");
    await client.callTool({
        name: 'send_message',
        arguments: { fromAiId: myId, toAiId: 'math_agent', message: '50+50', messageType: 'request' }
    });

    // Validating Math Response
    let mathResult = await waitForMessage(client, myId, 'math_agent');
    console.log(`✅ Math Result: ${mathResult}`);

    // 2. Delegate Review Task
    console.log("\n2️⃣  Delegating Review Task -> review_agent");
    await client.callTool({
        name: 'send_message',
        arguments: { fromAiId: myId, toAiId: 'review_agent', message: mathResult, messageType: 'request' }
    });

    // Validating Review Response
    let finalResult = await waitForMessage(client, myId, 'review_agent');
    console.log(`✅ Final Output: ${finalResult}`);

    console.log("\n🎉 Delegation Demo Complete!");

    // Cleanup
    mathProc.kill();
    reviewProc.kill();
    await client.close();
    process.exit(0);
}

async function waitForMessage(client, myId, fromId) {
    console.log("   (Waiting for response...)");
    while (true) {
        await new Promise(r => setTimeout(r, 1000));
        const res = await client.callTool({
            name: 'read_messages',
            arguments: { aiId: myId, unreadOnly: true, markAsRead: true }
        });

        try {
            const data = JSON.parse(res.content[0].text);
            if (data.messages && data.messages.length > 0) {
                const targetMsg = data.messages.find(m => m.from === fromId);
                if (targetMsg) return targetMsg.message;
            }
        } catch { }
    }
}

main();
