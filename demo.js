#!/usr/bin/env node

/**
 * AI Link MCP Server Demo
 * 
 * This demonstrates practical multi-agent patterns for improving agentic AI workflows:
 * 1. Agent Registration
 * 2. Message Passing (Request/Response)
 * 3. Context Sharing
 * 4. Task Coordination
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Start the AI Link MCP Server
console.log('🚀 Starting AI Link MCP Server...\n');

const transport = new StdioClientTransport({
    command: 'node',
    args: ['index.js']
});

const client = new Client({
    name: "demo-orchestrator",
    version: "1.0.0"
}, {
    capabilities: {}
});

await client.connect(transport);
console.log('✅ Connected to AI Link MCP Server\n');

// Helper to call tools
const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    return result.content[0].text;
};

// ============================================================================
// DEMO 1: Agent Registration
// ============================================================================
console.log('📋 DEMO 1: Registering Specialized AI Agents');
console.log('─'.repeat(80));

await call('register_ai', {
    aiId: 'code-analyzer',
    name: 'Code Analysis Agent',
    capabilities: ['static-analysis', 'code-quality', 'pattern-detection'],
    metadata: { version: '1.0', specialty: 'code review' }
});
console.log('✓ Registered: Code Analysis Agent');

await call('register_ai', {
    aiId: 'test-generator',
    name: 'Test Generation Agent',
    capabilities: ['test-writing', 'coverage-analysis'],
    metadata: { version: '1.0', specialty: 'testing' }
});
console.log('✓ Registered: Test Generation Agent');

await call('register_ai', {
    aiId: 'documentation-bot',
    name: 'Documentation Agent',
    capabilities: ['documentation', 'markdown', 'api-docs'],
    metadata: { version: '1.0', specialty: 'documentation' }
});
console.log('✓ Registered: Documentation Agent');

await call('register_ai', {
    aiId: 'orchestrator',
    name: 'Main Orchestrator',
    capabilities: ['coordination', 'planning', 'aggregation'],
    metadata: { version: '1.0', role: 'coordinator' }
});
console.log('✓ Registered: Main Orchestrator\n');

// List all connected AIs
const aiList = JSON.parse(await call('list_connected_ais', {}));
console.log(`📊 Total Registered AIs: ${aiList.totalAIs}`);
console.log('Registered agents:', aiList.agents.map(a => a.name).join(', '));
console.log('\n');

// ============================================================================
// DEMO 2: Message Passing (Request/Response Pattern)
// ============================================================================
console.log('💬 DEMO 2: Message Passing - Request/Response Pattern');
console.log('─'.repeat(80));

// Orchestrator requests code analysis
await call('send_message', {
    fromAiId: 'orchestrator',
    toAiId: 'code-analyzer',
    message: 'Please analyze the authentication module for security vulnerabilities',
    messageType: 'request'
});
console.log('✓ Orchestrator → Code Analyzer: Analysis request sent');

// Code Analyzer responds
await call('send_message', {
    fromAiId: 'code-analyzer',
    toAiId: 'orchestrator',
    message: JSON.stringify({
        status: 'complete',
        findings: 3,
        issues: ['SQL injection risk in login', 'Weak password hashing', 'Missing rate limiting']
    }),
    messageType: 'response'
});
console.log('✓ Code Analyzer → Orchestrator: Analysis complete');

// Orchestrator reads messages
const messages = JSON.parse(await call('read_messages', {
    aiId: 'orchestrator',
    unreadOnly: true,
    markAsRead: true
}));
console.log(`\n📥 Orchestrator received ${messages.messageCount} message(s):`);
messages.messages.forEach(msg => {
    console.log(`   From: ${msg.from} | Type: ${msg.type}`);
    console.log(`   Message: ${msg.message.substring(0, 80)}...`);
});
console.log('\n');

// ============================================================================
// DEMO 3: Context Sharing (Cross-Agent Data)
// ============================================================================
console.log('🔄 DEMO 3: Context Sharing - Passing Data Between Agents');
console.log('─'.repeat(80));

// Code Analyzer shares detailed findings
await call('share_context', {
    contextId: 'analysis-results-001',
    data: {
        module: 'auth',
        timestamp: new Date().toISOString(),
        vulnerabilities: [
            {
                severity: 'high',
                type: 'SQL Injection',
                location: 'auth.js:45',
                recommendation: 'Use parameterized queries'
            },
            {
                severity: 'medium',
                type: 'Weak Hashing',
                location: 'auth.js:78',
                recommendation: 'Use bcrypt with salt rounds >= 12'
            }
        ],
        metrics: {
            linesAnalyzed: 1250,
            complexityScore: 7.3
        }
    },
    authorizedAiIds: ['orchestrator', 'documentation-bot'],
    ttl: 3600
});
console.log('✓ Code Analyzer shared context: analysis-results-001');
console.log('  Authorized: orchestrator, documentation-bot');
console.log('  TTL: 1 hour\n');

// Documentation Agent accesses shared context
const analysisData = JSON.parse(await call('get_shared_context', {
    contextId: 'analysis-results-001',
    aiId: 'documentation-bot'
}));
console.log('✓ Documentation Agent retrieved analysis results:');
console.log(`  Module: ${analysisData.module}`);
console.log(`  Vulnerabilities found: ${analysisData.vulnerabilities.length}`);
console.log(`  Complexity Score: ${analysisData.metrics.complexityScore}`);
console.log('\n');

// ============================================================================
// DEMO 4: Task Coordination (Capability-Based Routing)
// ============================================================================
console.log('🎯 DEMO 4: Task Coordination - Broadcasting to Capable Agents');
console.log('─'.repeat(80));

// Orchestrator broadcasts a documentation task
await call('coordinate_task', {
    taskId: 'doc-security-fixes-001',
    coordinatorAiId: 'orchestrator',
    taskDescription: 'Create security documentation for the identified vulnerabilities and their fixes',
    requiredCapabilities: ['documentation']
});
console.log('✓ Task broadcasted: doc-security-fixes-001');
console.log('  Required capabilities: [documentation]');
console.log('  Target agents: Documentation Agent\n');

// Check messages for documentation agent
const docMessages = JSON.parse(await call('read_messages', {
    aiId: 'documentation-bot',
    unreadOnly: true,
    markAsRead: false
}));
console.log(`📥 Documentation Agent received ${docMessages.messageCount} task notification(s)\n`);

// ============================================================================
// DEMO 5: Network Visualization
// ============================================================================
console.log('📊 DEMO 5: Network Status and Topology');
console.log('─'.repeat(80));

// Get network resources
const resources = await client.listResources();
console.log('Available network resources:');
resources.resources.forEach(r => {
    console.log(`  - ${r.uri}: ${r.name}`);
});
console.log('\n');

// Get network status
const statusResource = resources.resources.find(r => r.uri === 'ailink://network/status');
if (statusResource) {
    const status = await client.readResource({ uri: 'ailink://network/status' });
    const statusData = JSON.parse(status.contents[0].text);
    console.log('🌐 Network Status:');
    console.log(`  Total AIs: ${statusData.totalAIs}`);
    console.log(`  Total Messages: ${statusData.totalMessages}`);
    console.log(`  Active Contexts: ${statusData.activeContextCount}`);
}

console.log('\n');

// ============================================================================
// Summary and Next Steps
// ============================================================================
console.log('✨ DEMO COMPLETE!');
console.log('═'.repeat(80));
console.log('\n📚 What You Can Do Next:\n');
console.log('1. **Multi-Agent Code Review**: Chain specialized agents for comprehensive reviews');
console.log('2. **Task Decomposition**: Break complex work into specialized subtasks');
console.log('3. **Persistent Context**: Store intermediate results for cross-session access');
console.log('4. **Parallel Processing**: Send tasks to multiple agents simultaneously');
console.log('5. **Workflow Automation**: Create orchestration patterns for common workflows\n');

console.log('💡 Pro Tips:');
console.log('  - Use context sharing for expensive computations (AST analysis, etc.)');
console.log('  - Implement request/response patterns for reliable communication');
console.log('  - Monitor network topology to debug multi-agent interactions');
console.log('  - Consider adding persistent storage for production use\n');

// Cleanup
await client.close();
console.log('👋 Disconnected from AI Link MCP Server\n');
