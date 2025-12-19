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
     * Get Token Price (Simulated fallback if no Helius)
     * In a real implementation, this would query a DAS API or a specific Pool Account.
     */
    async getPrice(tokenSymbol) {
        if (this.helius) {
            // Placeholder: Use Helius DAS to get asset info
            // const asset = await this.helius.rpc.getAsset({ id: '...' });
            return `[Helius] Price for ${tokenSymbol}: (Requires Pool Address Config)`;
        }
        return `[Oracle] Price for ${tokenSymbol}: Metric (Offline)`;
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
            console.warn(`[${this.name}] Kamino Scope failed: ${e.message}`);
        }

        // 2. Fetch from CoinGecko (Backup)
        try {
            const fetch = global.fetch || (await import('node-fetch')).default;
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd`);

            if (!response.ok) {
                console.error(`[${this.name}] HTTP Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (data.solana && data.solana.usd) {
                return parseFloat(data.solana.usd);
            }
        } catch (e) {
            console.error(`[${this.name}] CoinGecko failed: ${e.message}`);
        }

        console.warn(`[${this.name}] Failed to get real price for ${sym}. Returning null.`);
        return null;
    }

    /**
     * Reads "Solid Ass Reliable Data" from Kamino Scope on Mainnet.
     */
    async getKaminoPrice(symbol) {
        if (symbol !== 'SOL') return null; // Logic only hardcoded for SOL (Index 0) for now.

        // Kamino Scope Prices Account (Mainnet)
        // From configs/mainnet/3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C.json
        const SCOPE_PRICES_ACCOUNT = '3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C';

        // Ensure we are using a Mainnet RPC for this specific call
        // If current connection is Devnet, this will fail (Account not found).
        // So we create a temporary connection to Mainnet if needed.
        const { Connection, PublicKey } = await import('@solana/web3.js');
        let connection = this.connection;

        // Check if we need to switch to Mainnet for this read
        // Simple heuristic: If we can't find the account, try Mainnet.
        // But better: Just use Mainnet explicitly for Oracle Data.
        const mainnetConn = new Connection('https://api.mainnet-beta.solana.com');

        const pubkey = new PublicKey(SCOPE_PRICES_ACCOUNT);
        const accountInfo = await mainnetConn.getAccountInfo(pubkey);

        if (!accountInfo) {
            throw new Error(`Scope Account ${SCOPE_PRICES_ACCOUNT} not found.`);
        }

        // DECODE SOL (Index 0)
        // Offset Calculation:
        // Discriminator (8) + OracleMappings Pk (32) = 40 bytes.
        // DatedPrice Struct = 56 bytes.
        // Index 0 Start = 40.

        const offset = 40;
        const data = accountInfo.data;

        // Read Value (u64 LE) at 40
        // Read Exp (u64 LE) at 48

        const value = data.readBigUInt64LE(offset); // value
        const exp = data.readBigUInt64LE(offset + 8); // exponent

        // Price = value * 10^(-exp)
        const price = Number(value) * Math.pow(10, -Number(exp));

        // console.log(`[${this.name}] Kamino Scope Price (SOL): $${price.toFixed(4)}`);
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
