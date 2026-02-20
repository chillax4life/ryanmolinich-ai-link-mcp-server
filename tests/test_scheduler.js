
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function runTest() {
    console.log("🧪 Testing Scheduler (Agave Pipeline)...");

    const createClient = () => {
        const transport = new StdioClientTransport({
            command: 'node',
            args: ['index.js'] // Spawns server which starts Scheduler
        });
        return { client: new Client({ name: "Tester", version: "1.0" }, { capabilities: {} }), transport };
    };

    const s1 = createClient();
    await s1.client.connect(s1.transport);

    // 1. Register a Capable Agent
    console.log("\n1. [Agent] Registering 'worker-bot'...");
    await s1.client.callTool({
        name: 'register_ai',
        arguments: { aiId: 'worker-bot', name: 'Worker Bot', capabilities: ['code-gen'] }
    });

    // 2. Submit a Task
    console.log("\n2. [User] Submitting task...");
    const taskRes = await s1.client.callTool({
        name: 'submit_task',
        arguments: { description: 'Generate a Fibonacci function', requiredCapabilities: ['code-gen'] }
    });
    const taskId = JSON.parse(taskRes.content[0].text).taskId;
    console.log(`   -> Task Submitted: ${taskId}`);

    // 3. Wait for Scheduler to Assign (Pipeline time)
    console.log("\n3. [Network] Waiting for Scheduler (3s)...");
    await new Promise(r => setTimeout(r, 4000));

    // 4. Verify Assignment via Messages
    console.log("\n4. [Agent] Checking Inbox for Assignment...");
    const inboxRes = await s1.client.callTool({
        name: 'read_messages',
        arguments: { aiId: 'worker-bot', unreadOnly: true }
    });
    const inbox = JSON.parse(inboxRes.content[0].text);

    // Check for assignment message
    const assignmentMsg = inbox.messages.find(m =>
        m.fromAiId === 'system-scheduler' &&
        m.metadata?.type === 'task_assignment' &&
        m.metadata?.taskId === taskId
    );

    if (assignmentMsg) {
        console.log("   ✅ SUCCESS: Scheduler assigned task via notification!");
        console.log("   Msg:", assignmentMsg.message);
    } else {
        console.error("   ❌ FAILURE: No assignment message received.");
        console.log("   Inbox:", inbox);
        process.exit(1);
    }

    await s1.client.close();
    console.log("\n✨ Verification Complete.");
}

runTest().catch(console.error);
