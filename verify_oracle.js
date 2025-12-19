
import { PriceOracleAgent } from './agents/PriceOracleAgent.js';

async function testOracle() {
    const oracle = new PriceOracleAgent({
        aiId: 'oracle-test',
        name: 'OracleTest',
        heliusApiKey: process.env.HELIUS_API_KEY // Optional
    });

    console.log("Testing PriceOracleAgent...");

    // We don't need full initialize(client) just for getPrice if it uses fetch
    // But let's see if getPrice depends on anything. It uses global.fetch.

    try {
        const p1 = await oracle.getPrice('SOL');
        console.log(`Price 1: ${p1}`);

        await new Promise(r => setTimeout(r, 2000));

        const p2 = await oracle.getPrice('SOL');
        console.log(`Price 2: ${p2}`);

        if (p1 === 145.50 && p2 === 145.50) {
            console.error("FAIL: Price appears to be the MOCK fallback (145.50).");
            process.exit(1);
        } else if (p1 === p2) {
            console.warn("WARNING: Price didn't change in 2s (could be stable market), but values look real.");
        } else {
            console.log("SUCCESS: Prices are changing and look real.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

testOracle();
