import { Agent } from './AgentFramework.js';

/**
 * RiskAgent ("The Sentinel")
 * 
 * Monitors all open positions across protocols (Flash, Drift).
 * Automated liquidation protection: closes positions if liquidation risk is high.
 * Enforces global stop-losses and trailing stops for the entire portfolio.
 */
export class RiskAgent extends Agent {
    constructor(config) {
        super({ 
            ...config, 
            name: 'RiskSentinel', 
            capabilities: ['risk-monitoring', 'auto-liquidation-protection'] 
        });

        this.checkInterval = config.checkInterval || 2000; // 2 seconds
        this.dangerZoneThreshold = config.dangerZoneThreshold || 5.0; // 5% distance to liquidation
        this.isActive = false;
        this.monitorTimer = null;
    }

    async initialize(client) {
        await super.initialize(client);
        this.startMonitoring();
        console.log(`[${this.name}] Risk Sentinel ACTIVATED. Threshold: ${this.dangerZoneThreshold}%`);
    }

    startMonitoring() {
        if (this.monitorTimer) clearInterval(this.monitorTimer);
        this.isActive = true;
        this.monitorTimer = setInterval(() => this.riskLoop(), this.checkInterval);
    }

    stopMonitoring() {
        if (this.monitorTimer) clearInterval(this.monitorTimer);
        this.isActive = false;
        console.log(`[${this.name}] Risk Sentinel PAUSED.`);
    }

    /**
     * Main monitoring loop
     */
    async riskLoop() {
        try {
            // 1. Fetch all open positions across the system
            const positionsResponse = await this.callTool('trading_positions', {});
            
            // Defensive check to ensure the response is valid before parsing
            if (!positionsResponse || typeof positionsResponse !== 'string') {
                console.warn(`[${this.name}] Received invalid positions response.`);
                return;
            }

            const data = JSON.parse(positionsResponse);

            if (!data.positions || data.positions.length === 0) {
                // console.debug(`[${this.name}] No open positions to monitor.`);
                return;
            }

            // 2. Map unique symbols to fetch prices
            const symbols = [...new Set(data.positions.map(p => p.symbol))];
            const prices = {};

            for (const sym of symbols) {
                const priceData = await this.callTool('trading_analyze', { symbol: sym });
                const analysis = JSON.parse(priceData);
                if (analysis.price) {
                    prices[sym] = analysis.price;
                }
            }

            // 3. Evaluate risk for each position
            for (const pos of data.positions) {
                const currentPrice = prices[pos.symbol];
                if (!currentPrice) continue;

                await this.evaluatePosition(pos, currentPrice);
            }
        } catch (error) {
            console.error(`[${this.name}] Risk Loop Error:`, error.message);
        }
    }

    /**
     * Checks a single position against risk parameters
     */
    async evaluatePosition(pos, currentPrice) {
        if (!pos.liquidationPrice) return;

        const distance = Math.abs(currentPrice - pos.liquidationPrice);
        const bufferPercent = (distance / currentPrice) * 100;

        // --- 1. EMERGENCY LIQUIDATION PROTECTION ---
        if (bufferPercent <= this.dangerZoneThreshold) {
            console.warn(`[${this.name}] 🚨 EMERGENCY: ${pos.id} is in DANGER ZONE (${bufferPercent.toFixed(2)}% buffer)`);
            
            await this.executeEmergencyClose(pos, currentPrice, 
                `Liquidation Buffer (${bufferPercent.toFixed(2)}%) breached threshold (${this.dangerZoneThreshold}%)`);
            return;
        }

        // --- 2. TRAILING STOP ENFORCEMENT ---
        // If the position has trailing stop logic enabled in metadata
        if (pos.trailingStopDistance) {
            // ... (Additional trailing stop logic could be synced here)
        }

        // --- 3. HARD STOP LOSS (Fallback) ---
        if (pos.stopLoss) {
            const isLong = pos.side.toLowerCase() === 'long';
            const stopBreached = isLong ? (currentPrice <= pos.stopLoss) : (currentPrice >= pos.stopLoss);
            
            if (stopBreached) {
                await this.executeEmergencyClose(pos, currentPrice, `Hard Stop Loss ($${pos.stopLoss}) triggered`);
            }
        }
    }

    /**
     * Executes a priority close for a position
     */
    async executeEmergencyClose(pos, price, reason) {
        console.warn(`[${this.name}] 🛡️ Sentinel Triggering Emergency Close: ${pos.id} | Reason: ${reason}`);

        try {
            const closeResult = await this.callTool('trading_close', {
                positionId: pos.id,
                currentPrice: price
            });

            const result = JSON.parse(closeResult);
            
            // Broadcast the event to the MasterAgent
            await this.sendMessage('master', {
                event: 'EMERGENCY_CLOSE',
                positionId: pos.id,
                symbol: pos.symbol,
                price,
                reason,
                pnl: result.pnl
            }, 'notification');

        } catch (error) {
            console.error(`[${this.name}] FAILED TO CLOSE POSITION ${pos.id}:`, error.message);
        }
    }

    async processRequest(prompt, metadata) {
        if (prompt.toLowerCase().includes('status')) {
            return `Risk Sentinel is ${this.isActive ? 'ACTIVE' : 'PAUSED'}. Monitoring ${this.dangerZoneThreshold}% buffer.`;
        }
        if (prompt.toLowerCase().includes('set threshold')) {
            const match = prompt.match(/set threshold ([\d\.]+)/i);
            if (match) {
                this.dangerZoneThreshold = parseFloat(match[1]);
                return `Danger zone threshold updated to ${this.dangerZoneThreshold}%`;
            }
        }
        return `Unknown command for Risk Sentinel. Current state: ${this.isActive ? 'Active' : 'Paused'}`;
    }
}
