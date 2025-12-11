
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function runTest() {
    console.log("🧪 Testing Persistence...");

    const createClient = () => {
        const transport = new StdioClientTransport({
            command: 'node',
            args: ['index.js'] // Spawns a NEW server process each time
        });
        return { client: new Client({ name: "Tester", version: "1.0" }, { capabilities: {} }), transport };
    };

    // --- SESSION 1: Write Data ---
    console.log("\n[Session 1] Connecting & Writing Data...");
    const s1 = createClient();
    await s1.client.connect(s1.transport);

    // Register an agent
    console.log("   -> Registering 'persistent-bot'...");
    await s1.client.callTool({
        name: 'register_ai',
        arguments: { aiId: 'persistent-bot', name: 'Persistent Bot', capabilities: ['storage-test'] }
    });

    // Share context
    console.log("   -> Sharing context 'secret-123'...");
    await s1.client.callTool({
        name: 'share_context',
        arguments: {
            contextId: 'secret-123',
            data: { secret: "The eagle has landed", timestamp: Date.now() },
            authorizedAiIds: []
        }
    });

    await s1.client.close();
    console.log("[Session 1] Closed.");

    // --- SESSION 2: Read Data ---
    console.log("\n[Session 2] Connecting & Reading Data (New Process)...");
    const s2 = createClient();
    await s2.client.connect(s2.transport);

    // Check Agent Registry
    console.log("   -> Checking connected AIs...");
    const aisFunc = await s2.client.callTool({ name: 'list_connected_ais', arguments: {} });
    const aisData = JSON.parse(aisFunc.content[0].text);
    const botFound = aisData.ais.find(a => a.aiId === 'persistent-bot');

    if (botFound) console.log("   ✅ 'persistent-bot' found in registry!");
    else console.error("   ❌ 'persistent-bot' MISSING!");

    // Check Context
    console.log("   -> Fetching context 'secret-123'...");
    try {
        const ctxFunc = await s2.client.callTool({
            name: 'get_shared_context',
            arguments: { contextId: 'secret-123', aiId: 'tester-new' }
        });
        const ctxData = JSON.parse(ctxFunc.content[0].text);
        if (ctxData.secret === "The eagle has landed") {
            console.log("   ✅ Context retrieved successfully!");
        } else {
            console.error("   ❌ Context data mismatch:", ctxData);
        }
    } catch (e) {
        console.error("   ❌ Failed to retrieve context:", e.message);
    }

    await s2.client.close();
    console.log("[Session 2] Closed.");
}

runTest().catch(console.error);
