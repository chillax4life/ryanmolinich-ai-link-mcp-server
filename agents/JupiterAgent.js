import { SolanaAgent } from './SolanaAgent.js';
import { VersionedTransaction } from '@solana/web3.js';
import fetchNode from 'node-fetch';
const fetch = global.fetch || fetchNode;

const JUP_API = 'https://api.jup.ag/swap/v1';
const JUP_KEYS = [
    'cf9eb936-5e2c-4754-adaa-c786db125a64',
    'abce94de-6b8f-4fff-8e76-cffa916b2cdd',
    '7a92406d-05d5-4717-b694-67d236872a70'
];

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

            // Simple random key selection to distribute load
            const key = JUP_KEYS[Math.floor(Math.random() * JUP_KEYS.length)];

            const response = await this.fetch(url, {
                headers: { 'x-api-key': key }
            });
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
            const key = JUP_KEYS[Math.floor(Math.random() * JUP_KEYS.length)];
            const response = await this.fetch(`${JUP_API}/swap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': key
                },
                body: JSON.stringify({
                    quoteResponse,
                    userPublicKey: this.keypair.publicKey.toBase58(),
                    wrapAndUnwrapSol: true
                })
            });

            const { swapTransaction } = await response.json();
            return swapTransaction; // Base64 encoded transaction
        } catch (error) {
            console.error(`[${this.name}] Swap creation error: ${error.message}`);
            throw error;
        }
    }
}
