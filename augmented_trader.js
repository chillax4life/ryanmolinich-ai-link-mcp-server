import { tradingDiscipline, handleDisciplineTool } from './trading_discipline.js';
import { TechnicalIndicators } from './technical_indicators.js';
import { getTradingViewSignals } from './tradingview_service.js';
import { handleFlashExecutorTool } from './flash_executor.js';
import { PriceOracleAgent } from './agents/PriceOracleAgent.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Oracle for reliable data
const sharedOracle = new PriceOracleAgent({
  aiId: 'trader-oracle',
  name: 'TraderOracle'
});

const PENDING_TRADES_FILE = path.join(__dirname, 'pending_trades.json');
const OPEN_POSITIONS_FILE = path.join(__dirname, 'open_positions.json');

const FLASH_PROGRAM_ID = 'FLASHxQCTq2LN7PqrG6W1zhwfJ9DU8NKMfPbGcnfxj5';

function loadPendingTrades() {
  try {
    if (fs.existsSync(PENDING_TRADES_FILE)) {
      const data = JSON.parse(fs.readFileSync(PENDING_TRADES_FILE, 'utf-8'));
      const now = Date.now();
      const valid = data.filter(t => new Date(t.expiresAt).getTime() > now);
      return new Map(valid.map(t => [t.id, t]));
    }
  } catch (e) {
    console.error('[AugmentedTrader] Failed to load pending trades:', e.message);
  }
  return new Map();
}

function savePendingTrades(trades) {
  try {
    fs.writeFileSync(PENDING_TRADES_FILE, JSON.stringify(Array.from(trades.values()), null, 2));
  } catch (e) {
    console.error('[AugmentedTrader] Failed to save pending trades:', e.message);
  }
}

function loadOpenPositions() {
  try {
    if (fs.existsSync(OPEN_POSITIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(OPEN_POSITIONS_FILE, 'utf-8'));
      const valid = data.filter(t => t.status === 'open');
      return new Map(valid.map(p => [p.id, p]));
    }
  } catch (e) {
    console.error('[AugmentedTrader] Failed to load open positions:', e.message);
  }
  return new Map();
}

function saveOpenPositions(positions) {
  try {
    fs.writeFileSync(OPEN_POSITIONS_FILE, JSON.stringify(Array.from(positions.values()), null, 2));
  } catch (e) {
    console.error('[AugmentedTrader] Failed to save open positions:', e.message);
  }
}

let PENDING_TRADES = loadPendingTrades();
let OPEN_POSITIONS = loadOpenPositions();

