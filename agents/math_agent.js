
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

    const client = new Client({ name: "MathAgent", version: "1.0" }, { capabilities: {} });
    await client.connect(transport);

    const aiId = 'math_agent';
    await client.callTool({
        name: 'register_ai',
        arguments: { aiId, name: 'Math Expert', capabilities: ['math', 'calculation'] }
    });

    console.log(`[${aiId}] Online and listening...`);

    // Poll for messages
    setInterval(async () => {
        try {
            const result = await client.callTool({
                name: 'read_messages',
                arguments: { aiId, unreadOnly: true, markAsRead: true }
            });

            // Handle text response safety
            let data;
            try { data = JSON.parse(result.content[0].text); } catch { return; }

            if (data.messages && data.messages.length > 0) {
                for (const msg of data.messages) {
                    console.log(`[${aiId}] Received task: "${msg.message}" from ${msg.from}`);

                    if (msg.type === 'request') {
                        // Simple Logic
                        let response = "I can only do addition.";
                        if (msg.message.includes('+')) {
                            const parts = msg.message.split('+');
                            const sum = parseInt(parts[0]) + parseInt(parts[1]);
                            response = `The sum is ${sum}`;
                        }

                        // Send Response
                        await client.callTool({
                            name: 'send_message',
                            arguments: {
                                fromAiId: aiId,
                                toAiId: msg.from,
                                message: response,
                                messageType: 'response'
                            }
                        });
                        console.log(`[${aiId}] Sent Result: "${response}"`);
                    }
                }
            }
        } catch (e) {
            // console.error(e.message);
        }
    }, 1000);
}

main();
