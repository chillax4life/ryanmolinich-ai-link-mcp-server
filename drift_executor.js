import fetch from 'node-fetch';

const GATEWAY_URL = process.env.DRIFT_GATEWAY_URL || 'http://127.0.0.1:8080';

/**
 * Drift Executor
 * Talks to the local drift-gateway sidecar (Rust) to execute trades.
 */

export async function getDriftMarket(symbol = 'SOL-PERP') {
    try {
        // Check connectivity first to fail fast
        try {
            const health = await fetch(`${GATEWAY_URL}/health`).catch(() => null);
            if (!health) return { error: 'Drift Gateway is OFFLINE. Check container.' };
        } catch (e) { return { error: 'Drift Gateway unreachable' }; }

        // Drift uses "SOL-PERP" format. Normalize input.
        const market = symbol.toUpperCase().endsWith('-PERP') ? symbol.toUpperCase() : `${symbol.toUpperCase()}-PERP`;
        
        const res = await fetch(`${GATEWAY_URL}/v2/markets?symbol=${market}`);
        if (!res.ok) throw new Error(`Gateway Error: ${res.statusText}`);
        
        const data = await res.json();
        return data; // Returns price, funding, etc.
    } catch (e) {
        return { error: `Failed to fetch Drift market: ${e.message}` };
    }
}

export async function getDriftPosition(symbol = 'SOL-PERP') {
    try {
        const market = symbol.toUpperCase().endsWith('-PERP') ? symbol.toUpperCase() : `${symbol.toUpperCase()}-PERP`;
        
        const res = await fetch(`${GATEWAY_URL}/v2/positions`);
        if (!res.ok) throw new Error(`Gateway Error: ${res.statusText}`);
        
        const positions = await res.json();
        const pos = positions.find(p => p.marketSymbol === market);
        
        if (!pos) return { message: 'No open position.' };
        
        return {
            symbol: pos.marketSymbol,
            side: parseFloat(pos.baseAssetAmount) > 0 ? 'LONG' : 'SHORT',
            size: parseFloat(pos.baseAssetAmount),
            entryPrice: parseFloat(pos.entryPrice),
            pnl: parseFloat(pos.unrealizedPnl),
            leverage: parseFloat(pos.leverage)
        };
    } catch (e) {
        return { error: `Failed to fetch Drift position: ${e.message}` };
    }
}

export async function openDriftPosition(params) {
    const { symbol, side, amount } = params; // amount in Token units (e.g. 1 SOL)
    
    try {
        const market = symbol.toUpperCase().endsWith('-PERP') ? symbol.toUpperCase() : `${symbol.toUpperCase()}-PERP`;
        
        const body = {
            market,
            direction: side.toUpperCase(), // LONG / SHORT
            amount: parseFloat(amount),
            type: 'market',
            reduceOnly: false
        };

        const res = await fetch(`${GATEWAY_URL}/v2/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Gateway Reject: ${err}`);
        }

        const data = await res.json();
        return {
            success: true,
            tx: data.txSignature,
            message: `Drift Order Placed: ${side} ${amount} ${market}`
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

export async function closeDriftPosition(symbol) {
    try {
        const market = symbol.toUpperCase().endsWith('-PERP') ? symbol.toUpperCase() : `${symbol.toUpperCase()}-PERP`;
        
        // Fetch position to know size/direction
        const pos = await getDriftPosition(market);
        if (pos.error || pos.message) return { error: "No position to close." };

        const body = {
            market,
            direction: pos.side === 'LONG' ? 'SHORT' : 'LONG',
            amount: Math.abs(pos.size),
            type: 'market',
            reduceOnly: true
        };

        const res = await fetch(`${GATEWAY_URL}/v2/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        return {
            success: true,
            tx: data.txSignature,
            message: `Drift Position Closed: ${market}`
        };

    } catch (e) {
        return { success: false, error: e.message };
    }
}

// --- MCP TOOLS MAPPING ---

export function getDriftExecutorTools() {
    return [
        {
            name: 'drift_get_price',
            description: 'Get price/funding for a Drift market (via Gateway sidecar)',
            inputSchema: {
                type: 'object',
                properties: { symbol: { type: 'string', description: 'e.g. SOL' } },
                required: ['symbol']
            }
        },
        {
            name: 'drift_get_position',
            description: 'Get open position for a Drift market',
            inputSchema: {
                type: 'object',
                properties: { symbol: { type: 'string' } },
                required: ['symbol']
            }
        },
        {
            name: 'drift_open_position',
            description: 'Open a position on Drift Protocol',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    side: { type: 'string', enum: ['long', 'short'] },
                    amount: { type: 'number', description: 'Amount in Token units (e.g. 1.5 SOL)' }
                },
                required: ['symbol', 'side', 'amount']
            }
        },
        {
            name: 'drift_close_position',
            description: 'Close position on Drift Protocol',
            inputSchema: {
                type: 'object',
                properties: { symbol: { type: 'string' } },
                required: ['symbol']
            }
        }
    ];
}

export async function handleDriftExecutorTool(name, args) {
    switch (name) {
        case 'drift_get_price': return getDriftMarket(args.symbol);
        case 'drift_get_position': return getDriftPosition(args.symbol);
        case 'drift_open_position': return openDriftPosition(args);
        case 'drift_close_position': return closeDriftPosition(args.symbol);
        default: throw new Error(`Unknown drift tool: ${name}`);
    }
}
