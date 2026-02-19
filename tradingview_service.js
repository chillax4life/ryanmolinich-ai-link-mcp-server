import TradingView from '@mathieuc/tradingview';

/**
 * TradingView Technical Analysis Service
 * Fetches "Speedometer" signals (Buy/Sell/Neutral) from TradingView's TA engine.
 */
export class TradingViewService {
    constructor() {
        this.client = new TradingView.Client();
    }

    async getTechnicalAnalysis(symbol = 'SOL', exchange = 'BINANCE', interval = '1h') {
        return new Promise((resolve, reject) => {
            const chart = new this.client.Session.Chart();
            
            // Symbol format: EXCHANGE:SYMBOL (e.g. BINANCE:SOLUSDT)
            const fullSymbol = `${exchange}:${symbol.toUpperCase()}USDT`;
            
            chart.setMarket(fullSymbol, {
                timeframe: interval,
                range: 1, // Only need latest candle
                to: Math.round(Date.now() / 1000)
            });

            // We use the "Speedometer" study which aggregates indicators
            // Standard TradingView TA study package
            chart.onUpdate(async () => {
                try {
                    const ta = await chart.getTA();
                    
                    // Format response to be useful
                    const result = {
                        symbol: fullSymbol,
                        interval,
                        score: ta.score, // -1 (Strong Sell) to 1 (Strong Buy)
                        recommendation: this.getRecommendation(ta.score),
                        indicators: {
                            rsi: ta.indicators['RSI'],
                            macd: ta.indicators['MACD.macd'],
                            macdSignal: ta.indicators['MACD.signal'],
                            ema20: ta.indicators['EMA20'],
                            sma50: ta.indicators['SMA50']
                        },
                        timestamp: new Date().toISOString()
                    };
                    
                    chart.delete();
                    this.client.end();
                    resolve(result);
                } catch (e) {
                    chart.delete();
                    this.client.end();
                    resolve({ error: e.message });
                }
            });

            chart.onError((err) => {
                this.client.end();
                resolve({ error: `TV Error: ${err.message}` });
            });
        });
    }

    getRecommendation(score) {
        if (score >= 0.5) return 'STRONG_BUY';
        if (score >= 0.1) return 'BUY';
        if (score <= -0.5) return 'STRONG_SELL';
        if (score <= -0.1) return 'SELL';
        return 'NEUTRAL';
    }
}

// Standalone function for easy import
export async function getTradingViewSignals(symbol = 'SOL', interval = '60') {
    const tv = new TradingViewService();
    try {
        // Fetch requested interval (default 1h) and 4h/1d for trend context
        // If interval is '1' (1 minute), we check '5' (5 minute) for confirmation
        const secondaryInterval = interval === '1' ? '5' : '240'; // 1m -> 5m, else -> 4h

        const [primary, secondary] = await Promise.all([
            tv.getTechnicalAnalysis(symbol, 'BINANCE', interval),
            tv.getTechnicalAnalysis(symbol, 'BINANCE', secondaryInterval)
        ]);

        return {
            primary: primary.error ? null : primary,
            secondary: secondary.error ? null : secondary,
            summary: {
                action: primary.recommendation,
                score: primary.score,
                confluence: primary.recommendation === secondary.recommendation
            }
        };
    } catch (e) {
        return { error: e.message };
    }
}
