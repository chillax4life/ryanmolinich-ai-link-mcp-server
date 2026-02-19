import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Base Agents
import { OllamaAgent } from './OllamaAgent.js';
import { CloudAgent } from './CloudAgent.js';
import { PerplexityAgent } from './PerplexityAgent.js';

// CLI Agents
import { CopilotAgent } from './CopilotAgent.js';
import { GeminiAgent } from './GeminiAgent.js';
import { OpencodeAgent } from './OpencodeAgent.js';
import { CodexAgent } from './CodexAgent.js';
import { ClaudeAgent } from './ClaudeAgent.js';
import { SolanaAgent } from './SolanaAgent.js';


/**
 * Multi-Model Agent Demo Runner - ULTRA EDITION
 * 
 * Demonstrates a diverse ecosystem of AI agents all connected to the same
 * AI Link MCP Server, collaborating on tasks.
 */

// Main execution function
async function run() {
    console.log('🚀 Starting ULTIMATE Multi-Model Agent System...\n');

    // 1. Create ONE Shared Connection ( The "AI Internet" Hub )
    const transport = new StdioClientTransport({
        command: 'node',
        args: ['/Users/ryanmolinich/Projects/ai-link-mcp-server/index.js']
    });

    const sharedClient = new Client({
        name: "Omni-Hub-Client",
        version: "1.0.0"
    }, { capabilities: {} });

    await sharedClient.connect(transport);
    console.log('✅ Connected to Shared AI Link Server');

    // Load Dynamic Ollama Agents
    let dynamicAgents = [];
    try {
        const fs = await import('fs');
        const modelDir = '/Users/ryanmolinich/.ollama/models/manifests/registry.ollama.ai/library';

        if (fs.existsSync(modelDir)) {
            console.log(`\n📂 Loading Ollama models from: ${modelDir}`);
            dynamicAgents = fs.readdirSync(modelDir).map(modelName => {
                // console.log(`   found model: ${modelName}`);
                return new OllamaAgent({
                    aiId: `local-${modelName}`,
                    name: `Local Agent (${modelName})`,
                    capabilities: ['general-reasoning', modelName],
                    model: modelName,
                    metadata: { privacy: 'high', location: 'local', source: 'dynamic-loader' }
                });
            });
        }
    } catch (e) {
        console.warn('⚠️ Could not auto-load models:', e.message);
    }

    // 2. Initialize Strategy Pattern for agent creation
    const agents = [
        ...dynamicAgents,
        new CloudAgent({
            aiId: 'cloud-security',
            name: 'Cloud Security Reviewer',
            capabilities: ['security-audit', 'vulnerability-scan'],
            metadata: { privacy: 'medium', location: 'cloud' }
        }),
        new PerplexityAgent({
            aiId: 'perplexity-researcher',
            name: 'Perplexity Researcher',
            capabilities: ['web-research', 'fact-checking'],
            metadata: { tool: 'perplexity-api' }
        }),
        new CopilotAgent({
            aiId: 'gh-copilot',
            name: 'GitHub Copilot',
            capabilities: ['git-assistance', 'cli-help']
        }),
        new GeminiAgent({
            aiId: 'gemini-cli',
            name: 'Gemini Assistant',
            capabilities: ['general-assistance']
        }),
        new OpencodeAgent({
            aiId: 'opencode-bot',
            name: 'OpenCode Agent',
            capabilities: ['coding-assistance']
        }),
        new CodexAgent({
            aiId: 'codex-bot',
            name: 'Codex Agent',
            capabilities: ['code-generation']
        }),
        new ClaudeAgent({
            aiId: 'claude-bot',
            name: 'Claude Agent',
            capabilities: ['reasoning']
        }),
        new SolanaAgent({
            aiId: 'solana-bot-master',
            name: 'Solana Bot Master',
            capabilities: ['solana_monitor', 'bot_control', 'log_reader'],
            metadata: { project: 'ai-link-mcp-server' }
        })
    ];

    // 2a. Spawn External Worker Agent (Demonstrating Multi-Process Persistence)
    console.log('\n🚀 Spawning Independent Worker Agent (connects via storage.json)...');
    const workerProc = spawn('node', [join(__dirname, 'worker_agent.js')], { stdio: 'pipe' });
    workerProc.stdout.on('data', d => process.stdout.write(`[Worker] ${d}`));
    // workerProc.stderr.on('data', d => process.stderr.write(`[Worker Err] ${d}`)); // Optional: noisy logs

    // Ensure cleanup
    process.on('SIGINT', () => { workerProc.kill(); process.exit(); });

    // 3. Connect All Agents using the SHARED Client
    // ----------------------------------------------------------------
    for (const agent of agents) {
        try {
            await agent.initialize(sharedClient);
        } catch (e) {
            console.error(`❌ Failed to register ${agent.name}:`, e.message);
        }
    }

    // Start centralized polling loop (more efficient than interval per agent)
    console.log('\n🔄 Starting Message Loop...');
    const messageLoop = setInterval(async () => {
        for (const agent of agents) {
            // Sequential check to avoid race conditions on the single stdio stream
            await agent.checkMessages();
        }

        // Also check orchestrator messages
        await checkForOrchestratorMessages(sharedClient);

    }, 2000);


    // 4. Orchestrate
    // ----------------------------------------------------------------
    console.log('\n🎬 Orchestrating Workflow...\n');

    // Register User/Orchestrator IDENTITY on the same connection
    await sharedClient.callTool({
        name: "register_ai",
        arguments: { aiId: "orchestrator", name: "Orchestrator" }
    });

    // Example 2: Submit to Global Task Queue (New Feature)
    console.log('📥 Submitting Task to Global Queue (handled by Worker Agent)...');
    try {
        const taskRes = await sharedClient.callTool({
            name: "submit_task",
            arguments: { description: "Calculate 1234 + 4321", requiredCapabilities: ["math"] }
        });
        const taskData = JSON.parse(taskRes.content[0].text);
        console.log(`   Task Submitted: ${taskData.taskId} (Status: ${taskData.status})`);
    } catch (e) {
        // console.error(e);
    }

    console.log('\nExample running. Agents are listening. Press Ctrl+C to stop.');
}

// Separate function to handle Orchestrator's inbox (since it's not in the agents array)
async function checkForOrchestratorMessages(client) {
    try {
        const msgs = await client.callTool({
            name: "read_messages",
            arguments: { aiId: "orchestrator", unreadOnly: true, markAsRead: true }
        });

        // Handle "No messages found" text response gracefully
        let data;
        try {
            data = JSON.parse(msgs.content[0].text);
        } catch {
            return; // Not JSON, likely empty/error string
        }

        if (data.messageCount > 0) {
            data.messages.forEach(m => {
                console.log(`\n🔔 ORCHESTRATOR RECEIVED from ${m.from}: ${m.message}`);
            });
        }
    } catch (e) {
        // Ignore errors in poll loop
    }
}

run().catch(console.error);
