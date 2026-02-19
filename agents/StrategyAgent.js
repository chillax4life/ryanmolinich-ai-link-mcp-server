
import { Agent } from './AgentFramework.js';
import fs from 'fs';
import path from 'path';

/**
 * StrategyAgent ("The Brain 2.0")
 * 
 * JOB DESCRIPTION:
 * - Monitors price data from PriceOracleAgent.
 * - Calculates Technical Indicators (SMA).
 * - identifying Entry Signals (Crossover).
 * - EXECUTION:
 *    - If Auto Mode: Delegates trade execution to DriftAgent.
 *    - If Manual Mode: Alerts User via MasterAgent to take action.
 */
export class StrategyAgent extends Agent {
    constructor(config) {
        super(config);

        // Configuration
        this.symbol = config.symbol || 'SOL';
        this.timeframe = config.timeframe || 2000; // Poll every 2s (matches FlashTrade)
        this.autoExecution = config.autoExecution || false; // Default to Manual/Signal mode

        // SMA Settings
        this.fastPeriod = 5;
        this.slowPeriod = 10;

        // State
        this.priceHistory = [];
        this.position = null; // 'LONG', 'SHORT', or null
        this.stateFile = path.resolve(process.cwd(), 'strategy_state.json');

        // Dependencies (Injected)
        this.oracle = null;
        this.drift = null;

        this.db = config.db; // Access to DB for logging
        this.loadState();
    }

    async initialize(client) {
        await super.initialize(client);
        console.log(`[${this.name}] Strategy Initialized. Monitoring ${this.symbol}. Auto-Execute: ${this.autoExecution}`);

        // Start the Heartbeat
        this.startLoop();
    }

    injectDependencies(oracle, drift) {
        this.oracle = oracle;
        this.drift = drift;
    }

    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                this.position = data.position;
                this.autoExecution = data.autoExecution ?? this.autoExecution;
                console.log(`[${this.name}] State loaded. Position: ${this.position}, Auto: ${this.autoExecution}`);
            }
        } catch (e) {
            console.error(`[${this.name}] Failed to load state:`, e.message);
        }
    }

    saveState() {
        const data = {
            position: this.position,
            autoExecution: this.autoExecution,
            updated: Date.now()
        };
        fs.writeFileSync(this.stateFile, JSON.stringify(data, null, 2));
    }

    startLoop() {
        setInterval(async () => {
            await this.logicLoop();
        }, this.timeframe);
    }

    async logicLoop() {
        if (!this.oracle) return;

        // 1. Fetch Price
        let price = null;
        try {
            price = await this.oracle.getPrice(this.symbol);
        } catch (e) {
            console.error(`[${this.name}] Oracle Error: ${e.message}`);
            return;
        }

        if (!price || typeof price !== 'number') return;

        // 2. Update History
        this.priceHistory.push(price);
        if (this.priceHistory.length > this.slowPeriod + 5) {
            this.priceHistory.shift(); // Keep buffer small
        }

        // 3. Calculate SMAs
        const smaFast = this.calculateSMA(this.fastPeriod);
        const smaSlow = this.calculateSMA(this.slowPeriod);

        if (!smaFast || !smaSlow) return; // Not enough data yet

        // console.log(`[${this.name}] Price: $${price} | Fast(${this.fastPeriod}): ${smaFast.toFixed(2)} | Slow(${this.slowPeriod}): ${smaSlow.toFixed(2)}`);

        // 4. Check Crossover Logic
        await this.checkSignals(price, smaFast, smaSlow);
    }

    calculateSMA(period) {
        if (this.priceHistory.length < period) return null;
        const slice = this.priceHistory.slice(-period);
        const sum = slice.reduce((a, b) => a + b, 0);
        return sum / period;
    }

    async checkSignals(price, fast, slow) {
        // GOLDEN CROSS (Bullish)
        if (fast > slow && this.position !== 'LONG') {
            console.log(`[${this.name}] 🚀 GOLDEN CROSS DETECTED! (Fast ${fast.toFixed(2)} > Slow ${slow.toFixed(2)})`);
            await this.executeSignal('LONG', price);
        }
        // DEATH CROSS (Bearish)
        else if (fast < slow && this.position !== 'SHORT') {
            console.log(`[${this.name}] 📉 DEATH CROSS DETECTED! (Fast ${fast.toFixed(2)} < Slow ${slow.toFixed(2)})`);
            await this.executeSignal('SHORT', price);
        }
    }

    async executeSignal(type, price) {
        // Prevent signal spam if we are already in pending state? 
        // For now, simple state toggle.

        const message = `🤖 **SIGNAL DETECTED**: ${type} ${this.symbol} @ $${price}\nReason: SMA Crossover`;

        if (this.autoExecution) {
            // DELEGATE TO DRIFT AGENT
            if (this.drift) {
                console.log(`[${this.name}] Auto-Executing ${type}...`);
                // Close existing if necessary (simplification: DriftAgent needs a 'reverse' or 'close' capability logic)
                // For now, we simply Open.
                const result = await this.drift.processRequest(`${type} ${this.symbol} 0.1`); // Fixed size for now
                await this.sendMessage('master', `${message}\n\n⚡️ **AUTO-EXECUTED**:\n${result}`);
                this.position = type;
                this.saveState();
            } else {
                console.error(`[${this.name}] Drift Agent not connected!`);
            }
        } else {
            // MANUAL MODE - NOTIFY USER
            if (this.position !== type) { // Only notify on change
                console.log(`[${this.name}] Requesting User Approval for ${type}...`);
                await this.sendMessage('master', `${message}\n\n👉 **Reply "EXECUTE" to confirm.**`);
                // We don't update this.position here, we wait for user.
                // Actually, to prevent spamming, we might want to track 'lastSignal'.
                this.position = type; // Updating strictly to prevent spamming the same signal every 2s.
                this.saveState();
            }
        }
    }

    async processRequest(input) {
        if (input.match(/auto on/i)) {
            this.autoExecution = true;
            this.saveState();
            return "✅ Automated Trading ENABLED. I will execute signals via Drift.";
        }
        if (input.match(/auto off/i)) {
            this.autoExecution = false;
            this.saveState();
            return "🛑 Automated Trading DISABLED. I will only signal you.";
        }
        if (input.match(/status/i)) {
            return `**Strategy Status**:\n- Mode: ${this.autoExecution ? '🤖 AUTO' : '👀 MANUAL'}\n- Position: ${this.position || 'None'}\n- Ticker: ${this.symbol}\n- Last Price: $${this.priceHistory[this.priceHistory.length - 1] || '...'}`;
        }
        return "Unknown command. Try 'Auto On', 'Auto Off', or 'Status'.";
    }
}
