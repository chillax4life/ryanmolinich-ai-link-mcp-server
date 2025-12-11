import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

// Default to devnet for safety, but allow override
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

export const solanaTools = [
    {
        name: 'solana_get_balance',
        description: 'Get the balance of a Solana account (in LAMPORTS)',
        inputSchema: {
            type: 'object',
            properties: {
                address: { type: 'string', description: 'The Solana public key address' }
            },
            required: ['address']
        }
    },
    {
        name: 'solana_get_account_info',
        description: 'Get basic account info for a Solana address',
        inputSchema: {
            type: 'object',
            properties: {
                address: { type: 'string', description: 'The Solana public key address' }
            },
            required: ['address']
        }
    },
    {
        name: 'solana_request_airdrop',
        description: 'Request an airdrop of SOL (Devnet/Testnet only)',
        inputSchema: {
            type: 'object',
            properties: {
                address: { type: 'string', description: 'The Solana public key address' },
                amount: { type: 'number', description: 'Amount of SOL to request (e.g. 1)' }
            },
            required: ['address', 'amount']
        }
    }
];

export async function handleSolanaTool(name, args) {
    try {
        switch (name) {
            case 'solana_get_balance': {
                const pubKey = new PublicKey(args.address);
                const balance = await connection.getBalance(pubKey);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ address: args.address, balanceLamports: balance, balanceSol: balance / 1e9 }) }]
                };
            }
            case 'solana_get_account_info': {
                const pubKey = new PublicKey(args.address);
                const info = await connection.getAccountInfo(pubKey);
                if (!info) return { content: [{ type: 'text', text: "Account not found" }] };
                return {
                    content: [{
                        type: 'text', text: JSON.stringify({
                            executable: info.executable,
                            owner: info.owner.toBase58(),
                            lamports: info.lamports,
                            dataSize: info.data.length
                        }, null, 2)
                    }]
                };
            }
            case 'solana_request_airdrop': {
                const pubKey = new PublicKey(args.address);
                const amount = args.amount * 1e9; // Convert SOL to Lamports
                const signature = await connection.requestAirdrop(pubKey, amount);
                await connection.confirmTransaction(signature);
                return {
                    content: [{ type: 'text', text: `Airdrop successful. Signature: ${signature}` }]
                };
            }
            default:
                throw new Error(`Unknown Solana tool: ${name}`);
        }
    } catch (error) {
        return {
            content: [{ type: 'text', text: `Solana Error: ${error.message}` }],
            isError: true
        };
    }
}
