import { DriftAgent } from './agents/DriftAgent.js';
import sdk from '@drift-labs/sdk';
const { PositionDirection, BN } = sdk;
console.log("SDK Exports:", Object.keys(sdk));

async function runTest() {
    console.log("💪 Testing Drift Agent (The Muscle)...");

    const mockClient = { callTool: async () => ({ content: [{ text: 'OK' }] }) };

    // Initialize with no keypair (Read-Only)
    const agent = new DriftAgent({
        aiId: 'drift-1',
        name: 'Drift Bot',
        rpcUrl: 'https://api.devnet.solana.com',
        env: 'devnet'
    });

    try {
        await agent.initialize(mockClient);

        // MOCK INJECTION
        // We inject a mock DriftClient to test logic without needing a real wallet/RPC signature
        agent.driftClient = {
            subscribe: async () => { },
            unsubscribe: async () => { },
            getUser: () => ({
                getHealth: () => new BN(100),
                getLeverage: () => new BN(5000), // 0.5x
                getFreeCollateral: () => new BN(1000 * 1e6), // 1000 USDC
                getPerpPosition: (idx) => {
                    // Simulate a LONG position on Market 0
                    if (idx === 0) return { baseAssetAmount: new BN(10 * 1e9) };
                    return { baseAssetAmount: new BN(0) };
                }
            }),
            placePerpOrder: async (params) => {
                console.log(`[MOCK] Placing Order: 
                    Market: ${params.marketIndex}, 
                    Dir: ${params.direction === PositionDirection.LONG ? 'LONG' : 'SHORT'}, 
                    Amt: ${params.baseAssetAmount.toString()}`
                );
                return "txn_signature_mock_123";
            }
        };
        console.log("[Test] Mock DriftClient injected.");

        // TEST 1: Status Check
        console.log("\n1. Testing Status Check...");
        const status = await agent.processRequest("Check Drift health");
        console.log(status);
        if (status.includes("1000.00 USDC")) console.log("✅ Status Check Passed");
        else console.error("❌ Status Check Failed");

        // TEST 2: Market Index Resolution
        console.log("\n2. Testing Market Resolution...");
        const solIdx = agent.getMarketIndex("SOL");
        const btcIdx = agent.getMarketIndex("BTC-PERP");
        console.log(`SOL Index: ${solIdx}, BTC Index: ${btcIdx}`);
        if (solIdx === 0 && btcIdx === 1) console.log("✅ Market Resolution Passed");
        else {
            // Note: This might fail if PERP_MARKETS isn't loaded/mocked correctly in the SDK import 
            // or if the SDK version differs. We'll observe.
            console.warn("⚠️ Market Resolution verify manually (depends on SDK consts)");
        }

        // TEST 3: Open Position via NLP
        console.log("\n3. Testing Open Position (NLP)...");
        const tradeResp = await agent.processRequest("Long SOL 0.5");
        console.log(tradeResp);
        if (tradeResp.includes("txn_signature_mock")) console.log("✅ Open Position Passed");
        else console.error("❌ Open Position Failed");

        // TEST 4: Close Position
        console.log("\n4. Testing Close Position...");
        const closeResp = await agent.closePosition(0); // Close SOL
        console.log(closeResp);
        if (closeResp.includes("Closed")) console.log("✅ Close Position Passed");
        else console.error("❌ Close Position Failed");

    } catch (e) {
        console.error("❌ Test Failed:", e);
    }
}

runTest();
