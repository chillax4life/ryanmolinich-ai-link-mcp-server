
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

    const client = new Client({ name: "ReviewAgent", version: "1.0" }, { capabilities: {} });
    await client.connect(transport);

    const aiId = 'review_agent';
    await client.callTool({
        name: 'register_ai',
        arguments: { aiId, name: 'Quality Reviewer', capabilities: ['review', 'formatting'] }
    });

    console.log(`[${aiId}] Online and listening...`);

    setInterval(async () => {
        try {
            const result = await client.callTool({
                name: 'read_messages',
                arguments: { aiId, unreadOnly: true, markAsRead: true }
            });

            let data;
            try { data = JSON.parse(result.content[0].text); } catch { return; }

            if (data.messages && data.messages.length > 0) {
                for (const msg of data.messages) {
                    console.log(`[${aiId}] Reviewing: "${msg.message}"`);

                    if (msg.type === 'request') {
                        const approved = `[APPROVED] ${msg.message}`;

                        await client.callTool({
                            name: 'send_message',
                            arguments: {
                                fromAiId: aiId,
                                toAiId: msg.from,
                                message: approved,
                                messageType: 'response'
                            }
                        });
                        console.log(`[${aiId}] Validated.`);
                    }
                }
            }
        } catch (e) { }
    }, 1000);
}

main();
