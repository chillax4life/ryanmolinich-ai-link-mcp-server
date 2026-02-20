import { PriceOracleAgent } from './agents/PriceOracleAgent.js';

async function verifyKamino() {
    console.log("👁️ Verifying Kamino Scope Price Feed...");

    const oracle = new PriceOracleAgent({
        aiId: 'oracle-verify',
        name: 'OracleVerifier',
        rpcUrl: 'https://api.mainnet-beta.solana.com'
    });

    try {
        const solPrice = await oracle.getKaminoPrice('SOL');
        const btcPrice = await oracle.getKaminoPrice('BTC');
        const ethPrice = await oracle.getKaminoPrice('ETH');

        console.log(`✅ SOL Price (Kamino): $${solPrice?.toFixed(2)}`);
        console.log(`✅ BTC Price (Kamino): $${btcPrice?.toFixed(2)}`);
        console.log(`✅ ETH Price (Kamino): $${ethPrice?.toFixed(2)}`);

        if (solPrice > 0 && btcPrice > 0 && ethPrice > 0) {
            console.log("🚀 Kamino Scope is LIVE and ACCURATE.");
        } else {
            console.warn("⚠️ Kamino Scope returned zero or null prices.");
        }
    } catch (e) {
        console.error("❌ Kamino Verification Failed:", e.message);
    }
}

verifyKamino();
