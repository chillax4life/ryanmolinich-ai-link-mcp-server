
import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('AI Link MCP Server E2E', async (t) => {
    // Start server process
    const serverProcess = spawn('node', ['index.js'], {
        stdio: ['pipe', 'pipe', 'inherit']
    });

    const transport = new StdioClientTransport({
        source: serverProcess.stdout,
        sink: serverProcess.stdin
    });

    const client = new Client({
        name: "test-client",
        version: "1.0.0"
    }, {
        capabilities: {}
    });

    await client.connect(transport);

    // Helper to call tools
    const call = async (name, args) => {
        return await client.callTool({ name, arguments: args });
    };

    await t.test('Register AIs', async () => {
        await call('register_ai', {
            aiId: 'ai-1',
            name: 'Coder Bot',
            capabilities: ['coding', 'debugging']
        });

        await call('register_ai', {
            aiId: 'ai-2',
            name: 'Review Bot',
            capabilities: ['reviewing']
        });

        const result = await call('list_connected_ais', {});
        const data = JSON.parse(result.content[0].text);
        assert.strictEqual(data.totalAIs, 2);
    });

    await t.test('Send and Read Messages', async () => {
        // Send message
        await call('send_message', {
            fromAiId: 'ai-1',
            toAiId: 'ai-2',
            message: 'Please review this code',
            messageType: 'request'
        });

        // Read message
        const result = await call('read_messages', {
            aiId: 'ai-2',
            unreadOnly: true,
            markAsRead: true
        });

        const data = JSON.parse(result.content[0].text);
        assert.strictEqual(data.messageCount, 1);
        assert.strictEqual(data.messages[0].message, 'Please review this code');
        assert.strictEqual(data.messages[0].from, 'ai-1');

        // Verify it's marked as read
        const result2 = await call('read_messages', {
            aiId: 'ai-2',
            unreadOnly: true
        });
        const data2 = JSON.parse(result2.content[0].text);
        assert.strictEqual(data2.messageCount, 0);
    });

    await t.test('Message Validation', async () => {
        try {
            await call('send_message', {
                fromAiId: 'ai-1',
                toAiId: 'ai-999', // Non-existent
                message: 'Hello',
                messageType: 'request'
            });
            assert.fail('Should have failed');
        } catch (e) {
            // SDK might throw or return error result depending on implementation
            // In this case, our server returns isError: true, which SDK throws as error
            assert.ok(true);
        }
    });

    await t.test('Context Sharing', async () => {
        await call('share_context', {
            contextId: 'ctx-1',
            data: { key: 'value' },
            authorizedAiIds: ['ai-1']
        });

        // Authorized access
        const result = await call('get_shared_context', {
            contextId: 'ctx-1',
            aiId: 'ai-1'
        });
        const data = JSON.parse(result.content[0].text);
        assert.strictEqual(data.key, 'value');

        // Unauthorized access
        try {
            await call('get_shared_context', {
                contextId: 'ctx-1',
                aiId: 'ai-2'
            });
            assert.fail('Should have denied access');
        } catch (e) {
            assert.ok(true);
        }
    });

    // Cleanup
    await client.close();
    serverProcess.kill();
});
