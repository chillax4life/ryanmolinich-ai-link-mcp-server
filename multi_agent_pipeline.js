
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Agent } from './agents/AgentFramework.js';

// ============================================================================
// Specialized Agent Classes
// ============================================================================

class CodeScannerAgent extends Agent {
    async processRequest(prompt, metadata) {
        console.log(`[${this.name}] Scanning code...`);
        await new Promise(r => setTimeout(r, 500));
        return JSON.stringify({
            file: "auth.js",
            issues: ["Weak Password", "No Rate Limit"],
            score: 65
        });
    }
}

class SecurityAgent extends Agent {
    async processRequest(prompt, metadata) {
        console.log(`[${this.name}] analyzing scan results...`);
        const scanData = JSON.parse(prompt);
        await new Promise(r => setTimeout(r, 600));
        return JSON.stringify({
            verdict: "FAIL",
            critical_issues: scanData.issues.length,
            recommendation: "Block deployment"
        });
    }
}

class DocsAgent extends Agent {
    async processRequest(prompt, metadata) {
        console.log(`[${this.name}] generating report...`);
        const securityReport = JSON.parse(prompt);
        return `## Security Audit Report\nVerdict: ${securityReport.verdict}\nAction: ${securityReport.recommendation}`;
    }
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function main() {
    console.log("🚀 Starting Shared-Connection Multi-Agent Pipeline...");

    const transport = new StdioClientTransport({
        command: 'node',
        args: ['index.js']
    });

    const client = new Client({
        name: "Omni-Client",
        version: "1.0.0"
    }, { capabilities: {} });

    await client.connect(transport);
    console.log("✅ Connected to AI Link Server");

    // 0. Register 'User' so we have a mailbox
    await client.callTool({
        name: 'register_ai',
        arguments: { aiId: 'user', name: 'User', capabilities: ['admin'] }
    });

    // 2. Instantiate and Register Agents
    const scanner = new CodeScannerAgent({ aiId: 'scanner', name: 'CodeScanner' });
    const security = new SecurityAgent({ aiId: 'security', name: 'SecurityBot' });
    const docs = new DocsAgent({ aiId: 'docs', name: 'DocsGenerator' });

    await scanner.initialize(client);
    await security.initialize(client);
    await docs.initialize(client);

    // 3. Polling Helper
    const agents = [scanner, security, docs];
    const pumpMessages = async () => {
        for (const agent of agents) {
            await agent.checkMessages();
        }
    };

    // Start background polling
    const pollInterval = setInterval(pumpMessages, 500);

    // Helper to safely read messages for user
    const readUserMessages = async () => {
        const msgs = await client.callTool({
            name: 'read_messages',
            arguments: { aiId: 'user', unreadOnly: true, markAsRead: true }
        });
        const text = msgs.content[0].text;
        try {
            return JSON.parse(text);
        } catch (e) {
            // If server returns plain text "No messages...", ignore it
            return { messages: [] };
        }
    }

    console.log("\n🎬 Initiating Workflow: Scan -> Security -> Docs");

    try {
        // Step 1: Trigger Scanner
        await client.callTool({
            name: 'send_message',
            arguments: {
                fromAiId: 'user',
                toAiId: 'scanner',
                message: "scan-auth",
                messageType: 'request'
            }
        });

        // Wait for Scanner Response
        let scanResult;
        console.log("Waiting for Scanner...");
        while (!scanResult) {
            await pumpMessages(); // Ensure agents process messages
            const data = await readUserMessages();
            if (data.messages && data.messages.length > 0 && data.messages[0].from === 'scanner') {
                scanResult = data.messages[0].message;
            }
            await new Promise(r => setTimeout(r, 200));
        }
        console.log("✓ Scanner Result:", scanResult);

        // Passthrough to Security
        console.log("\nForwarding to Security...");
        await client.callTool({
            name: 'send_message',
            arguments: {
                fromAiId: 'user',
                toAiId: 'security',
                message: scanResult,
                messageType: 'request'
            }
        });

        // Wait for Security Response
        let secResult;
        while (!secResult) {
            await pumpMessages();
            const data = await readUserMessages();
            if (data.messages && data.messages.length > 0 && data.messages[0].from === 'security') {
                secResult = data.messages[0].message;
            }
            await new Promise(r => setTimeout(r, 200));
        }
        console.log("✓ Security Result:", secResult);

        // Passthrough to Docs
        console.log("\nForwarding to Docs...");
        await client.callTool({
            name: 'send_message',
            arguments: {
                fromAiId: 'user',
                toAiId: 'docs',
                message: secResult,
                messageType: 'request'
            }
        });

        // Wait for Docs Response
        let finalReport;
        while (!finalReport) {
            await pumpMessages();
            const data = await readUserMessages();
            if (data.messages && data.messages.length > 0 && data.messages[0].from === 'docs') {
                finalReport = data.messages[0].message;
            }
            await new Promise(r => setTimeout(r, 200));
        }
        console.log("\n📄 FINAL REPORT:\n" + finalReport);

    } catch (e) {
        console.error(e);
    } finally {
        clearInterval(pollInterval);
        await client.close();
        console.log("\n✅ Pipeline Finished");
    }
}

main().catch(console.error);
