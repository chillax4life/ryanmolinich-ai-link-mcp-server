
import { PriceOracleAgent } from './agents/PriceOracleAgent.js';

async function testKamino() {
    console.log("Testing Kamino Scope Integration...");
    const oracle = new PriceOracleAgent({
        aiId: 'test-oracle',
        name: 'TestOracle'
    });

    // Mock Client
    await oracle.initialize({ callTool: async () => ({ content: [{ text: 'OK' }] }) });

    // override internal connection in PriceOracleAgent manually or pass via config if we updated it.
    // For this test, we just want to call getKaminoPrice.
    // We need to Monkey-Patch the connection logic inside getKaminoPrice OR update the Agent.

    // Easier: Update the Agent to use Localhost if Config says so.
    // But for this script:
    console.log("Mocking Agent internals to force Localhost...");
    oracle.endpoint = 'http://127.0.0.1:8899';
    oracle.connection = new (await import('@solana/web3.js')).Connection('http://127.0.0.1:8899');

    try {
        console.log("Fetching SOL Price from Local Cloned Scope...");
        const price = await oracle.getKaminoPrice('SOL');
        console.log(`✅ Result: $${price}`);

        if (price > 10 && price < 1000) {
            console.log("PASS: Price looks realistic (CLONED FROM MAINNET).");
        } else {
            console.log("FAIL: Price seems off.");
        }
    } catch (e) {
        console.error("❌ Error:", e);
    }
}

testKamino();
