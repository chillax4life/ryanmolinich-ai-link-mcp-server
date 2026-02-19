import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COINGLASS_CACHE_FILE = path.join(__dirname, 'coinglass_cache.json');
const CACHE_TTL_MS = 60000;

let coinglassApiKey = process.env.COINGLASS_API_KEY || null;

export function setCoinGlassApiKey(key) {
    coinglassApiKey = key;
    return { configured: true };
}

function loadCache() {
    try {
        if (fs.existsSync(COINGLASS_CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(COINGLASS_CACHE_FILE, 'utf-8'));
        }
    } catch (e) {}
    return {};
}

function saveCache(cache) {
    try {
        fs.writeFileSync(COINGLASS_CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (e) {}
}

async function coinglassFetch(endpoint, params = {}) {
    if (!coinglassApiKey) {
        return { error: 'COINGLASS_API_KEY not configured. Get free key at https://www.coinglass.com/CryptoApi' };
    }

    const cache = loadCache();
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL_MS) {
        return cache[cacheKey].data;
    }

    const url = new URL(`https://open-api-v4.coinglass.com${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

    try {
        const res = await fetch(url.toString(), {
            headers: {
                'CG-API-KEY': coinglassApiKey,
                'accept': 'application/json'
            }
        });

        const data = await res.json();
        
        if (data.code !== '0') {
            return { error: data.msg || 'CoinGlass API error' };
        }

        cache[cacheKey] = { data: data.data, timestamp: Date.now() };
        saveCache(cache);
        
        return data.data;
    } catch (e) {
        return { error: e.message };
    }
}

export async function getLiquidationHeatmap(symbol = 'BTC', exchange = 'Binance') {
    const data = await coinglassFetch('/api/futures/liquidation/heatmap/model1', {
        symbol: symbol.toUpperCase(),
        exchange
    });

    if (data.error) return data;

    const levels = [];
    if (data.liquidation_leverage_data) {
        for (const [x, y, amount] of data.liquidation_leverage_data) {
            const price = data.y_axis?.[y];
            if (price && amount > 100000) {
                levels.push({ price, amount, significance: amount > 1000000 ? 'HIGH' : 'MEDIUM' });
            }
        }
    }

    levels.sort((a, b) => b.amount - a.amount);

    return {
        symbol,
        exchange,
        topLiquidationLevels: levels.slice(0, 10),
        priceCandlesticks: data.price_candlesticks?.slice(-10) || [],
        timestamp: new Date().toISOString()
    };
}

export async function getLiquidationMap(symbol = 'BTC', exchange = 'Binance') {
    const data = await coinglassFetch('/api/futures/liquidation/map', {
        symbol: symbol.toUpperCase(),
        exchange
    });

    if (data.error) return data;

    const longLevels = [];
    const shortLevels = [];

    if (data.data) {
        for (const [price, amount, leverage] of Object.values(data.data)) {
            const level = { price: price[0], amount: price[1], leverage: price[2] };
            if (level.leverage > 0) {
                longLevels.push(level);
            } else {
                shortLevels.push(level);
            }
        }
    }

    return {
        symbol,
        exchange,
        longLiquidationLevels: longLevels.sort((a, b) => b.amount - a.amount).slice(0, 10),
        shortLiquidationLevels: shortLevels.sort((a, b) => b.amount - a.amount).slice(0, 10),
        timestamp: new Date().toISOString()
    };
}

export async function getFundingRates(symbols = ['BTC', 'ETH', 'SOL']) {
    const data = await coinglassFetch('/api/futures/funding_rates/v2', {
        symbol: symbols.join(','),
        exchange: 'Binance'
    });

    if (data.error) return data;

    const rates = {};
    if (Array.isArray(data)) {
        for (const item of data) {
            rates[item.symbol] = {
                rate: parseFloat(item.uMarginList?.[0]?.rate || 0),
                ratePercent: `${(parseFloat(item.uMarginList?.[0]?.rate || 0) * 100).toFixed(4)}%`,
                exchange: item.uMarginList?.[0]?.exchangeName || 'Unknown',
                nextFundingTime: item.uMarginList?.[0]?.nextFundingTime
            };
        }
    }

    return {
        rates,
        timestamp: new Date().toISOString()
    };
}

export async function getOpenInterest(symbol = 'BTC') {
    const data = await coinglassFetch('/api/futures/openInterest', {
        symbol: symbol.toUpperCase(),
        exchange: 'Binance'
    });

    if (data.error) return data;

    return {
        symbol,
        openInterest: data.openInterest || null,
        openInterestUsd: data.openInterestUsd || null,
        changePercent: data.changePercent || null,
        timestamp: new Date().toISOString()
    };
}

export async function getLongShortRatio(symbol = 'BTC', interval = '1h') {
    const data = await coinglassFetch('/api/futures/longShortRatio', {
        symbol: symbol.toUpperCase(),
        interval
    });

    if (data.error) return data;

    const latest = Array.isArray(data) ? data[data.length - 1] : null;

    return {
        symbol,
        interval,
        longRatio: latest?.longRatio || null,
        shortRatio: latest?.shortRatio || null,
        longShortRatio: latest?.longShortRatio || null,
        sentiment: latest?.longShortRatio > 1 ? 'BULLISH' : latest?.longShortRatio < 1 ? 'BEARISH' : 'NEUTRAL',
        timestamp: new Date().toISOString()
    };
}

export async function getLiquidationHistory(symbol = 'BTC', exchange = 'Binance', interval = '4h') {
    const data = await coinglassFetch('/api/futures/liquidation/history', {
        symbol: symbol.toUpperCase(),
        exchange,
        interval
    });

    if (data.error) return data;

    const recent = Array.isArray(data) ? data.slice(-24) : [];
    let totalLong = 0;
    let totalShort = 0;

    for (const item of recent) {
        totalLong += parseFloat(item.long_liquidation_usd || 0);
        totalShort += parseFloat(item.short_liquidation_usd || 0);
    }

    return {
        symbol,
        exchange,
        interval,
        totalLongLiquidations24h: totalLong,
        totalShortLiquidations24h: totalShort,
        netLiquidationBias: totalLong > totalShort ? 'LONGS_REKT' : totalShort > totalLong ? 'SHORTS_REKT' : 'BALANCED',
        history: recent.map(h => ({
            time: new Date(h.time).toISOString(),
            longUsd: parseFloat(h.long_liquidation_usd || 0),
            shortUsd: parseFloat(h.short_liquidation_usd || 0)
        })),
        timestamp: new Date().toISOString()
    };
}

export async function getMarketIntelligence(symbol = 'SOL') {
    const [funding, oi, ratio, liqHistory, heatmap] = await Promise.all([
        getFundingRates([symbol]),
        getOpenInterest(symbol),
        getLongShortRatio(symbol),
        getLiquidationHistory(symbol),
        getLiquidationHeatmap(symbol)
    ]);

    const analysis = {
        symbol: symbol.toUpperCase(),
        timestamp: new Date().toISOString(),
        funding: funding.rates?.[symbol.toUpperCase()] || funding,
        openInterest: oi,
        longShortRatio: ratio,
        liquidationHistory: {
            totalLongLiquidations24h: liqHistory.totalLongLiquidations24h,
            totalShortLiquidations24h: liqHistory.totalShortLiquidations24h,
            netBias: liqHistory.netLiquidationBias
        },
        liquidationHeatmap: heatmap.topLiquidationLevels?.slice(0, 5) || [],
        sentiment: analyzeSentiment(funding, oi, ratio, liqHistory)
    };

    return analysis;
}

function analyzeSentiment(funding, oi, ratio, liqHistory) {
    let bullishSignals = 0;
    let bearishSignals = 0;
    const reasons = [];

    if (ratio.sentiment === 'BULLISH') {
        bullishSignals++;
        reasons.push(`Long/short ratio bullish (${ratio.longShortRatio?.toFixed(2) || 'N/A'})`);
    } else if (ratio.sentiment === 'BEARISH') {
        bearishSignals++;
        reasons.push(`Long/short ratio bearish (${ratio.longShortRatio?.toFixed(2) || 'N/A'})`);
    }

    if (liqHistory.netLiquidationBias === 'LONGS_REKT') {
        bearishSignals += 2;
        reasons.push('Recent long liquidations dominate');
    } else if (liqHistory.netLiquidationBias === 'SHORTS_REKT') {
        bullishSignals += 2;
        reasons.push('Recent short liquidations dominate');
    }

    const netScore = bullishSignals - bearishSignals;
    let bias;
    if (netScore >= 2) bias = 'BULLISH';
    else if (netScore <= -2) bias = 'BEARISH';
    else bias = 'NEUTRAL';

    return {
        bias,
        confidence: Math.min(100, Math.abs(netScore) * 25 + 25),
        signals: reasons,
        bullishScore: bullishSignals,
        bearishScore: bearishSignals
    };
}

export function getMarketIntelligenceTools() {
    return [
        {
            name: 'market_liquidation_heatmap',
            description: 'Get liquidation heatmap showing where stop losses are clustered. Essential for identifying support/resistance from liquidation cascades.',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string', description: 'Trading pair symbol (e.g., BTC, SOL)' },
                    exchange: { type: 'string', description: 'Exchange (default: Binance)' }
                },
                required: ['symbol']
            }
        },
        {
            name: 'market_funding_rates',
            description: 'Get funding rates across exchanges. Positive = longs pay shorts (bearish), Negative = shorts pay longs (bullish).',
            inputSchema: {
                type: 'object',
                properties: {
                    symbols: { type: 'array', items: { type: 'string' }, description: 'Symbols to check (default: BTC, ETH, SOL)' }
                }
            }
        },
        {
            name: 'market_long_short_ratio',
            description: 'Get long/short ratio showing market positioning. >1 = more longs, <1 = more shorts.',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string', description: 'Trading pair symbol' },
                    interval: { type: 'string', description: 'Time interval (5m, 15m, 1h, 4h, 1d)' }
                },
                required: ['symbol']
            }
        },
        {
            name: 'market_open_interest',
            description: 'Get open interest data. Rising OI + price up = strong trend. Falling OI = positions closing.',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string', description: 'Trading pair symbol' }
                },
                required: ['symbol']
            }
        },
        {
            name: 'market_liquidation_history',
            description: 'Get historical liquidation data. Shows which side is getting rekt recently.',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string', description: 'Trading pair symbol' },
                    exchange: { type: 'string', description: 'Exchange (default: Binance)' },
                    interval: { type: 'string', description: 'Time interval (default: 4h)' }
                },
                required: ['symbol']
            }
        },
        {
            name: 'market_intelligence',
            description: 'Get comprehensive market intelligence: funding rates, OI, long/short ratio, liquidations, and sentiment analysis. Use this for full analysis.',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string', description: 'Trading pair symbol (e.g., SOL, BTC)' }
                },
                required: ['symbol']
            }
        },
        {
            name: 'market_set_coinglass_key',
            description: 'Set CoinGlass API key for market intelligence features. Get free key at https://www.coinglass.com/CryptoApi',
            inputSchema: {
                type: 'object',
                properties: {
                    apiKey: { type: 'string', description: 'CoinGlass API key' }
                },
                required: ['apiKey']
            }
        }
    ];
}

export async function handleMarketIntelligenceTool(name, args) {
    switch (name) {
        case 'market_liquidation_heatmap':
            return await getLiquidationHeatmap(args.symbol, args.exchange);
        case 'market_funding_rates':
            return await getFundingRates(args.symbols);
        case 'market_long_short_ratio':
            return await getLongShortRatio(args.symbol, args.interval);
        case 'market_open_interest':
            return await getOpenInterest(args.symbol);
        case 'market_liquidation_history':
            return await getLiquidationHistory(args.symbol, args.exchange, args.interval);
        case 'market_intelligence':
            return await getMarketIntelligence(args.symbol);
        case 'market_set_coinglass_key':
            return setCoinGlassApiKey(args.apiKey);
        default:
            throw new Error(`Unknown market intelligence tool: ${name}`);
    }
}
