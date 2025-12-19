import { SolanaAgent } from './agents/SolanaAgent.js';

async function runTest() {
    console.log("Bone Glass Verification 🦴🥃");

    // 1. Mock Client
    const mockClient = {
        callTool: async ({ name, arguments: args }) => {
            console.log(`[MockClient] Called Tool: ${name}`, args);
            if (name === 'register_ai') return { content: [{ text: 'Registered' }] };
            return { content: [{ text: 'OK' }] };
        }
    };

    // 2. Instantiate Agent
    const agent = new SolanaAgent({
        aiId: 'bone-glass-1',
        name: 'Bone Glass',
        capabilities: ['solana-wallet'],
        // Using mainnet for real connection test, or devnet
        rpcUrl: 'https://api.devnet.solana.com'
    });

    // 3. Initialize (Connects to RPC)
    await agent.initialize(mockClient);

    // 4. Test Balance Logic
    // Since we don't have a wallet file by default, it should be Read-Only.
    // We can pass a public key to check.
    const knownPubkey = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'; // Token Program
    console.log(`\nTesting Balance for ${knownPubkey}...`);

    const response = await agent.processRequest(`balance ${knownPubkey}`);
    console.log("Response:", response);

    // 5. Verify manual getBalance
    const balInfo = await agent.getBalance(knownPubkey);
    if (typeof balInfo === 'number') {
        console.log(`✅ Balance check successful: ${balInfo} SOL`);
    } else {
        console.error("❌ Balance check failed to return number.");
        process.exit(1);
    }

    console.log("\n✨ Verification Complete.");
}

runTest().catch(console.error);
