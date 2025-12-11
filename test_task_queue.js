
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Spawn Worker
console.log("🚀 Spawning Worker Agent...");
const workerProc = spawn('node', [join(__dirname, 'agents/worker_agent.js')], { stdio: 'pipe' });

// Log Output
const log = (name, stream, data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(l => console.log(`[${name}:${stream}] ${l}`));
};
workerProc.stdout.on('data', d => log('Worker', 'out', d));
workerProc.stderr.on('data', d => log('Worker', 'err', d));

// Wait for boot
await new Promise(resolve => setTimeout(resolve, 3000));

async function main() {
    console.log("\n👨‍✈️ Orchestrator coming online...");
    const transport = new StdioClientTransport({
        command: 'node',
        args: ['index.js']
    });

    const client = new Client({ name: "TaskOrchestrator", version: "1.0" }, { capabilities: {} });
    await client.connect(transport);

    const myId = 'orchestrator';
    await client.callTool({
        name: 'register_ai',
        arguments: { aiId: myId, name: 'Orchestrator', capabilities: ['coordination'] }
    });

    console.log("📋 Submitting Task to Queue...");
    const submitResult = await client.callTool({
        name: 'submit_task',
        arguments: { description: 'Calculate 100+50', requiredCapabilities: ['math'] }
    });

    const taskData = JSON.parse(submitResult.content[0].text);
    const taskId = taskData.taskId;
    console.log(`✅ Task Submitted: ${taskId}`);

    // Poll for Completion
    console.log("⏳ Waiting for task completion...");

    let completed = false;
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));

        const listRes = await client.callTool({
            name: 'list_tasks',
            arguments: {}
        });
        const listData = JSON.parse(listRes.content[0].text);
        const task = listData.tasks.find(t => t.taskId === taskId);

        if (task) {
            console.log(`   Task Status: ${task.status}`);
            if (task.status === 'completed') {
                console.log(`🎉 Task Completed! Result: ${task.result}`);
                completed = true;
                break;
            }
        }
    }

    if (!completed) console.log("❌ Task timed out.");

    // Cleanup
    workerProc.kill();
    await client.close();
    process.exit(0);
}

main();
