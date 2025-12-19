
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { Market, Wrapper } from '@cks-systems/manifest-sdk';
import fs from 'fs';

async function setupMarket() {
    console.log("Initializing Local Manifest Market...");
    const connection = new Connection('http://127.0.0.1:8899', 'confirmed');
    // 1. Load Validator Identity (Rich Payer)
    console.log("Loading Validator Identity...");
    const rawKey = fs.readFileSync('/Users/ryanmolinich/.config/solana/id.json', 'utf-8');
    const keyData = JSON.parse(rawKey);
    const payer = Keypair.fromSecretKey(Uint8Array.from(keyData));
    console.log(`Payer Loaded: ${payer.publicKey.toBase58()}`);

    // Check Config Balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log(`Balance: ${balance / 1e9} SOL`);

    // 2. Create Mints (wSOL and USDC)
    // For wSOL, we usually use Native, but Manifest might expect a Mint.
    // Let's create two fresh mints for simplicity: BASE (SOL-like) and QUOTE (USDC-like)
    console.log("Creating Mints...");
    const baseMint = await createMint(connection, payer, payer.publicKey, null, 9); // 9 decimals
    const quoteMint = await createMint(connection, payer, payer.publicKey, null, 6); // 6 decimals

    console.log(`Base Mint: ${baseMint.toBase58()}`);
    console.log(`Quote Mint: ${quoteMint.toBase58()}`);

    // 3. Create Market via Manifest SDK
    console.log("Creating Manifest Market Orderbook...");
    // setupIxs returns instructions and signers
    const { ixs, signers } = await Market.setupIxs(connection, baseMint, quoteMint, payer.publicKey);

    const tx = new Transaction().add(...ixs);
    const sig = await sendAndConfirmTransaction(connection, tx, [payer, ...signers]);

    console.log(`Market Created! Tx: ${sig}`);

    // 4. Find the Market Address
    // Manifest uses deterministic addresses based on mints? Or setupIxs returns it?
    // setupIxs return type: Promise<{ ixs: TransactionInstruction[]; signers: Signer[]; }>
    // We can use Market.findByMints to find it after creation.

    console.log("Fetching Market Address...");
    const markets = await Market.findByMints(connection, baseMint, quoteMint);
    if (markets.length === 0) throw new Error("Failed to find created market");

    const market = markets[0];
    console.log(`✅ Market Address: ${market.address.toBase58()}`);

    // 5. Mint Tokens to Payer (to be able to trade)
    console.log("Minting tokens to Payer...");
    const baseAta = await getOrCreateAssociatedTokenAccount(connection, payer, baseMint, payer.publicKey);
    const quoteAta = await getOrCreateAssociatedTokenAccount(connection, payer, quoteMint, payer.publicKey);

    await mintTo(connection, payer, baseMint, baseAta.address, payer, 1000 * 1e9); // 1000 Base
    await mintTo(connection, payer, quoteMint, quoteAta.address, payer, 1000000 * 1e6); // 1M Quote

    // 6. Save Details for Agents
    const config = {
        marketId: market.address.toBase58(),
        baseMint: baseMint.toBase58(),
        quoteMint: quoteMint.toBase58(),
        payerPrivateKey: Array.from(payer.secretKey) // Saved for Agents to use as Trader
    };

    fs.writeFileSync('local_market.json', JSON.stringify(config, null, 2));
    console.log("Configuration saved to local_market.json");
}

setupMarket().catch(console.error);
