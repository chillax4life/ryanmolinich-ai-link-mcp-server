
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

console.log('🧪 Starting Context Sharing Verification...');

const transport = new StdioClientTransport({
    command: 'node',
    args: ['index.js']
});

const client = new Client({
    name: "context-verifier",
    version: "1.0.0"
}, {
    capabilities: {}
});

try {
    await client.connect(transport);
    console.log('✅ Connected to server');

    // 1. Register Agents
    console.log('\n📝 Registering agents...');
    await client.callTool({
        name: 'register_ai',
        arguments: {
            aiId: 'source-agent',
            name: 'Source Agent',
            capabilities: ['data-source']
        }
    });

    await client.callTool({
        name: 'register_ai',
        arguments: {
            aiId: 'reader-agent',
            name: 'Reader Agent',
            capabilities: ['data-reader']
        }
    });

    // 2. Share Context
    const contextData = {
        timestamp: Date.now(),
        important_info: "The secret code is 42",
        complex_data: {
            nested: true,
            array: [1, 2, 3]
        }
    };

    console.log('\n📤 Sharing context from Source Agent...');
    await client.callTool({
        name: 'share_context',
        arguments: {
            contextId: 'test-context-v1',
            data: contextData,
            authorizedAiIds: ['reader-agent'], // Only reader-agent can read
            ttl: 60
        }
    });

    // 3. Verify Access (Authorized)
    console.log('\n📥 Retrieving context as Reader Agent...');
    const readResult = await client.callTool({
        name: 'get_shared_context',
        arguments: {
            contextId: 'test-context-v1',
            aiId: 'reader-agent'
        }
    });

    const retrievedData = JSON.parse(readResult.content[0].text);
    console.log('   Retrieved data:', JSON.stringify(retrievedData, null, 2));

    if (retrievedData.important_info === contextData.important_info) {
        console.log('✅ Context verification SUCCESS: Data matches');
    } else {
        console.error('❌ Context verification FAILED: Data mismatch');
        process.exit(1);
    }

    // 4. Verify Access Control (Unauthorized)
    console.log('\n⛔ Testing unauthorized access...');
    try {
        const result = await client.callTool({
            name: 'get_shared_context',
            arguments: {
                contextId: 'test-context-v1',
                aiId: 'unauthorized-agent'
            }
        });

        if (result.isError) {
            console.log('✅ Access control SUCCESS: Unauthorized access blocked (isError: true)');
        } else {
            console.error('❌ Access control FAILED: Unauthorized agent was able to read context');
            console.log('   Result content:', result.content[0].text);
            process.exit(1);
        }
    } catch (e) {
        console.log('✅ Access control SUCCESS: Unauthorized access blocked (Exception thrown)');
    }

} catch (error) {
    console.error('❌ Error running verification:', error);
} finally {
    await client.close();
    console.log('\n👋 Verification complete');
}
