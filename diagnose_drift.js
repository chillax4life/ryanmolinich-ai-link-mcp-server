import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=8c0f188a-6c40-429b-ac82-32e1c585ffb3");
const ACCOUNT = new PublicKey("BbUxBJyaRknxM8m37NnxfaeEw8w5oA19hJTm8zPPUBMZ");

async function checkDriftAccount() {
    console.log(`🔍 Checking Drift Account: ${ACCOUNT.toBase58()}`);
    
    const info = await connection.getAccountInfo(ACCOUNT);
    
    if (!info) {
        console.log("❌ Account NOT FOUND on Mainnet. It does not exist.");
        console.log("   Are you sure this is the correct address from Drift UI?");
        return;
    }

    console.log("✅ Account EXISTS!");
    console.log(`   Owner (Program ID): ${info.owner.toBase58()}`);
    console.log(`   Data Length: ${info.data.length} bytes`);
    console.log(`   Lamports: ${info.lamports / 1e9} SOL`);

    // Check if owner is Drift Protocol V2
    const DRIFT_V2 = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH";
    if (info.owner.toBase58() === DRIFT_V2) {
        console.log("✅ Confirmed: Owned by Drift Protocol V2");
        // We could decode the data to find the Authority (your wallet) and SubAccountId
        // But knowing it exists is step 1.
    } else {
        console.log("⚠️ WARNING: Not owned by Drift V2! Owned by:", info.owner.toBase58());
    }
}

checkDriftAccount().catch(console.error);
