import { PriceOracleAgent } from './agents/PriceOracleAgent.js';

async function runTest() {
    console.log("👁️ Testing Price Oracle Agent (The Eyes)...");

    const mockClient = { callTool: async () => ({ content: [{ text: 'OK' }] }) };

    // Test without Key first
    const agent = new PriceOracleAgent({
        aiId: 'oracle-1',
        name: 'Oracle Eye',
        rpcUrl: 'https://api.devnet.solana.com',
        heliusApiKey: null // Simulate missing key
    });

    try {
        await agent.initialize(mockClient);


        console.log("\nTesting Price Check (Offline Mode)...");
        const response = await agent.processRequest("Check price of SOL");
        console.log(`Response: ${response}`);

        if (response.includes("Offline")) {
            console.log("✅ Correctly reports Offline status.");
        } else {
            console.log("⚠️ Unexpected response for price check.");
        }

        console.log("\nTesting Pool Monitoring (RPC Fallback)...");
        // Use System Program ID as a dummy "Pool" to test subscription logic
        const dummyPool = "11111111111111111111111111111111";
        const monitorResponse = await agent.monitorRaydiumPool(dummyPool);
        console.log(`Monitor Response: ${monitorResponse}`);

        if (monitorResponse.includes("Monitoring active")) {
            console.log("✅ Successfully started monitoring (RPC Fallback).");
        } else {
            console.log("❌ Failed to start monitoring.");
        }

    } catch (e) {
        console.error("❌ Test Failed:", e);
    }
}

runTest();
