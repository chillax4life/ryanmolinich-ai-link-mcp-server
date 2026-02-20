import { FlashArbAgent } from '../agents/FlashArbAgent.js';

async function runTest() {
    console.log("🧠 Testing Flash Arb Strategy...");

    const agent = new FlashArbAgent({
        aiId: 'arb-test-1',
        name: 'Arb Test'
    });

    const mockClient = { callTool: async () => ({ content: [{ text: 'OK' }] }) };
    await agent.initialize(mockClient);

    // Run Simulation
    const result = await agent.processRequest("Run Strategy Scan");

    // Check if result is wrapped or direct
    const output = result.content ? result.content[0].text : result;
    console.log("\nStrategy Output:\n", output);
}

runTest();
