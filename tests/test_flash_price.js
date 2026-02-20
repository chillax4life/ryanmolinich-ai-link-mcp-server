import pkg from 'flash-sdk';
const { getPythnetOraclePrices } = pkg;
import { Connection } from '@solana/web3.js';

async function testPrice() {
    const connection = new Connection("https://api.mainnet-beta.solana.com");
    console.log("Fetching Pythnet prices...");
    try {
        // Signature unknown, guessing (connection, [tokens]) or similar?
        // Let's try inspecting length first
        console.log("Function length:", getPythnetOraclePrices.length);

        // It often takes (connection, oracle_pks) or similar.
        // Let's try calling with connection and see error?
        // Or checking `getPythnetOraclePrices.toString()` source if possible (not in compiled)

        // Actually, let's just use the `PriceOracleAgent` approach for price or generic Pyth.
        // But let's try to call it.
        const prices = await getPythnetOraclePrices(connection, []);
        console.log("Prices:", prices);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testPrice();
