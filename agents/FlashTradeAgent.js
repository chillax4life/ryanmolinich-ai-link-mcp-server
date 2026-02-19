import { Agent } from './AgentFramework.js';
import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Dynamically import flash-sdk to avoid crashes if not installed
let FlashClient;
try {
    const flash = await import('flash-sdk');
    FlashClient = flash.FlashClient;
} catch (e) {
    console.warn("FlashTradeAgent: flash-sdk not found. Agent will be disabled.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, '../flash_trade_state.json');

export class FlashTradeAgent extends Agent {
    constructor(config) {
        super({ ...config, name: 'FlashGuardian' });
        this.connection = new Connection(config.rpcUrl);
        this.wallet = config.wallet;
        this.oracle = config.oracle || null;
        this.flashClient = null;
        this.isActive = false;

        // Load State (Migrates legacy automatically)
        this.state = this.loadState();

        // Polling interaction
        this.monitorInterval = null;
    }

    loadState() {
        let loaded = { strategies: {} };
        if (fs.existsSync(STATE_FILE)) {
            try {
                const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
                // Migration Check: If it has 'lowestPrice' at root, it's legacy
                if (raw.lowestPrice !== undefined) {
                    console.log(`[${this.name}] Migrating legacy state to Multi-Strategy...`);
                    loaded.strategies['LEGACY-SHORT-SOL'] = {
                        id: 'LEGACY-SHORT-SOL',
                        type: 'short',
                        symbol: 'SOL',
                        entryPrice: raw.lowestPrice + 0.65, // Approximated
                        lowestPrice: raw.lowestPrice,
                        trailDist: 0.65,
                        active: raw.status === 'monitoring'
                    };
                } else {
                    loaded = raw;
                }
            } catch (e) {
                console.error("Failed to load state", e);
            }
        }
        return loaded;
    }

    saveState() {
        console.log(`[${this.name}] Saving state to ${STATE_FILE}`);
        fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    }

    async initialize(client, oracleAgent) {
        await super.initialize(client);
        this.oracle = oracleAgent;

        if (!FlashClient) {
            console.log(`[${this.name}] SDK missing. Agent running in Watch Mode (Price Only).`);
        }

        try {
            console.log(`[${this.name}] Connecting to Flash.Trade (Mainnet)...`);
            // this.flashClient = await FlashClient.connect(this.connection, this.wallet);
            console.log(`[${this.name}] Connected! (Mocked Client)`);

            // Auto-Start if any strategy is active
            const activeCount = Object.values(this.state.strategies).filter(s => s.active).length;
            if (activeCount > 0) {
                this.startMonitoring();
            }
        } catch (e) {
            console.error(`[${this.name}] Init Warning: ${e.message}`);
        }
    }

    startMonitoring() {
        if (this.monitorInterval) clearInterval(this.monitorInterval);

        this.isActive = true;

        console.log(`[${this.name}] 🛡️ Flash Guardian ACTIVATED. Polling every 2s.`);

        // Poll every 2 seconds (High Speed)
        this.monitorInterval = setInterval(() => this.checkAllPositions(), 2000);
    }

    stopMonitoring() {
        if (this.monitorInterval) clearInterval(this.monitorInterval);
        this.isActive = false;
        console.log(`[${this.name}] Monitoring PAUSED.`);
    }

    async checkAllPositions() {
        // Filter active strategies
        const activeStrats = Object.values(this.state.strategies).filter(s => s.active);
        if (activeStrats.length === 0) return;

        // Fetch prices needed
        const uniqueSymbols = [...new Set(activeStrats.map(s => s.symbol))];
        const prices = {};

        for (const sym of uniqueSymbols) {
            try {
                if (this.oracle) {
                    prices[sym] = await this.oracle.getPrice(sym);
                } else {
                    prices[sym] = await this.fetchPriceHack();
                }
            } catch (e) { console.error(`Price fetch fail ${sym}: ${e.message}`); }
        }

        // Check each strategy
        for (const strat of activeStrats) {
            const price = prices[strat.symbol];
            if (price) {
                await this.checkLiquidationRisk(strat, price);
                await this.logicLoop(strat, price);
            }
        }
    }

    async checkLiquidationRisk(strat, currentPrice) {
        if (!strat.liquidationPrice) return;

        const distance = Math.abs(currentPrice - strat.liquidationPrice);
        const bufferPercent = (distance / currentPrice) * 100;

        // Visual debug for high leverage
        // console.log(`[${this.name}] Risk Check ${strat.id}: $${currentPrice.toFixed(2)} vs Liq $${strat.liquidationPrice.toFixed(2)} (${bufferPercent.toFixed(2)}% buffer)`);

        if (bufferPercent < 5.0) { // < 5% away from REKT
            if (strat.riskLevel !== 'critical') {
                strat.riskLevel = 'critical';
                await this.sendMessage("master", `🚨 **CRITICAL RISK ALERT: ${strat.id}** 🚨\nPrice ${currentPrice.toFixed(2)} is within 5% of Liquidation (${strat.liquidationPrice.toFixed(2)})!`);
                this.saveState();
            }
        } else if (bufferPercent < 10.0) {
            if (strat.riskLevel !== 'high') {
                strat.riskLevel = 'high';
                console.warn(`[${this.name}] ⚠️ High Risk: ${strat.id} buffer < 10%`);
                this.saveState();
            }
        } else {
            if (strat.riskLevel === 'critical' || strat.riskLevel === 'high') {
                strat.riskLevel = 'safe'; // Reset if price recovers
                this.saveState();
            }
        }
    }

    async logicLoop(strat, currentPrice) {
        if (!currentPrice) return;

        // console.log(`[${this.name}] Checking ${strat.id}: ${currentPrice.toFixed(2)} (Ref: ${strat.type === 'short' ? strat.lowestPrice : strat.highestPrice})`);

        let dirty = false;

        // SHORT STRATEGY
        if (strat.type === 'short') {
            // Update Low
            if (currentPrice < strat.lowestPrice) {
                console.log(`[${this.name}] 📉 ${strat.id} New Low: ${currentPrice.toFixed(4)}`);
                strat.lowestPrice = currentPrice;
                dirty = true;
            } else {
                // Check Stop
                const stopPrice = strat.lowestPrice + strat.trailDist;
                if (currentPrice > stopPrice) {
                    await this.triggerClose(strat, currentPrice, "Trailing Stop");
                    dirty = true;
                }
            }
        }
        // LONG STRATEGY
        else if (strat.type === 'long') {
            // Init highest if missing
            if (!strat.highestPrice) strat.highestPrice = strat.entryPrice;

            // Update High
            if (currentPrice > strat.highestPrice) {
                console.log(`[${this.name}] 📈 ${strat.id} New High: ${currentPrice.toFixed(4)}`);
                strat.highestPrice = currentPrice;
                dirty = true;
            } else {
                // Check Stop
                const stopPrice = strat.highestPrice - strat.trailDist;
                if (currentPrice < stopPrice) {
                    await this.triggerClose(strat, currentPrice, "Trailing Stop");
                    dirty = true;
                }
            }
        }

        if (dirty) this.saveState();
    }

    async triggerClose(strat, price, reason) {
        console.warn(`[${this.name}] 🚨 CLOSING ${strat.id} at ${price.toFixed(4)} (${reason})`);

        // EXECUTE CLOSE (Mocked)
        // await this.flashClient.closePosition(...)

        await this.sendMessage("master", `🚨 **EXECUTED: ${strat.id} CLOSED** 🚨\nPrice: ${price.toFixed(4)}\nReason: ${reason}`);

        strat.active = false;
        strat.closedAt = Date.now();
        strat.closePrice = price;
    }

    async openPosition(symbol, type, amount, leverageStr, trailDist) {
        const id = `${symbol}-${type.toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const leverage = parseFloat(leverageStr || "1"); // Default 1x

        console.log(`[${this.name}] Opening ${type.toUpperCase()} ${symbol} x${leverage} size:${amount}...`);

        // EXECUTE OPEN (Mocked)
        // await this.flashClient.openPosition(...)

        // Mock Entry Price
        const entryPrice = this.oracle ? await this.oracle.getPrice(symbol) : 150;

        // Calculate estimated liquidation price (Standard isolated margin formula)
        // Long: Entry * (1 - 1/Lev)
        // Short: Entry * (1 + 1/Lev)
        let liquidationPrice;
        if (type.toLowerCase() === 'long') {
            liquidationPrice = entryPrice * (1 - (1 / leverage));
        } else {
            liquidationPrice = entryPrice * (1 + (1 / leverage));
        }

        const newStrat = {
            id,
            type: type.toLowerCase(),
            symbol: symbol.toUpperCase(),
            leverage,
            entryPrice,
            liquidationPrice,
            riskLevel: 'safe',
            // Initialize Watermarks
            lowestPrice: type.toLowerCase() === 'short' ? entryPrice : undefined,
            highestPrice: type.toLowerCase() === 'long' ? entryPrice : undefined,
            trailDist: parseFloat(trailDist),
            amount: parseFloat(amount),
            active: true,
            createdAt: Date.now()
        };

        this.state.strategies[id] = newStrat;
        this.saveState();
        this.startMonitoring(); // Ensure loop is running

        return `✅ Opened ${id} x${leverage}\nDrifters Entry: ~$${entryPrice.toFixed(2)}\nEst. Liq: $${liquidationPrice.toFixed(2)}\nTrailing Stop: ${trailDist}`;
    }

    // Quick helper if SDK price fetching is obscure
    async fetchPriceHack() {
        return 145.50; // MOCK
    }

    async processRequest(input) {
        console.log(`[${this.name}] Processing input: "${input}"`);

        // Regex: "Open Long SOL 10 Lev 5 Trail 0.5"
        // Updated to make Lev optional but preferred
        // Group 1: Type, 2: Symbol, 3: Amount, 4: Leverage (optional), 5: Trail
        const openMatch = input.match(/Open\s+(Long|Short)\s+(\w+)\s+([\d\.]+)\s+(?:Lev\s+([\d\.]+)\s+)?(?:Trail|StopTrail)\s+([\d\.]+)/i);

        if (openMatch) {
            console.log(`[${this.name}] Regex matched!`);
            const [_, type, symbol, amount, leverage, trail] = openMatch;
            return await this.openPosition(symbol, type, amount, leverage, trail);
        } else {
            console.log(`[${this.name}] Regex FAILED for input.`);
        }

        if (input.match(/start/i)) {
            this.startMonitoring();
            return "Monitoring started.";
        }
        if (input.match(/stop/i)) {
            this.stopMonitoring();
            return "Monitoring stopped.";
        }
        if (input.match(/status/i)) {
            const active = Object.values(this.state.strategies).filter(s => s.active);
            if (active.length === 0) return "No active strategies.";
            return active.map(s => {
                const water = s.type === 'short' ? s.lowestPrice : s.highestPrice;
                const stop = s.type === 'short' ? (water + s.trailDist) : (water - s.trailDist);
                const liq = s.liquidationPrice ? ` | ☠️ Liq $${s.liquidationPrice.toFixed(2)}` : '';
                return `🟢 **${s.id}** (x${s.leverage || 1}): Entry ${s.entryPrice.toFixed(2)}${liq} | Best ${water.toFixed(2)} | Stop ${stop.toFixed(2)}`;
            }).join('\n');
        }
        return "Unknown command. Try: `Open Long SOL 1 Lev 5 Trail 0.5` or `Status`.";
    }
}
