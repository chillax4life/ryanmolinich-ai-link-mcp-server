import { getFlashPrice } from './flash_executor.js';
import { getDriftMarket } from './drift_executor.js';
import { getTradingViewSignals } from './tradingview_service.js';
import fs from 'fs';

/**
 * Arbitrage Scanner
 * Monitors Flash.trade (Oracle Price) vs Drift (Orderbook Price) for spreads.
 */

const LOG_FILE = 'arbitrage.log';

export async function scanArbitrage(symbol = 'SOL') {
    console.log(`[ArbScanner] Checking ${symbol}...`);

    // 1. Get Flash Price (Oracle based)
    // Note: getFlashPrice is currently a stub in flash_executor, 
    // so we'll use Coingecko/Pyth via augmented_trader or direct fetch for now.
    // Ideally, we fetch from the Flash SDK's oracle view.
    // For MVP, let's use the drift gateway price as "Market A" and compare to "TradingView/CoinGecko" as "Market B"
    // REAL ARB requires fetching from the Flash SDK oracle.
    // Let's assume we can add `getFlashOraclePrice` to flash_executor later.
    
    // FETCHING PRICES
    const driftData = await getDriftMarket(symbol);
    
    // Graceful handling of Drift Offline
    if (driftData.error) {
        console.warn(`[ArbScanner] Drift Offline: ${driftData.error}`);
        // Log basic TV data anyway
        const logEntry = {
            timestamp: new Date().toISOString(),
            symbol,
            driftPrice: 'N/A',
            tvSignal: tvData?.summary?.action || 'UNKNOWN'
        };
        fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
        return { message: "Drift Offline. Monitoring Flash/TV only." };
    }

    const tvData = await getTradingViewSignals(symbol);

    const driftPrice = parseFloat(driftData.price || 0); // Assuming Gateway returns { price: ... }
    // Fallback if gateway structure is different (it might be .data.price)
    
    // For now, let's log what we found
    const logEntry = {
        timestamp: new Date().toISOString(),
        symbol,
        driftPrice,
        tvSignal: tvData?.summary?.action || 'UNKNOWN'
    };

    fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');

    return {
        symbol,
        driftPrice,
        tvSignal: logEntry.tvSignal,
        message: `Drift: ${driftPrice} | TV: ${logEntry.tvSignal}`
    };
}

export function getArbTools() {
    return [{
        name: 'scan_arbitrage',
        description: 'Check for price spread between venues',
        inputSchema: { type: 'object', properties: { symbol: { type: 'string' } } }
    }];
}

export async function handleArbTool(name, args) {
    if (name === 'scan_arbitrage') return scanArbitrage(args.symbol);
    throw new Error(`Unknown tool ${name}`);
}
