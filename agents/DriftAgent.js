import { SolanaAgent } from './SolanaAgent.js';
import { PublicKey } from '@solana/web3.js';
import sdk from '@drift-labs/sdk';
const { DriftClient, Wallet, BN, PositionDirection, OrderType, BASE_PRECISION } = sdk;

/**
 * DriftAgent ("The Muscle")
 * Specialized agent for Perpetual Futures trading on Drift Protocol.
 * Uses @drift-labs/sdk for direct RPC interaction (bypassing flaky REST APIs).
 */
export class DriftAgent extends SolanaAgent {
    constructor(config) {
        super(config);
        // Default capability
        if (!this.capabilities.includes('drift-perps')) {
            this.capabilities.push('drift-perps');
        }

        this.driftClient = null;
        // Default to Devnet if not specified for safety
        this.env = config.env || 'devnet';
    }

    async initialize(client) {
        await super.initialize(client);

        if (this.keypair) {
            try {
                const wallet = new Wallet(this.keypair);
                this.driftClient = new DriftClient({
                    connection: this.connection,
                    wallet: wallet,
                    env: this.env
                });

                console.log(`[${this.name}] Subscribing to Drift Client (${this.env})...`);
                await this.driftClient.subscribe();
                console.log(`[${this.name}] Drift Client Active.`);
            } catch (e) {
                console.error(`[${this.name}] Failed to initialize Drift Client: ${e.message}`);
                console.warn(`[${this.name}] Running in degraded mode (no Drift connection).`);
                this.driftClient = null;
            }
        } else {
            console.warn(`[${this.name}] No Wallet found. Drift Agent starting in Read-Only/Offline mode.`);
        }
    }

    /**
     * Helper: Get Market Index from Symbol (e.g. "SOL" -> 0)
     */
    getMarketIndex(symbol) {
        const normalized = symbol.toUpperCase().replace('-PERP', '');

        // Dynamically get markets based on environment
        // sdk.configs might be undefined if not exported cleanly, checking fallback
        const configs = sdk.configs;
        const markets = configs && configs[this.env] ? configs[this.env].PERP_MARKETS : [];

        const market = markets.find(m => m.symbol === `${normalized}-PERP`);
        if (!market) {
            console.warn(`[${this.name}] Unknown market symbol: ${symbol}. Defaulting to SOL-PERP (0).`);
            return 0; // Default to SOL
        }
        return market.marketIndex;
    }

    /**
     * Process natural language requests
     */
    async processRequest(prompt, metadata) {
        const lower = prompt.toLowerCase();

        // CHECK HEALTH
        if (lower.includes('drift') && (lower.includes('health') || lower.includes('account') || lower.includes('status'))) {
            if (!this.driftClient) return "Drift Client not initialized (No Wallet).";

            try {
                const user = this.driftClient.getUser();
                const health = user.getHealth(); // BN
                const leverage = user.getLeverage(); // BN (10000 = 1x)
                // user.getFreeCollateral() returns BN
                const freeCollat = user.getFreeCollateral();

                return `**Drift Account Status**:
                - Health: ${health.toString()}
                - Leverage: ${leverage.toNumber() / 10000}x
                - Free Collateral: ${(freeCollat.toNumber() / 1e6).toFixed(2)} USDC`;
            } catch (e) {
                return `Error fetching Drift account info: ${e.message}`;
            }
        }

        // EXECUTE TRADE: "Long SOL 0.1"
        if (lower.startsWith('long ') || lower.startsWith('short ')) {
            const parts = lower.split(' ');
            const directionStr = parts[0]; // 'long' or 'short'
            const symbol = parts[1] || 'SOL';
            const amountStr = parts[2] || '0.1';

            const direction = directionStr === 'long' ? PositionDirection.LONG : PositionDirection.SHORT;
            const marketIndex = this.getMarketIndex(symbol);
            const amount = parseFloat(amountStr);

            try {
                return await this.openPosition(marketIndex, direction, amount);
            } catch (e) {
                return `Trade Failed: ${e.message}`;
            }
        }

        return super.processRequest(prompt, metadata);
    }

    /**
     * Open a Perpetual Position (Market Order)
     * @param {number} marketIndex - e.g. 0 for SOL-PERP
     * @param {PositionDirection} direction - LONG/SHORT
     * @param {number} amount - Base asset amount (e.g. 1.0 SOL)
     */
    async openPosition(marketIndex, direction, amount) {
        if (!this.driftClient) throw new Error("Drift Client offline.");

        // Convert amount to BN with BASE_PRECISION (1e9 for SOL)
        // amount * 1e9 might accept floats, better to be careful with precision in real apps
        const amountBN = new BN(amount * 1e9);

        console.log(`[${this.name}] Opening ${direction === PositionDirection.LONG ? 'LONG' : 'SHORT'} on Market ${marketIndex} (Amt: ${amount})...`);

        const txSig = await this.driftClient.placePerpOrder({
            marketIndex: marketIndex,
            orderType: OrderType.MARKET,
            direction: direction,
            baseAssetAmount: amountBN
        });

        return `Order Placed Successfully! Tx: ${txSig}`;
    }

    /**
     * Close all positions for a market
     */
    async closePosition(marketIndex) {
        if (!this.driftClient) throw new Error("Drift Client offline.");

        console.log(`[${this.name}] Closing position on Market ${marketIndex}...`);

        // This is a simplified close that assumes we just want to exit
        // Real implementation would check getUser().getPerpPosition(marketIndex)
        // and place an opposite order.
        // The SDK might have a helper for this, or we construct it manually.
        const user = this.driftClient.getUser();
        const position = user.getPerpPosition(marketIndex);

        if (!position || position.baseAssetAmount.eq(new BN(0))) {
            return "No open position to close.";
        }

        const direction = position.baseAssetAmount.gt(new BN(0))
            ? PositionDirection.SHORT
            : PositionDirection.LONG;

        const txSig = await this.driftClient.placePerpOrder({
            marketIndex: marketIndex,
            orderType: OrderType.MARKET,
            direction: direction,
            baseAssetAmount: position.baseAssetAmount.abs() // Close full size
        });

        return `Position Closed. Tx: ${txSig}`;
    }

    /**
     * Cleanup
     */
    async shutdown() {
        if (this.driftClient) {
            await this.driftClient.unsubscribe();
        }
    }
}
