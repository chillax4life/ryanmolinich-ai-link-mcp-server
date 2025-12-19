
import { MasterAgent } from './agents/MasterAgent.js';
import { PriceOracleAgent } from './agents/PriceOracleAgent.js';
import { FlashArbAgent } from './agents/FlashArbAgent.js';
import { FlashLoanAgent } from './agents/FlashLoanAgent.js';

// Mock Client for Internal Communication (Loopback)
class MockClient {
    async callTool() { return { content: [{ text: 'OK' }] }; }
}

async function runSwarm() {
    console.log("🐝 ACTIVATING AGENT SWARM...");

    // 1. Initialize Agents
    const master = new MasterAgent({ aiId: 'master', name: 'MasterMind' });
    const oracle = new PriceOracleAgent({ aiId: 'oracle-1', name: 'Oracle' });
    const arb = new FlashArbAgent({ aiId: 'arb-1', name: 'Strategist' });
    const flash = new FlashLoanAgent({ aiId: 'flash-1', name: 'Financier' });

    arb.financier = flash; // Link agents

    // Initialize (Mode: Local Manifest)
    const client = new MockClient();
    await master.initialize(client);
    await oracle.initialize(client);
    await arb.initialize(client);
    await flash.initialize(client);

    // 2. Command the Swarm
    const command = "Run Strategy on Manifest";
    console.log(`\n👨‍✈️ USER COMMAND: "${command}"\n`);

    // Master delegates (Manual routing simulation for test since Client is Mock)
    // Real server uses index.js routing.
    // We will simulate Master's decision:
    console.log(`[MasterMind] Routing task to 'Strategist' (arb-1)...`);

    // 3. Execution directly on Agent to prove logic
    const result = await arb.scanArbitrage();

    console.log("\n📬 SWARM REPORT:");
    console.log(result);
}

runSwarm().catch(console.error);
