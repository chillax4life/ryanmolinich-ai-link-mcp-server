import { DriftAgent } from './agents/DriftAgent.js';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { InternalClient } from './InternalClient.js';
import fs from 'fs';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createSyncNativeInstruction } from '@solana/spl-token';
import sdk, { BN } from '@drift-labs/sdk';

async function runLiveTest() {
    console.log("🔥 Starting Live Trading Test (Devnet)...");

    // 1. Setup Connection
    const rpcUrl = 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // 2. Load Persistent Wallet
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync('./solana_wallet.json', 'utf-8')));
    const keypair = Keypair.fromSecretKey(secretKey);
    const publicKey = keypair.publicKey;
    console.log(`[Setup] Loaded Wallet: ${publicKey.toBase58()}`);

    // 3. Funding Check
    console.log("[Setup] Checking Balance...");
    const balance = await connection.getBalance(publicKey);
    console.log(`[Setup] Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.05 * LAMPORTS_PER_SOL) {
        console.warn("⚠️  Low Balance! Requesting Airdrop...");
        // Try airdrop once
        try {
            const signature = await connection.requestAirdrop(publicKey, 1 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(signature);
            console.log("Airdrop Success.");
        } catch (e) {
            console.error("Airdrop failed. Please fund manually.");
            process.exit(1);
        }
    }

    // 4. Initialize Agent
    // We mock the client since we don't need the full server for this script
    const mockClient = { callTool: async () => ({ content: [{ text: 'OK' }] }) };

    const agent = new DriftAgent({
        aiId: 'test-drift',
        name: 'Live Tester',
        rpcUrl: rpcUrl,
        env: 'devnet'
    });

    // Manually inject the keypair (Agent usually loads from file/env)
    agent.keypair = keypair;

    // Initialize
    await agent.initialize(mockClient);

    // 4.5 Initialize Drift User if needed (Required one-time setup)
    console.log("[Setup] Check/Init Drift User Account...");
    try {
        // We know this is a fresh wallet, so we MUST initialize
        // But let's check allows for re-runs if keys were persistent
        // The SDK throws if we try to trade without it.
        // There is no clean "hasUser" synchronous check on the wrapper without subscribing first.
        // We are already subscribed inside agent.initialize().

        const user = agent.driftClient.getUser();
        if (!user.exists) {
            console.log("[Setup] Creating Drift User Account (First time setup)...");
            const tx = await agent.driftClient.initializeUserAccount();
            console.log(`[Setup] User Account Created! Tx: ${tx}`);
        } else {
            console.log("[Setup] Drift User Account exists.");
        }

    } catch (e) {
        if (e.message.includes("has no user") || e.message.includes("User not found")) {
            console.log("[Setup] User not found (caught error). Creating Drift User Account...");
            try {
                // Initialize subaccount 0
                const tx = await agent.driftClient.initializeUserAccount();
                console.log(`[Setup] User Account Created! Tx: ${tx}`);
                // Verify
                await agent.driftClient.addUser(0);
                await agent.driftClient.subscribe();
            } catch (createErr) {
                console.error(`[Setup] Failed to create user: ${createErr.message}`);
            }
        } else {
            console.log(`[Setup] Init User warning: ${e.message}`);
        }
    }

    try {
        console.log("[Setup] Preparing to Deposit Collateral (1 SOL)...");

        // 1. Get SOL Spot Market Index (Devnet: usually 1, Mainnet: 1. USDC is 0)
        // We can check sdk.configs['devnet'].SPOT_MARKETS
        const spotMarkets = sdk.configs['devnet'].SPOT_MARKETS;
        const solMarket = spotMarkets.find(m => m.symbol === 'SOL');
        const solIndex = solMarket ? solMarket.marketIndex : 1;

        // 2. Wrap SOL -> wSOL
        // We need an exact amount of wSOL to deposit.
        const depositAmount = new BN(1 * LAMPORTS_PER_SOL);

        // Get ATA
        const wsolMint = new PublicKey("So11111111111111111111111111111111111111112");
        const ata = await getAssociatedTokenAddress(wsolMint, publicKey);
        console.log(`[Setup] wSOL ATA: ${ata.toBase58()}`);

        const tx = new Transaction();

        // Check if ATA exists (simplified assumption: creates idempotent instruction if possible, 
        // or just create anyway - createsAssociatedTokenAccountInstruction throws if exists?)
        // Better to check presence, but for test script we just catch potential error or assume fresh?
        // Actually, createAssociatedTokenAccountInstruction will fail if it exists.
        // We should handle that.
        // Or safely use SyncNative if it exists.

        // Let's assume we might fail on create if it exists, so separate TX?
        // Or simplest: Just try to wrap. If ATA exists, we skip create.

        try {
            // Check account info
            const info = await connection.getAccountInfo(ata);
            if (!info) {
                tx.add(createAssociatedTokenAccountInstruction(publicKey, ata, publicKey, wsolMint));
                console.log("[Setup] Adding Create ATA IX");
            }
        } catch (e) { }

        // Fund it (Transfer SOL to ATA)
        tx.add(
            SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: ata,
                lamports: depositAmount.toNumber()
            })
        );
        // Sync Native (make the token balance visible)
        tx.add(createSyncNativeInstruction(ata));

        if (tx.instructions.length > 0) {
            console.log("[Setup] Creating/Funding wSOL ATA...");
            await connection.sendTransaction(tx, [keypair]);
        }

        // 3. Deposit to Drift
        console.log(`[Setup] Depositing 1 wSOL to Market ${solIndex}...`);
        const depositTx = await agent.driftClient.deposit(
            depositAmount,
            solIndex,
            ata
        );
        console.log(`[Setup] Deposit Successful! Tx: ${depositTx}`);

        // Force sync Drift User state to ensure SDK knows about the collateral
        console.log("[Setup] Syncing User Account State...");
        await agent.driftClient.getUser().fetchAccounts();
        await new Promise(r => setTimeout(r, 2000)); // Be safe

    } catch (e) {
        console.log(`[Setup] Deposit/Collateral Error: ${e.message}`);
        console.log("If account already has funds, this might be fine.");
    }

    // 5. Execute Trade
    console.log("\n🚀 Executing Trade: 'Long SOL 0.1'...");
    const result = await agent.processRequest("Long SOL 0.1");
    console.log(`Result: ${result}`);

    if (result.includes("Order Placed Successfully")) {
        console.log("✅ Trade SUCCESS!");
    } else {
        console.error("❌ Trade FAILED.");
    }

    // 6. Check Health
    console.log("\n🏥 Checking Account Health...");
    const health = await agent.processRequest("Check Drift health");
    console.log(health);

    console.log("\n[Test] Done. (Note: Position remains open on Devnet)");
    process.exit(0);
}

runLiveTest().catch(console.error);
