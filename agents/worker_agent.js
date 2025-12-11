
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, '../index.js');

async function main() {
    const transport = new StdioClientTransport({
        command: 'node',
        args: [SERVER_PATH]
    });

    const client = new Client({ name: "WorkerAgent", version: "1.0" }, { capabilities: {} });
    await client.connect(transport);

    const aiId = 'worker_agent';
    await client.callTool({
        name: 'register_ai',
        arguments: { aiId, name: 'Task Worker', capabilities: ['math', 'worker'] }
    });

    console.log(`[${aiId}] Online and polling queue...`);

    setInterval(async () => {
        try {
            // List Pending Tasks
            const result = await client.callTool({
                name: 'list_tasks',
                arguments: { status: 'pending', capability: 'math' }
            });

            // Handle potential text response issues
            let data;
            try { data = JSON.parse(result.content[0].text); } catch { return; }

            if (data.tasks && data.tasks.length > 0) {
                const task = data.tasks[0];
                console.log(`[${aiId}] Found task: ${task.taskId} - ${task.description}`);

                // Claim Task
                try {
                    await client.callTool({
                        name: 'claim_task',
                        arguments: { taskId: task.taskId, aiId }
                    });
                    console.log(`[${aiId}] Claimed task: ${task.taskId}`);

                    // Do Work (Simulated Math)
                    let resultVal = "Unknown";
                    if (task.description.includes('+')) {
                        const parts = task.description.match(/(\d+)\s*\+\s*(\d+)/);
                        if (parts) {
                            resultVal = (parseInt(parts[1]) + parseInt(parts[2])).toString();
                        }
                    }

                    // Complete Task
                    await client.callTool({
                        name: 'complete_task',
                        arguments: { taskId: task.taskId, result: resultVal }
                    });
                    console.log(`[${aiId}] Completed task: ${task.taskId} Result: ${resultVal}`);

                } catch (e) {
                    // console.log(`[${aiId}] Claim failed: ${e.message}`);
                }
            }
        } catch (e) {
            console.error(`[${aiId}] Polling Error:`, e.message);
        }
    }, 2000);
}

main();
