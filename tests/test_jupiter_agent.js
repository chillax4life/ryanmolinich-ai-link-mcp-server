import { JupiterAgent } from '../agents/JupiterAgent.js';

async function runTest() {
    console.log("🪐 Testing Jupiter Agent (The Aggillator)...");

    // 1. Mock Client (No wallet needed for quotes)
    const mockClient = { callTool: async () => ({ content: [{ text: 'OK' }] }) };

    const agent = new JupiterAgent({
        aiId: 'jup-1',
        name: 'Jupiter Aggillator',
        rpcUrl: 'https://api.mainnet-beta.solana.com'
    });

    await agent.initialize(mockClient);

    // 2. Fetch Quote (1 SOL -> USDC)
    console.log("\nGetting Quote for 1 SOL -> USDC...");
    const quote = await agent.getQuote(
        'So11111111111111111111111111111111111111112', // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        1000000000 // 1 SOL
    );

    if (quote && quote.outAmount) {
        console.log(`✅ Quote Success:`);
        console.log(`   In: ${(1000000000 / 1e9).toFixed(2)} SOL`);
        console.log(`   Out: ${(quote.outAmount / 1e6).toFixed(2)} USDC`);
        console.log(`   Routes: ${quote.routePlan.length}`);
    } else {
        console.error("❌ Quote Failed");
        process.exit(1);
    }
}

runTest().catch(console.error);
