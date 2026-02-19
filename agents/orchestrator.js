import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import readline from 'readline';

/**
 * Main Orchestrator CLI
 * 
 * This is the primary user interface. It acts as the "Manager" agent
 * that routes user requests to the appropriate specialized agent.
 */

// Colors for pretty output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
};

const createTransport = () => new StdioClientTransport({
    command: 'node',
    args: ['/Users/ryanmolinich/Projects/ai-link-mcp-server/index.js']
});

async function main() {
    console.log(`${colors.bright}${colors.cyan}🚀 Initializing Orchestrator...${colors.reset}`);

    const client = new Client({ name: "UserOrchestrator", version: "1.0.0" }, { capabilities: {} });
    await client.connect(createTransport());

    // Register ourselves as the "Orchestrator" type
    await client.callTool({
        name: "register_ai",
        arguments: {
            aiId: "user-orchestrator",
            name: "Commander (You)",
            capabilities: ["orchestration", "user-interface"]
        }
    });

    console.log(`${colors.green}✓ Connected to AI Link Server${colors.reset}`);
    console.log(`Type your command below. Type 'exit' to quit, 'status' to see available agents.\n`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${colors.bright}${colors.blue}COMMAND > ${colors.reset}`
    });

    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();

        if (!input) {
            rl.prompt();
            return;
        }

        if (input === 'exit') {
            rl.close();
            process.exit(0);
        }

        if (input === 'status') {
            await showStatus(client);
        } else {
            await processCommand(client, input);
        }

        rl.prompt();
    });
}

async function showStatus(client) {
    try {
        const response = await client.callTool({ name: "list_connected_ais", arguments: {} });
        const data = JSON.parse(response.content[0].text);

        console.log(`\n${colors.bright}Creating Team Report:${colors.reset}`);
        console.log(`Total Agents Online: ${data.totalAIs}`);
        console.table(data.ais.map(a => ({
            ID: a.aiId,
            Name: a.name,
            Capabilities: a.capabilities.slice(0, 3).join(', ') // Truncate for display
        })));
    } catch (e) {
        console.error("Error fetching status:", e.message);
    }
}

async function processCommand(client, input) {
    console.log(`${colors.yellow}Thinking...${colors.reset}`);

    // 1. First, we need to know who is online to delegate to
    const response = await client.callTool({ name: "list_connected_ais", arguments: {} });
    const registry = JSON.parse(response.content[0].text);

    // 2. Simple Routing Logic (Rule-based for reliability in this demo)

    let targetAiId = null;
    let taskType = 'unknown';

    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('code') || lowerInput.includes('function') || lowerInput.includes('debug')) {
        targetAiId = 'opencode-bot';
        // Fallback or specific logic
        taskType = 'coding';
    } else if (lowerInput.includes('security') || lowerInput.includes('hack')) {
        targetAiId = 'cloud-security';
        taskType = 'security';
    } else if (lowerInput.includes('search') || lowerInput.includes('find')) {
        targetAiId = 'perplexity-researcher';
        taskType = 'research';
    } else if (lowerInput.includes('scan') || lowerInput.includes('arbitrage') || lowerInput.includes('balance') || lowerInput.includes('solana')) {
        targetAiId = 'solana-scanner'; // New Agent
        taskType = 'solana-ops';
    } else if (lowerInput.includes('calc') || lowerInput.includes('add') || lowerInput.includes('+')) {
        targetAiId = 'math_agent'; // From test_delegation.js days, or worker_agent if that's what we want.
        // But worker_agent uses QUEUE, not direct messages? 
        // WorkerAgent claims tasks.
        // MathAgent (from previous demo) does direct messages.
        // Let's use math_agent if it's there, or we can submit to queue?
        // Orchestrator logic below sends MESSAGE.
        // So target must likely be a direct agent.
        // Let's assume math_agent is running if user ran test_delegation.js or we start it.
        targetAiId = 'math_agent';
        taskType = 'math';
    }

    if (targetAiId) {
        console.log(`${colors.green}Delegating ${taskType} task to agent: ${targetAiId}${colors.reset}`);

        try {
            // Send the request
            await client.callTool({
                name: "send_message",
                arguments: {
                    fromAiId: "user-orchestrator",
                    toAiId: targetAiId,
                    message: input,
                    messageType: "request"
                }
            });

            // Wait for response (Demo simulation: specific polling)
            console.log(`${colors.cyan}Waiting for response from ${targetAiId}...${colors.reset}`);
            await waitForResponse(client, targetAiId);

        } catch (e) {
            console.error(`${colors.red}Failed to send message: ${e.message}${colors.reset}`);
        }
    } else {
        console.log(`${colors.red}I'm not sure which agent to assign that to. Try asking for 'code', 'security', or 'search'.${colors.reset}`);
    }
}

async function waitForResponse(client, targetAiId) {
    let responding = false;
    let attempts = 0;

    while (!responding && attempts < 10) {
        await new Promise(r => setTimeout(r, 1000)); // Poll every second
        const msgs = await client.callTool({
            name: "read_messages",
            arguments: { aiId: "user-orchestrator", unreadOnly: true, markAsRead: true }
        });

        const data = JSON.parse(msgs.content[0].text);
        if (data.messageCount > 0) {
            const reply = data.messages.find(m => m.from === targetAiId);
            if (reply) {
                console.log(`\n${colors.bright}${colors.green}[${targetAiId}]:${colors.reset} ${reply.message}\n`);
                responding = true;
            }
        }
        attempts++;
    }
    if (!responding) console.log(`${colors.yellow}Top timeout waiting for response.${colors.reset}`);
}

main().catch(console.error);
