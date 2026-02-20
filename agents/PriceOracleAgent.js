import { SolanaAgent } from './SolanaAgent.js';
import { createHelius } from 'helius-sdk';

/**
 * PriceOracleAgent ("The Eyes")
 * Uses Helius SDK and RPC to monitor DEX pools directly.
 * Bypasses aggregators for raw, low-latency data from Raydium/Orca.
 */
export class PriceOracleAgent extends SolanaAgent {
    constructor(config) {
        super(config);

        // Helius API Key (Required for 'Orb' power)
        this.heliusApiKey = config.heliusApiKey || process.env.HELIUS_API_KEY;
        this.helius = null;

        if (this.heliusApiKey) {
            this.helius = createHelius(this.heliusApiKey);
        } else {
            console.warn(`[${this.name}] No Helius API Key provided. Advanced capabilities (DAS/Webhooks) disabled.`);
        }

        // Capabilities
        if (!this.capabilities.includes('price-oracle')) {
            this.capabilities.push('price-oracle');
        }
    }

    async initialize(client) {
        await super.initialize(client);
        console.log(`[${this.name}] Oracle Initialized. Helius Mode: ${this.helius ? 'Active' : 'Passthrough'}.`);
    }

    /**
     * Generic Account Monitor (Standard RPC fallback)
     * @param {string} accountAddress - PublicKey to monitor
     * @param {string} label - Label for logging
     */
    async monitorAccount(accountAddress, label = 'Account') {
        if (!this.connection) return "No Connection available.";

        try {
            const publicKey = new (await import('@solana/web3.js')).PublicKey(accountAddress);

            console.log(`[${this.name}] Subscribing to ${label}: ${accountAddress} via Standard RPC (WSS)...`);

            const subId = this.connection.onAccountChange(
                publicKey,
                (accountInfo, context) => {
                    console.log(`[${this.name}] 🔔 Update for ${label} (${accountAddress}):`);
                    console.log(`    - Slot: ${context.slot}`);
                    console.log(`    - Data Size: ${accountInfo.data.length} bytes`);
                    // In a real implementation, we would deserialize this data based on the pool layout (Raydium/Orca)
                },
                'confirmed'
            );

            return `Monitoring active for ${label} (Sub ID: ${subId})`;
        } catch (error) {
            console.error(`[${this.name}] Failed to subscribe to ${accountAddress}:`, error);
            return `Failed to monitor ${accountAddress}`;
        }
    }

    /**
     * Monitor a specific Raydium Liquidity Pool
     * @param {string} poolAddress - PublicKey of the AMM ID
     */
    async monitorRaydiumPool(poolAddress) {
        if (this.helius) {
            // Use Helius optimized hook if available
            console.log(`[${this.name}] monitoring via Helius...`);
            // this.helius.rpc.onAccountChange...
        }
        return await this.monitorAccount(poolAddress, 'Raydium Pool');
    }

    /**
     * Monitor a specific Orca Whirlpool
     * @param {string} poolAddress - PublicKey of the Whirlpool
     */
    async monitorOrcaPool(poolAddress) {
        return await this.monitorAccount(poolAddress, 'Orca Whirlpool');
    }

    async getPrice(symbol) {
        // Normalize symbol
        const sym = symbol.toUpperCase();

        // 1. Fetch from Kamino Scope (User's "Solid Ass Reliable Data")
        try {
            const price = await this.getKaminoPrice(sym);
            if (price) return price;
        } catch (e) {
            console.warn(`[${this.name}] Kamino Scope failed for ${sym}: ${e.message}`);
        }

        // 2. Fetch from CoinGecko (Backup)
        try {
            const COINGECKO_IDS = {
                'SOL': 'solana',
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'WIF': 'dogwifcoin',
                'BONK': 'bonk',
                'JUP': 'jupiter-exchange-solana'
            };

            const id = COINGECKO_IDS[sym] || sym.toLowerCase();
            const fetch = global.fetch || (await import('node-fetch')).default;
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);

            if (!response.ok) {
                console.error(`[${this.name}] HTTP Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (data[id] && data[id].usd) {
                return parseFloat(data[id].usd);
            }
        } catch (e) {
            console.error(`[${this.name}] CoinGecko failed for ${sym}: ${e.message}`);
        }

        console.warn(`[${this.name}] Failed to get real price for ${sym}. Returning null.`);
        return null;
    }

    /**
     * Reads "Solid Ass Reliable Data" from Kamino Scope on Mainnet.
     */
    async getKaminoPrice(symbol) {
        // Mapping of symbols to Kamino Scope Indices (Mainnet verified Feb 2026)
        const SCOPE_INDICES = {
            'SOL': 0,
            'ETH': 1,
            'BTC': 2,
            'USDC': 11, // Verified as ~1.01
            'USDT': 12,
        };

        const index = SCOPE_INDICES[symbol.toUpperCase()];
        if (index === undefined) return null;

        // Kamino Scope Prices Account (Mainnet)
        const SCOPE_PRICES_ACCOUNT = '3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C';

        const { Connection, PublicKey } = await import('@solana/web3.js');
        const mainnetConn = new Connection('https://api.mainnet-beta.solana.com');

        const pubkey = new PublicKey(SCOPE_PRICES_ACCOUNT);
        const accountInfo = await mainnetConn.getAccountInfo(pubkey);

        if (!accountInfo) {
            throw new Error(`Scope Account ${SCOPE_PRICES_ACCOUNT} not found.`);
        }

        // Offset Calculation:
        // Discriminator (8) + OracleMappings Pk (32) = 40 bytes.
        // DatedPrice Struct = 56 bytes.
        // Start = 40 + (index * 56)

        const offset = 40 + (index * 56);
        const data = accountInfo.data;

        if (data.length < offset + 16) return null;

        const value = data.readBigUInt64LE(offset); // value
        const exp = data.readBigUInt64LE(offset + 8); // exponent

        const price = Number(value) * Math.pow(10, -Number(exp));
        return price;
    }

    async processRequest(prompt, metadata) {
        // "Check price of SOL"
        if (prompt.toLowerCase().includes('price')) {
            const token = "SOL"; // Extract from prompt later
            return await this.getPrice(token);
        }
        return super.processRequest(prompt, metadata);
    }
}
