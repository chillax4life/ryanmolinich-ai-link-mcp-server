import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(__dirname, 'trading_discipline_state.json');
const TRADE_LOG_FILE = path.join(__dirname, 'trade_log.json');
const JOURNAL_CSV_FILE = path.join(__dirname, 'journal.csv');

const DEFAULT_CONFIG = {
  maxTradesPerDay: 3,
  maxDailyLossPercent: 2.0,
  maxConsecutiveLosses: 2,
  minTradeSize: 1.0,
  defaultLeverage: 20,
  // Hard Safety Limits
  maxDailyLossUsd: parseFloat(process.env.MAX_DAILY_LOSS_USD || '50'),
  maxPositionSizeUsd: parseFloat(process.env.MAX_POSITION_SIZE_USD || '100'),
  tradingMode: process.env.TRADING_MODE || 'paper'
};

class TradingDiscipline {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.loadState();
    this.tradeLog = this.loadTradeLog();
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        const today = new Date().toISOString().split('T')[0];
        if (data.date !== today) {
          return this.resetDailyState();
        }
        return data;
      }
    } catch (e) {
      console.error('[TradingDiscipline] Failed to load state:', e.message);
    }
    return this.resetDailyState();
  }

  resetDailyState() {
    return {
      date: new Date().toISOString().split('T')[0],
      tradeCount: 0,
      dailyPnL: 0,
      consecutiveLosses: 0,
      startingBalance: null,
      halted: false,
      haltReason: null
    };
  }

  saveState() {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch (e) {
      console.error('[TradingDiscipline] Failed to save state:', e.message);
    }
  }

  loadTradeLog() {
    try {
      if (fs.existsSync(TRADE_LOG_FILE)) {
        return JSON.parse(fs.readFileSync(TRADE_LOG_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('[TradingDiscipline] Failed to load trade log:', e.message);
    }
    return [];
  }

  saveTradeLog() {
    try {
      fs.writeFileSync(TRADE_LOG_FILE, JSON.stringify(this.tradeLog, null, 2));
    } catch (e) {
      console.error('[TradingDiscipline] Failed to save trade log:', e.message);
    }
  }

  appendToCsv(trade) {
    try {
      const headers = ['id', 'timestamp', 'symbol', 'side', 'size', 'leverage', 'entryPrice', 'exitPrice', 'pnl', 'status', 'reason'];
      const row = headers.map(h => trade[h] || '').join(',');
      
      if (!fs.existsSync(JOURNAL_CSV_FILE)) {
        fs.writeFileSync(JOURNAL_CSV_FILE, headers.join(',') + '\n');
      }
      
      fs.appendFileSync(JOURNAL_CSV_FILE, row + '\n');
    } catch (e) {
      console.error('[TradingDiscipline] Failed to append to CSV:', e.message);
    }
  }

  canTrade(currentBalance = null) {
    const reasons = [];
    let allowed = true;

    if (this.state.halted) {
      allowed = false;
      reasons.push(`HALTED: ${this.state.haltReason}`);
    }

    if (this.state.tradeCount >= this.config.maxTradesPerDay) {
      allowed = false;
      reasons.push(`Daily trade limit reached (${this.state.tradeCount}/${this.config.maxTradesPerDay})`);
    }

    if (this.state.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      allowed = false;
      reasons.push(`Consecutive loss limit reached (${this.state.consecutiveLosses}/${this.config.maxConsecutiveLosses})`);
    }

    if (currentBalance !== null && this.state.startingBalance !== null) {
      const pnlPercent = ((currentBalance - this.state.startingBalance) / this.state.startingBalance) * 100;
      if (pnlPercent <= -this.config.maxDailyLossPercent) {
        allowed = false;
        reasons.push(`Daily loss limit reached (${pnlPercent.toFixed(2)}% <= -${this.config.maxDailyLossPercent}%)`);
      }
    }

    // New Hard USD Limit Check
    if (this.state.dailyPnL <= -this.config.maxDailyLossUsd) {
        allowed = false;
        reasons.push(`HARD STOP: Max daily loss $${this.config.maxDailyLossUsd} reached (Current: $${this.state.dailyPnL})`);
    }

    return { allowed, reasons, state: this.getStatus() };
  }

  recordTrade(trade) {
    const entry = {
      id: `TRADE-${Date.now()}`,
      timestamp: new Date().toISOString(),
      symbol: trade.symbol,
      type: trade.type,
      side: trade.side,
      size: trade.size,
      leverage: trade.leverage || this.config.defaultLeverage,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      pnl: trade.pnl || 0,
      pnlPercent: trade.pnlPercent || 0,
      reason: trade.reason || 'manual',
      status: trade.status || 'closed'
    };

    this.tradeLog.push(entry);
    this.saveTradeLog();
    this.appendToCsv(entry);

    if (trade.status === 'closed') {
      this.state.tradeCount++;
      
      if (trade.pnl < 0) {
        this.state.consecutiveLosses++;
        this.state.dailyPnL += trade.pnl;
      } else {
        this.state.consecutiveLosses = 0;
        this.state.dailyPnL += trade.pnl;
      }

      if (this.state.consecutiveLosses >= this.config.maxConsecutiveLosses) {
        this.state.halted = true;
        this.state.haltReason = `Consecutive loss limit (${this.config.maxConsecutiveLosses}) reached`;
      }

      this.saveState();
    }

    return entry;
  }

  setStartingBalance(balance) {
    this.state.startingBalance = balance;
    this.saveState();
    return this.state;
  }

  getStatus() {
    return {
      date: this.state.date,
      tradeCount: this.state.tradeCount,
      maxTrades: this.config.maxTradesPerDay,
      remainingTrades: Math.max(0, this.config.maxTradesPerDay - this.state.tradeCount),
      dailyPnL: this.state.dailyPnL,
      consecutiveLosses: this.state.consecutiveLosses,
      maxConsecutiveLosses: this.config.maxConsecutiveLosses,
      halted: this.state.halted,
      haltReason: this.state.haltReason,
      startingBalance: this.state.startingBalance,
      maxDailyLossPercent: this.config.maxDailyLossPercent,
      canTrade: !this.state.halted && 
                this.state.tradeCount < this.config.maxTradesPerDay &&
                this.state.consecutiveLosses < this.config.maxConsecutiveLosses
    };
  }

  getDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    const todaysTrades = this.tradeLog.filter(t => t.timestamp.startsWith(today));
    
    const wins = todaysTrades.filter(t => t.pnl > 0);
    const losses = todaysTrades.filter(t => t.pnl < 0);
    
    return {
      date: today,
      totalTrades: todaysTrades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: todaysTrades.length > 0 ? ((wins.length / todaysTrades.length) * 100).toFixed(1) : 0,
      totalPnL: todaysTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
      avgWin: wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0,
      avgLoss: losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0,
      largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0,
      discipline: this.getStatus(),
      trades: todaysTrades
    };
  }

  getTradeHistory(limit = 50) {
    return this.tradeLog.slice(-limit);
  }

  reset() {
    this.state = this.resetDailyState();
    this.saveState();
    return this.getStatus();
  }

  clearHalt() {
    this.state.halted = false;
    this.state.haltReason = null;
    this.saveState();
    return this.getStatus();
  }
}

export const tradingDiscipline = new TradingDiscipline();

export function getDisciplineTools() {
  return [
    {
      name: 'trading_can_trade',
      description: 'Check if trading is allowed based on discipline rules (max trades/day, loss limits, consecutive losses)',
      inputSchema: {
        type: 'object',
        properties: {
          currentBalance: { type: 'number', description: 'Current account balance (optional, for loss % calculation)' }
        }
      }
    },
    {
      name: 'trading_record_trade',
      description: 'Record a trade for discipline tracking. Call this after every trade execution.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading pair (e.g., SOL-USDC)' },
          type: { type: 'string', enum: ['perp', 'spot'], description: 'Trade type' },
          side: { type: 'string', enum: ['long', 'short', 'buy', 'sell'], description: 'Trade side' },
          size: { type: 'number', description: 'Position size' },
          leverage: { type: 'number', description: 'Leverage (default 20)' },
          entryPrice: { type: 'number', description: 'Entry price' },
          exitPrice: { type: 'number', description: 'Exit price (for closed trades)' },
          pnl: { type: 'number', description: 'Profit/Loss amount' },
          pnlPercent: { type: 'number', description: 'Profit/Loss percentage' },
          reason: { type: 'string', description: 'Trade reason/strategy' },
          status: { type: 'string', enum: ['open', 'closed'], description: 'Trade status' }
        },
        required: ['symbol', 'side', 'size', 'entryPrice']
      }
    },
    {
      name: 'trading_status',
      description: 'Get current trading discipline status (trades taken, remaining, PnL, halt status)',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'trading_daily_report',
      description: 'Get daily trading report with win rate, PnL breakdown, and all trades',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'trading_history',
      description: 'Get recent trade history',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of trades to return (default 50)' }
        }
      }
    },
    {
      name: 'trading_set_balance',
      description: 'Set starting balance for daily loss % calculation',
      inputSchema: {
        type: 'object',
        properties: {
          balance: { type: 'number', description: 'Starting balance' }
        },
        required: ['balance']
      }
    },
    {
      name: 'trading_reset',
      description: 'Reset daily trading state (use at start of new trading day)',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'trading_clear_halt',
      description: 'Clear halt status to resume trading (use with caution)',
      inputSchema: { type: 'object', properties: {} }
    }
  ];
}

export async function handleDisciplineTool(name, args) {
  switch (name) {
    case 'trading_can_trade':
      return tradingDiscipline.canTrade(args.currentBalance);

    case 'trading_record_trade':
      return tradingDiscipline.recordTrade(args);

    case 'trading_status':
      return tradingDiscipline.getStatus();

    case 'trading_daily_report':
      return tradingDiscipline.getDailyReport();

    case 'trading_history':
      return tradingDiscipline.getTradeHistory(args.limit);

    case 'trading_set_balance':
      return tradingDiscipline.setStartingBalance(args.balance);

    case 'trading_reset':
      return tradingDiscipline.reset();

    case 'trading_clear_halt':
      return tradingDiscipline.clearHalt();

    default:
      throw new Error(`Unknown discipline tool: ${name}`);
  }
}
