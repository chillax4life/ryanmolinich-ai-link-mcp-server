
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
        this.symbols = config.symbols || ['SOL', 'BTC', 'ETH', 'WIF', 'BONK'];
        this.timeframe = config.timeframe || 10000; // Increased to 10s for multi-symbol
        this.autoExecution = config.autoExecution || false;

        // SMA Settings
        this.fastPeriod = 5;
        this.slowPeriod = 10;

        // State per Symbol
        this.states = {};
        this.symbols.forEach(sym => {
            this.states[sym] = {
                priceHistory: [],
                position: null,
                lastSignal: null
            };
        });

        this.stateFile = path.resolve(process.cwd(), 'strategy_state.json');

        // Dependencies
        this.oracle = null;
        this.drift = null;

        this.loadState();
    }

    async initialize(client) {
        await super.initialize(client);
        console.log(`[${this.name}] Strategy Multi-Asset Mode. Monitoring: ${this.symbols.join(', ')}`);
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
                if (data.states) {
                    this.states = { ...this.states, ...data.states };
                }
                this.autoExecution = data.autoExecution ?? this.autoExecution;
                console.log(`[${this.name}] State loaded for ${Object.keys(this.states).length} symbols.`);
            }
        } catch (e) {
            console.error(`[${this.name}] Failed to load state:`, e.message);
        }
    }

    saveState() {
        const data = {
            states: this.states,
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

        for (const symbol of this.symbols) {
            try {
                const price = await this.oracle.getPrice(symbol);
                if (!price) continue;

                const state = this.states[symbol];
                state.priceHistory.push(price);
                if (state.priceHistory.length > this.slowPeriod + 5) {
                    state.priceHistory.shift();
                }

                const smaFast = this.calculateSMA(symbol, this.fastPeriod);
                const smaSlow = this.calculateSMA(symbol, this.slowPeriod);

                if (smaFast && smaSlow) {
                    await this.checkSignals(symbol, price, smaFast, smaSlow);
                }
            } catch (e) {
                console.error(`[${this.name}] Error processing ${symbol}: ${e.message}`);
            }
        }
    }

    calculateSMA(symbol, period) {
        const history = this.states[symbol].priceHistory;
        if (history.length < period) return null;
        const sum = history.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    async checkSignals(symbol, price, fast, slow) {
        const state = this.states[symbol];
        
        // GOLDEN CROSS
        if (fast > slow && state.position !== 'LONG') {
            await this.executeSignal(symbol, 'LONG', price);
        }
        // DEATH CROSS
        else if (fast < slow && state.position !== 'SHORT') {
            await this.executeSignal(symbol, 'SHORT', price);
        }
    }

    async executeSignal(symbol, type, price) {
        const state = this.states[symbol];
        const message = `🤖 **BEST OPPORTUNITY**: ${type} ${symbol} @ $${price}\nReason: Multi-Asset SMA Crossover`;

        if (this.autoExecution) {
            if (this.drift) {
                console.log(`[${this.name}] Auto-Executing ${type} on ${symbol}...`);
                const result = await this.drift.processRequest(`${type} ${symbol} 0.1`);
                await this.sendMessage('master', `${message}\n\n⚡️ **AUTO-EXECUTED**:\n${result}`);
                state.position = type;
                this.saveState();
            }
        } else {
            if (state.lastSignal !== type) {
                await this.sendMessage('master', `${message}\n\n👉 **Reply "EXECUTE ${symbol}" to confirm.**`);
                state.lastSignal = type;
                this.saveState();
            }
        }
    }

    async processRequest(input) {
        const lower = input.toLowerCase();
        if (lower.match(/auto on/i)) {
            this.autoExecution = true;
            this.saveState();
            return "✅ Multi-Asset Automated Trading ENABLED.";
        }
        if (lower.match(/auto off/i)) {
            this.autoExecution = false;
            this.saveState();
            return "🛑 Automated Trading DISABLED.";
        }
        if (lower.match(/status/i)) {
            let status = `**Multi-Asset Strategy Status** (Auto: ${this.autoExecution ? '🤖 ON' : '👀 OFF'})\n`;
            for (const sym of this.symbols) {
                const state = this.states[sym];
                status += `- ${sym}: ${state.position || 'Neutral'} (Price: $${state.priceHistory[state.priceHistory.length-1] || '...'})\n`;
            }
            return status;
        }
        return "Try 'Auto On', 'Auto Off', or 'Status'.";
    }
}
