import { SolanaAgent } from './SolanaAgent.js';
import { VersionedTransaction, TransactionInstruction, PublicKey } from '@solana/web3.js';
import fetchNode from 'node-fetch';
const fetch = global.fetch || fetchNode;

const JUP_API = 'https://api.jup.ag/swap/v1';

// Load Jupiter API keys from environment (multiple keys for load balancing)
const getJupiterKeys = () => {
    const keys = [];
    if (process.env.JUPITER_API_KEY_1) keys.push(process.env.JUPITER_API_KEY_1);
    if (process.env.JUPITER_API_KEY_2) keys.push(process.env.JUPITER_API_KEY_2);
    if (process.env.JUPITER_API_KEY_3) keys.push(process.env.JUPITER_API_KEY_3);
    // Fallback to public API (no key) if none configured
    return keys.length > 0 ? keys : [null];
};

/**
 * JupiterAgent ("The Aggillator")
 * Specialized agent for fetching quotes and executing swaps via Jupiter.
 */
export class JupiterAgent extends SolanaAgent {
    constructor(config) {
        super(config);
        // Allow injecting a custom fetch (e.g. for testing or mocks)
        this.fetch = config.fetch || fetchNode;

        // Default capability for routing/aggregation
        if (!this.capabilities.includes('jupiter-aggregator')) {
            this.capabilities.push('jupiter-aggregator');
        }
    }

    /**
     * Process natural language requests
     */
    async processRequest(prompt, metadata) {
        const lower = prompt.toLowerCase();

        // "Quote 1 SOL to USDC" or "Price of SOL in USDC"
        if (lower.includes('quote') || lower.includes('price')) {
            // Very basic parsing for demo. Real parser would use metadata or regex.
            const amount = 1000000000; // 1 SOL default
            const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
            const outputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC

            const quote = await this.getQuote(inputMint, outputMint, amount);
            if (!quote) return "Failed to fetch quote.";

            return `**Jupiter Quote**:
            - In: ${(amount / 1e9).toFixed(2)} SOL
            - Out: ${(quote.outAmount / 1e6).toFixed(2)} USDC
            - Price Impact: ${quote.priceImpactPct}%
            - Route: ${quote.routePlan.length} hops`;
        }

        return super.processRequest(prompt, metadata);
    }

    /**
     * Fetch a quote from Jupiter v6 API
     */
    async getQuote(inputMint, outputMint, amount, slippageBps = 50) {
        try {
            const url = `${JUP_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
            console.log(`[${this.name}] Fetching quote: ${url}`);

            const keys = getJupiterKeys();
            const key = keys[Math.floor(Math.random() * keys.length)];

            const headers = {};
            if (key) headers['x-api-key'] = key;

            const response = await this.fetch(url, { headers });
            const data = await response.json();

            if (data.error) throw new Error(data.error);
            return data;
        } catch (error) {
            console.error(`[${this.name}] Quote error: ${error.message}`);
            return null;
        }
    }

    /**
     * Get Swap Transaction
     */
    async getSwapTx(quoteResponse) {
        if (!this.keypair) throw new Error("Wallet required to create swap transaction.");

        try {
            const keys = getJupiterKeys();
            const key = keys[Math.floor(Math.random() * keys.length)];

            const headers = { 'Content-Type': 'application/json' };
            if (key) headers['x-api-key'] = key;

            const response = await this.fetch(`${JUP_API}/swap`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    quoteResponse,
                    userPublicKey: this.keypair.publicKey.toBase58(),
                    wrapAndUnwrapSol: true
                })
            });

            const { swapTransaction } = await response.json();
            return swapTransaction;
        } catch (error) {
            console.error(`[${this.name}] Swap creation error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Fetch raw instructions and lookup tables from Jupiter
     */
    async getSwapInstructions(quoteResponse) {
        if (!this.keypair) throw new Error("Wallet required to fetch instructions.");

        try {
            const keys = getJupiterKeys();
            const key = keys[Math.floor(Math.random() * keys.length)];

            const headers = { 'Content-Type': 'application/json' };
            if (key) headers['x-api-key'] = key;

            const response = await this.fetch(`${JUP_API}/swap-instructions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    quoteResponse,
                    userPublicKey: this.keypair.publicKey.toBase58(),
                    wrapAndUnwrapSol: true
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // Deserialize all instruction sets
            return {
                computeBudgetInstructions: data.computeBudgetInstructions.map(ix => this.deserializeInstruction(ix)),
                setupInstructions: data.setupInstructions.map(ix => this.deserializeInstruction(ix)),
                swapInstruction: this.deserializeInstruction(data.swapInstruction),
                cleanupInstruction: data.cleanupInstruction ? this.deserializeInstruction(data.cleanupInstruction) : null,
                addressLookupTableAddresses: data.addressLookupTableAddresses.map(addr => new PublicKey(addr))
            };
        } catch (error) {
            console.error(`[${this.name}] Swap instructions error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Helper to deserialize Jupiter instruction format to TransactionInstruction
     */
    deserializeInstruction(ix) {
        return new TransactionInstruction({
            programId: new PublicKey(ix.programId),
            keys: ix.accounts.map(acc => ({
                pubkey: new PublicKey(acc.pubkey),
                isSigner: acc.isSigner,
                isWritable: acc.isWritable
            })),
            data: Buffer.from(ix.data, 'base64')
        });
    }
}
