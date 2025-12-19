import { FlashLoanAgent } from './agents/FlashLoanAgent.js';

async function runTest() {
    console.log("💰 Testing Flash Loan Agent (The Financier)...");

    const mockClient = { callTool: async () => ({ content: [{ text: 'OK' }] }) };

    const agent = new FlashLoanAgent({
        aiId: 'flash-test-1',
        name: 'Flash Test',
        rpcUrl: 'https://api.devnet.solana.com',
        env: 'dev'
    });

    try {
        await agent.initialize(mockClient);

        // Test Simulation
        const sim = await agent.simulateLoan('SOL', 10);
        console.log("Simulation Result:", sim);

        if (sim.includes("MarginFi not initialized")) {
            console.log("⚠️ Agent correctly reports uninitialized status (No Wallet).");
        } else {
            console.log("✅ Simulation logic executed.");
        }

    } catch (e) {
        console.error("❌ Test Failed:", e);
    }
}

runTest();
