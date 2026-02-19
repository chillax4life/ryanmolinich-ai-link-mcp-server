import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keysDir = path.join(process.env.HOME, '.solana', 'keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
}

const delegatePath = path.join(keysDir, 'drift-delegate.json');

if (fs.existsSync(delegatePath)) {
    console.log(`Delegate key already exists at: ${delegatePath}`);
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(delegatePath))));
    console.log(`Public Key: ${kp.publicKey.toBase58()}`);
} else {
    const kp = Keypair.generate();
    fs.writeFileSync(delegatePath, JSON.stringify(Array.from(kp.secretKey)));
    console.log(`Generated NEW delegate key at: ${delegatePath}`);
    console.log(`Public Key: ${kp.publicKey.toBase58()}`);
    console.log(`IMPORTANT: You must authorize this key as a delegate on Drift UI!`);
}
