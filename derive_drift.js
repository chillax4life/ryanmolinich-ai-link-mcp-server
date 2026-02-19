import { PublicKey } from '@solana/web3.js';
import * as drift from '@drift-labs/sdk'; // We have this installed

const DRIFT_PROGRAM_ID = new PublicKey('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH');
const WALLET = new PublicKey('DAJ97nzrhvaWazGMXyDXunqV8scx1FG4QJ3ov5YFjFss');

async function derive() {
    console.log(`Wallet: ${WALLET.toBase58()}`);
    
    // Subaccount 0
    const userAccount0 = await drift.getUserAccountPublicKey(DRIFT_PROGRAM_ID, WALLET, 0);
    console.log(`Expected User Account (Subaccount 0): ${userAccount0.toBase58()}`);
    
    // Subaccount 1 (Just in case)
    const userAccount1 = await drift.getUserAccountPublicKey(DRIFT_PROGRAM_ID, WALLET, 1);
    console.log(`Expected User Account (Subaccount 1): ${userAccount1.toBase58()}`);
}

derive().catch(console.error);