const KNOWN_MARKETS = {
  'SOL': { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  'BTC': { mint: '3NZ9JMVBmGAqowbic2D77CwAEvkNgh5NKG7o8A3J3D7J', decimals: 6 },
  'ETH': { mint: '7vfCXTUXx5WJV5JADkB17LEWVkkvYdCJv4KCYUqFdUHA', decimals: 6 },
  'WIF': { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
  'BONK': { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 }
};

const COINGECKO_IDS = {
  'SOL': 'solana',
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'WIF': 'dogwifcoin',
  'BONK': 'bonk'
};

async function fetchPrice(symbol) {
  try {
    const sym = symbol.toUpperCase();
    
    // 1. Try Kamino Scope (Reliable Data)
    if (['SOL', 'BTC', 'ETH'].includes(sym)) {
      const price = await sharedOracle.getKaminoPrice(sym);
      if (price) return price;
    }

    // 2. Fallback to CoinGecko
    const id = COINGECKO_IDS[sym] || symbol.toLowerCase();
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const data = await response.json();
    return data[id]?.usd || null;
  } catch (e) {
    console.error(`[AugmentedTrader] Price fetch failed for ${symbol}:`, e.message);
    return null;
  }
}

async function fetchFundingRate(symbol) {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/derivatives/exchanges');
    const exchanges = await response.json();
    
    for (const exchange of exchanges) {
      if (exchange.name.toLowerCase().includes('flash') || exchange.name.toLowerCase().includes('drift')) {
        const derivatives = exchange.derivatives || [];
        const match = derivatives.find(d => d.symbol.toLowerCase().includes(symbol.toLowerCase()));
        if (match) {
          return {
            rate: parseFloat(match.funding_rate) || 0,
            exchange: exchange.name,
            nextFunding: match.expired_at
          };
        }
      }
    }
    return { rate: 0, exchange: 'unknown', nextFunding: null };
  } catch (e) {
    console.error(`[AugmentedTrader] Funding rate fetch failed:`, e.message);
    return { rate: 0, exchange: 'unknown', nextFunding: null };
  }
}

function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

async function analyzeMarket(symbol) {
  // 1. Fetch Price
  const price = await fetchPrice(symbol);
  if (!price) {
    return { error: `Could not fetch price for ${symbol}` };
  }

  // 2. Fetch Funding
  const funding = await fetchFundingRate(symbol);
  
  // 3. Fetch Candles & Calc Indicators
  let candles = [];
  try {
    // We need to define fetchCandles as a standalone function or attach to object
    // Since analyzeMarket is standalone, we'll implement fetchCandles here too or make it helper
    candles = await fetchCandles(symbol);
  } catch (e) {
    console.error('Candle fetch failed:', e.message);
  }

  // 4. Get TradingView Signals (The "Second Opinion")
  let tvSignals = null;
  try {
      tvSignals = await getTradingViewSignals(symbol);
  } catch (e) {
      console.error('TV fetch failed:', e.message);
  }

  const signals = [];
  let bias = 'neutral';
  let confidence = 50;
  let technicalSummary = null;

  // ... (Candle Analysis) ...

  // Incorporate TradingView Signals
  if (tvSignals && !tvSignals.error) {
      const tvRec = tvSignals.h1?.recommendation;
      if (tvRec) {
          signals.push({ type: 'external', signal: tvRec.toLowerCase().includes('buy') ? 'bullish' : tvRec.toLowerCase().includes('sell') ? 'bearish' : 'neutral', reason: `TradingView 1H says ${tvRec}` });
          
          if (tvRec === 'STRONG_BUY') confidence += 15;
          if (tvRec === 'BUY') confidence += 5;
          if (tvRec === 'STRONG_SELL') confidence += 15;
          if (tvRec === 'SELL') confidence += 5;
      }
  }

  if (candles && candles.length > 10) {
      const prices = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      // Mock volumes since CoinGecko OHLC doesn't give them easily
      const volumes = candles.map(() => 1000); 

      const techAnalysis = TechnicalIndicators.FullAnalysis(prices, { highs, lows, volumes });
      
      // Add Tech Signals
      techAnalysis.signals.forEach(s => {
          signals.push({ type: 'technical', signal: s.signal.toLowerCase(), reason: `${s.indicator}: ${s.reason}` });
      });

      technicalSummary = techAnalysis.summary;
      
      // Adjust Confidence based on tech
      if (techAnalysis.summary.overallBias === 'BULLISH') {
          confidence += 15;
          if (bias === 'neutral') bias = 'bullish';
      } else if (techAnalysis.summary.overallBias === 'BEARISH') {
          confidence += 15;
          if (bias === 'neutral') bias = 'bearish';
      }
  } else {
      signals.push({ type: 'warning', signal: 'neutral', reason: 'Insufficient price history for technicals' });
  }

  if (funding.rate > 0.01) {
    signals.push({ type: 'funding', signal: 'bearish', reason: `Positive funding (${(funding.rate * 100).toFixed(4)}%) suggests longs paying shorts` });
    confidence += 5;
  } else if (funding.rate < -0.01) {
    signals.push({ type: 'funding', signal: 'bullish', reason: `Negative funding (${(funding.rate * 100).toFixed(4)}%) suggests shorts paying longs` });
    confidence += 5;
  }

  if (price > 0) {
    signals.push({ type: 'price', signal: 'monitored', reason: `Current price: $${price.toFixed(2)}` });
  }

  const bullishSignals = signals.filter(s => s.signal === 'bullish').length;
  const bearishSignals = signals.filter(s => s.signal === 'bearish').length;
  
  // Recalculate final bias
  if (bullishSignals > bearishSignals) {
    bias = 'bullish';
  } else if (bearishSignals > bullishSignals) {
    bias = 'bearish';
  }

  return {
    symbol,
    price,
    funding: {
      rate: funding.rate,
      ratePercent: (funding.rate * 100).toFixed(4) + '%',
      exchange: funding.exchange,
      nextFunding: funding.nextFunding
    },
    signals,
    technicalSummary,
    tradingView: tvSignals?.summary || null,
    bias,
    confidence: Math.min(95, confidence),
    recommendation: generateRecommendation(symbol, price, bias, confidence),
    timestamp: new Date().toISOString()
  };
}

// Standalone fetchCandles helper
async function fetchCandles(symbol) {
    const id = COINGECKO_IDS[symbol.toUpperCase()] || symbol.toLowerCase();
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=1`);
      if (res.ok) {
        const data = await res.json();
        return data.map(d => ({
          time: d[0],
          open: d[1],
          high: d[2],
          low: d[3],
          close: d[4],
          volume: 0
        }));
      }
    } catch (e) {
        console.error('Candle fetch error:', e.message);
    }
    return [];
}

function generateRecommendation(symbol, price, bias, confidence) {
  if (confidence < 60) {
    return {
      action: 'wait',
      reason: 'Confidence too low for a trade. Wait for clearer signals.',
      suggestedSize: 0,
      suggestedLeverage: 1
    };
  }

  const size = confidence > 75 ? 5 : confidence > 65 ? 3 : 1;
  const leverage = confidence > 75 ? 20 : confidence > 65 ? 10 : 5;
  const side = bias === 'bullish' ? 'long' : bias === 'bearish' ? 'short' : null;

  if (!side) {
    return {
      action: 'wait',
      reason: 'Neutral bias - no clear direction',
      suggestedSize: 0,
      suggestedLeverage: 1
    };
  }

  const slDistance = side === 'long' ? price * 0.02 : price * 0.02;
  const tpDistance = side === 'long' ? price * 0.04 : price * 0.04;
  const stopLoss = side === 'long' ? price - slDistance : price + slDistance;
  const takeProfit = side === 'long' ? price + tpDistance : price - tpDistance;
  const riskAmount = size * (slDistance / price) * leverage;

  return {
    action: 'trade',
    side,
    reason: `${bias.toUpperCase()} bias with ${confidence}% confidence`,
    suggestedSize: size,
    suggestedLeverage: leverage,
    entryPrice: price,
    stopLoss: stopLoss.toFixed(2),
    takeProfit: takeProfit.toFixed(2),
    riskAmount: riskAmount.toFixed(2),
    riskPercent: ((riskAmount / 20) * 100).toFixed(1)
  };
}

function prepareTrade(params) {
  const { symbol, side, size, leverage, entryPrice, stopLoss, collateralUsd } = params;
  
  const disciplineCheck = tradingDiscipline.canTrade();
  if (!disciplineCheck.allowed) {
    return {
      prepared: false,
      reason: 'Trading not allowed',
      discipline: disciplineCheck.reasons
    };
  }

  const price = entryPrice || 150;
  const sl = stopLoss || (side === 'long' ? price * 0.98 : price * 1.02);
  const slDistance = Math.abs(price - sl);
  const riskAmount = size * (slDistance / price) * leverage;
  const liquidationPrice = side === 'long' 
    ? price * (1 - (1 / leverage)) 
    : price * (1 + (1 / leverage));

  const tradeId = `TRADE-${Date.now()}`;
  const trade = {
    id: tradeId,
    symbol: symbol.toUpperCase(),
    side: side.toLowerCase(),
    size: parseFloat(size),
    leverage: parseFloat(leverage) || 20,
    collateralUsd: parseFloat(collateralUsd) || 1.0, // Default to $1.00 for safety
    entryPrice: parseFloat(price),
    stopLoss: parseFloat(sl),
    riskAmount: parseFloat(riskAmount.toFixed(2)),
    liquidationPrice: parseFloat(liquidationPrice.toFixed(2)),
    status: 'prepared',
    preparedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString()
  };

  PENDING_TRADES.set(tradeId, trade);
  savePendingTrades(PENDING_TRADES);

  return {
    prepared: true,
    trade,
    message: `**TRADE PREPARED: ${trade.side.toUpperCase()} ${trade.symbol}**\n\n` +
      `📊 Entry: $${trade.entryPrice.toFixed(2)}\n` +
      `📈 Size: $${trade.size} @ ${trade.leverage}x\n` +
      `🎯 Stop Loss: $${trade.stopLoss.toFixed(2)}\n` +
      `💀 Liquidation: $${trade.liquidationPrice.toFixed(2)}\n` +
      `⚠️ Risk: $${trade.riskAmount}\n\n` +
      `⏰ Expires in 60 seconds\n\n` +
      `Reply **CONFIRM ${tradeId}** to execute or **CANCEL ${tradeId}** to abort.`
  };
}

async function executeTrade(tradeId, wallet = null) {
  const trade = PENDING_TRADES.get(tradeId);
  
  if (!trade) {
    return { executed: false, reason: `Trade ${tradeId} not found or expired` };
  }

  if (new Date() > new Date(trade.expiresAt)) {
    PENDING_TRADES.delete(tradeId);
    savePendingTrades(PENDING_TRADES);
    return { executed: false, reason: 'Trade expired' };
  }

  const disciplineCheck = tradingDiscipline.canTrade();
  if (!disciplineCheck.allowed) {
    PENDING_TRADES.delete(tradeId);
    savePendingTrades(PENDING_TRADES);
    return { executed: false, reason: 'Trading not allowed', discipline: disciplineCheck.reasons };
  }

  trade.status = 'executing';
  trade.executedAt = new Date().toISOString();

  try {
    // 1. Attempt REAL Execution via Flash Executor if TRADING_MODE is set
    // This will return a 'prepared' on-chain state requiring one more 'EXECUTE FLASH' confirmation
    if (process.env.TRADING_MODE === 'live' || process.env.TRADING_MODE === 'paper') {
        const flashResult = await handleFlashExecutorTool('flash_open_position', {
            symbol: trade.symbol,
            side: trade.side,
            sizeUsd: trade.size,
            collateralUsd: trade.collateralUsd || 1.0,
            leverage: trade.leverage
        });

        if (flashResult.prepared) {
            PENDING_TRADES.delete(tradeId);
            savePendingTrades(PENDING_TRADES);
            return {
                executed: true,
                status: 'prepared_on_chain',
                message: `✅ **ON-CHAIN POSITION PREPARED (${process.env.TRADING_MODE.toUpperCase()})**\n\n` +
                         `The Flash.trade transaction is ready.\n` +
                         `Reply **EXECUTE FLASH** to sign and broadcast.`
            };
        } else if (flashResult.error) {
            throw new Error(`Flash Executor failed: ${flashResult.error}`);
        }
    }

    // 2. Fallback to Mock Execution (Standard)
    const position = {
      ...trade,
      id: `POS-${trade.symbol}-${Date.now().toString().slice(-4)}`,
      status: 'open',
      openedAt: trade.executedAt,
      highestPrice: trade.side === 'long' ? trade.entryPrice : null,
      lowestPrice: trade.side === 'short' ? trade.entryPrice : null,
      trailingStopDistance: Math.abs(trade.entryPrice - trade.stopLoss)
    };

    OPEN_POSITIONS.set(position.id, position);
    PENDING_TRADES.delete(tradeId);
    saveOpenPositions(OPEN_POSITIONS);
    savePendingTrades(PENDING_TRADES);

    tradingDiscipline.recordTrade({
      symbol: trade.symbol,
      type: 'perp',
      side: trade.side,
      size: trade.size,
      leverage: trade.leverage,
      entryPrice: trade.entryPrice,
      reason: 'manual',
      status: 'open'
    });

    return {
      executed: true,
      position,
      message: `✅ **TRADE EXECUTED: ${trade.side.toUpperCase()} ${trade.symbol}**\n\n` +
        `📊 Entry: $${trade.entryPrice.toFixed(2)}\n` +
        `📈 Size: $${trade.size} @ ${trade.leverage}x\n` +
        `🎯 Stop Loss: $${trade.stopLoss.toFixed(2)}\n` +
        `💀 Liquidation: $${trade.liquidationPrice.toFixed(2)}\n` +
        `🆔 Position ID: ${position.id}\n\n` +
        `Position is now active. Use "position status ${position.id}" to monitor.`
    };
  } catch (e) {
    trade.status = 'failed';
    trade.error = e.message;
    return { executed: false, reason: e.message };
  }
}

function cancelTrade(tradeId) {
  const trade = PENDING_TRADES.get(tradeId);
  if (!trade) {
    return { cancelled: false, reason: `Trade ${tradeId} not found` };
  }
  
  PENDING_TRADES.delete(tradeId);
  savePendingTrades(PENDING_TRADES);
  return { cancelled: true, tradeId };
}

function listPositions() {
  const positions = Array.from(OPEN_POSITIONS.values()).filter(p => p.status === 'open');
  
  if (positions.length === 0) {
    return { positions: [], message: 'No open positions.' };
  }

  return {
    count: positions.length,
    positions: positions.map(p => ({
      id: p.id,
      symbol: p.symbol,
      side: p.side,
      size: p.size,
      leverage: p.leverage,
      entryPrice: p.entryPrice,
      stopLoss: p.stopLoss,
      liquidationPrice: p.liquidationPrice,
      status: p.status,
      openedAt: p.openedAt
    })),
    message: positions.map(p => 
      `🟢 **${p.id}**: ${p.side.toUpperCase()} ${p.symbol} $${p.size} @ ${p.leverage}x\n` +
      `   Entry: $${p.entryPrice.toFixed(2)} | SL: $${p.stopLoss.toFixed(2)} | Liq: $${p.liquidationPrice.toFixed(2)}`
    ).join('\n\n')
  };
}

async function closePosition(positionId, currentPrice = null) {
  const position = OPEN_POSITIONS.get(positionId);
  
  if (!position) {
    return { closed: false, reason: `Position ${positionId} not found` };
  }

  if (position.status !== 'open') {
    return { closed: false, reason: `Position is already ${position.status}` };
  }

  const exitPrice = currentPrice || position.entryPrice * (position.side === 'long' ? 1.01 : 0.99);
  const pnl = position.side === 'long'
    ? (exitPrice - position.entryPrice) * position.size * position.leverage / position.entryPrice
    : (position.entryPrice - exitPrice) * position.size * position.leverage / position.entryPrice;
  const pnlPercent = (pnl / position.size) * 100;

  position.status = 'closed';
  position.closedAt = new Date().toISOString();
  position.exitPrice = exitPrice;
  position.pnl = pnl;
  position.pnlPercent = pnlPercent;

  OPEN_POSITIONS.set(positionId, position);
  saveOpenPositions(OPEN_POSITIONS);

  tradingDiscipline.recordTrade({
    symbol: position.symbol,
    type: 'perp',
    side: position.side,
    size: position.size,
    leverage: position.leverage,
    entryPrice: position.entryPrice,
    exitPrice,
    pnl,
    pnlPercent,
    reason: 'manual_close',
    status: 'closed'
  });

  const emoji = pnl >= 0 ? '🟢' : '🔴';
  return {
    closed: true,
    position,
    pnl,
    pnlPercent,
    message: `${emoji} **POSITION CLOSED: ${positionId}**\n\n` +
      `📊 Entry: $${position.entryPrice.toFixed(2)}\n` +
      `🚪 Exit: $${exitPrice.toFixed(2)}\n` +
      `💰 PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)\n\n` +
      `Position has been closed.`
  };
}

function getPendingTrades() {
  PENDING_TRADES = loadPendingTrades();
  const now = new Date();
  
  for (const [id, trade] of PENDING_TRADES) {
    if (new Date(trade.expiresAt) < now) {
      PENDING_TRADES.delete(id);
    }
  }
  savePendingTrades(PENDING_TRADES);
  
  return {
    count: PENDING_TRADES.size,
    trades: Array.from(PENDING_TRADES.values())
  };
}

export function getAugmentedTraderTools() {
  return [
    {
      name: 'trading_analyze',
      description: 'Analyze a token for trading: price, funding rate, signals, and recommendation. Use before preparing a trade.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Token symbol (e.g., SOL, BTC, ETH)' }
        },
        required: ['symbol']
      }
    },
    {
      name: 'trading_prepare',
      description: 'Prepare a trade for human confirmation. Shows risk, stop loss, liquidation price. User must CONFIRM before execution.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Token symbol' },
          side: { type: 'string', enum: ['long', 'short'], description: 'Trade direction' },
          size: { type: 'number', description: 'Position size in USD (minimum $1)' },
          leverage: { type: 'number', description: 'Leverage (default 20)' },
          collateralUsd: { type: 'number', description: 'Collateral to use in USD (default $1.00)' },
          entryPrice: { type: 'number', description: 'Entry price (optional, uses current)' },
          stopLoss: { type: 'number', description: 'Stop loss price (optional, auto-calculated)' }
        },
        required: ['symbol', 'side', 'size']
      }
    },
    {
      name: 'trading_execute',
      description: 'Execute a prepared trade after user confirmation. Requires the tradeId from trading_prepare.',
      inputSchema: {
        type: 'object',
        properties: {
          tradeId: { type: 'string', description: 'Trade ID from trading_prepare' }
        },
        required: ['tradeId']
      }
    },
    {
      name: 'trading_cancel',
      description: 'Cancel a prepared trade before execution.',
      inputSchema: {
        type: 'object',
        properties: {
          tradeId: { type: 'string', description: 'Trade ID to cancel' }
        },
        required: ['tradeId']
      }
    },
    {
      name: 'trading_positions',
      description: 'List all open positions with entry, stop loss, and liquidation prices.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'trading_close',
      description: 'Close an open position. Records PnL and updates discipline tracking.',
      inputSchema: {
        type: 'object',
        properties: {
          positionId: { type: 'string', description: 'Position ID to close' },
          currentPrice: { type: 'number', description: 'Current price (optional)' }
        },
        required: ['positionId']
      }
    },
    {
      name: 'trading_best_opportunity',
      description: 'Analyze all supported symbols and return the single best trading opportunity based on highest confidence.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'trading_pending',
      description: 'List trades awaiting confirmation.',
      inputSchema: { type: 'object', properties: {} }
    }
  ];
}

async function findBestOpportunity() {
  const symbols = ['SOL', 'BTC', 'ETH', 'WIF', 'BONK'];
  const results = await Promise.all(symbols.map(s => analyzeMarket(s)));
  
  const validTrades = results
    .filter(r => !r.error && r.recommendation.action === 'trade')
    .sort((a, b) => b.confidence - a.confidence);

  if (validTrades.length === 0) {
    return {
      message: "No strong opportunities detected across " + symbols.join(', '),
      recommendation: { action: 'wait', reason: 'Low market confidence' }
    };
  }

  const best = validTrades[0];
  return {
    message: `🌟 **BEST OPPORTUNITY FOUND**: ${best.symbol} (${best.confidence}% Confidence)`,
    bestOpportunity: best
  };
}

export async function handleAugmentedTraderTool(name, args) {
  switch (name) {
    case 'trading_analyze':
      return await analyzeMarket(args.symbol);

    case 'trading_best_opportunity':
      return await findBestOpportunity();

    case 'trading_prepare':
      return prepareTrade(args);

    case 'trading_execute':
      return await executeTrade(args.tradeId);

    case 'trading_cancel':
      return cancelTrade(args.tradeId);

    case 'trading_positions':
      return listPositions();

    case 'trading_close':
      return await closePosition(args.positionId, args.currentPrice);

    case 'trading_pending':
      return getPendingTrades();

    default:
      throw new Error(`Unknown augmented trader tool: ${name}`);
  }
}

export { OPEN_POSITIONS, PENDING_TRADES };
