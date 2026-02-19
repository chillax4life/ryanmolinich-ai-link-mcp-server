class TechnicalIndicators {
    static SMA(prices, period) {
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    }

    static EMA(prices, period) {
        if (prices.length < period) return null;
        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
        }
        return ema;
    }

    static RSI(prices, period = 14) {
        if (prices.length < period + 1) return null;

        let gains = 0;
        let losses = 0;

        for (let i = prices.length - period; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    static RSIWithHistory(prices, period = 14) {
        if (prices.length < period + 2) return { current: null, history: [] };

        const history = [];
        
        for (let start = period + 1; start <= prices.length; start++) {
            const slice = prices.slice(0, start);
            let gains = 0;
            let losses = 0;

            for (let i = slice.length - period; i < slice.length; i++) {
                const change = slice[i] - slice[i - 1];
                if (change > 0) gains += change;
                else losses -= change;
            }

            const avgGain = gains / period;
            const avgLoss = losses / period;

            let rsi;
            if (avgLoss === 0) rsi = 100;
            else rsi = 100 - (100 / (1 + avgGain / avgLoss));

            history.push(rsi);
        }

        return {
            current: history[history.length - 1],
            history,
            status: history[history.length - 1] > 70 ? 'OVERBOUGHT' : 
                    history[history.length - 1] < 30 ? 'OVERSOLD' : 'NEUTRAL'
        };
    }

    static MACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (prices.length < slowPeriod + signalPeriod) return null;

        const fastEMA = this.EMAArray(prices, fastPeriod);
        const slowEMA = this.EMAArray(prices, slowPeriod);

        const macdLine = [];
        for (let i = 0; i < fastEMA.length; i++) {
            const slowIdx = i + (slowPeriod - fastPeriod);
            if (slowIdx >= 0 && slowIdx < slowEMA.length) {
                macdLine.push(fastEMA[i] - slowEMA[slowIdx]);
            }
        }

        if (macdLine.length < signalPeriod) return null;

        const signalLine = this.EMA(macdLine, signalPeriod);
        const histogram = macdLine[macdLine.length - 1] - signalLine;

        return {
            macd: macdLine[macdLine.length - 1],
            signal: signalLine,
            histogram,
            trend: histogram > 0 ? 'BULLISH' : 'BEARISH',
            crossover: macdLine.length >= 2 && 
                       macdLine[macdLine.length - 1] > signalLine && 
                       macdLine[macdLine.length - 2] <= this.EMA(macdLine.slice(0, -1), signalPeriod)
                       ? 'BULLISH_CROSSOVER' : null
        };
    }

    static EMAArray(prices, period) {
        if (prices.length < period) return [];
        
        const multiplier = 2 / (period + 1);
        const emaValues = [];
        
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        emaValues.push(ema);

        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
            emaValues.push(ema);
        }

        return emaValues;
    }

    static BollingerBands(prices, period = 20, stdDev = 2) {
        if (prices.length < period) return null;

        const slice = prices.slice(-period);
        const sma = slice.reduce((a, b) => a + b, 0) / period;

        const squaredDiffs = slice.map(p => Math.pow(p - sma, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        const std = Math.sqrt(variance);

        const upper = sma + (stdDev * std);
        const lower = sma - (stdDev * std);

        const currentPrice = prices[prices.length - 1];
        const percentB = (currentPrice - lower) / (upper - lower);

        return {
            upper,
            middle: sma,
            lower,
            bandwidth: (upper - lower) / sma * 100,
            percentB,
            position: percentB > 1 ? 'ABOVE_UPPER' : 
                      percentB < 0 ? 'BELOW_LOWER' : 
                      percentB > 0.8 ? 'NEAR_UPPER' : 
                      percentB < 0.2 ? 'NEAR_LOWER' : 'MIDDLE',
            squeeze: (upper - lower) / sma < 0.04
        };
    }

    static ATR(highs, lows, closes, period = 14) {
        if (closes.length < period + 1) return null;

        const trueRanges = [];
        for (let i = 1; i < closes.length; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            trueRanges.push(tr);
        }

        const slice = trueRanges.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    }

    static VolumeProfile(prices, volumes, buckets = 20) {
        if (prices.length === 0 || volumes.length === 0) return null;

        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const bucketSize = (maxPrice - minPrice) / buckets;

        const profile = {};
        for (let i = 0; i < buckets; i++) {
            const low = minPrice + i * bucketSize;
            const high = low + bucketSize;
            profile[i] = { low, high, volume: 0 };
        }

        for (let i = 0; i < prices.length; i++) {
            const bucketIdx = Math.min(
                Math.floor((prices[i] - minPrice) / bucketSize),
                buckets - 1
            );
            if (bucketIdx >= 0 && profile[bucketIdx]) {
                profile[bucketIdx].volume += volumes[i] || 0;
            }
        }

        const sorted = Object.values(profile).sort((a, b) => b.volume - a.volume);
        const poc = sorted[0];
        const highVolumeNodes = sorted.slice(0, 3).map(n => ({
            price: (n.low + n.high) / 2,
            volume: n.volume
        }));

        const lowVolumeNodes = sorted.slice(-3).map(n => ({
            price: (n.low + n.high) / 2,
            volume: n.volume
        }));

        return {
            pointOfControl: (poc.low + poc.high) / 2,
            highVolumeNodes,
            lowVolumeNodes,
            valueAreaHigh: sorted.find((_, i) => {
                const volSum = sorted.slice(0, i + 1).reduce((a, b) => a + b.volume, 0);
                const totalVol = sorted.reduce((a, b) => a + b.volume, 0);
                return volSum / totalVol >= 0.7;
            }),
            profile: Object.values(profile)
        };
    }

    static VWAP(highs, lows, closes, volumes) {
        if (closes.length === 0) return null;

        let cumVolume = 0;
        let cumVolumePrice = 0;

        for (let i = 0; i < closes.length; i++) {
            const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
            cumVolumePrice += typicalPrice * (volumes[i] || 1);
            cumVolume += (volumes[i] || 1);
        }

        return cumVolumePrice / cumVolume;
    }

    static SupportResistance(prices, lookback = 20, threshold = 0.02) {
        if (prices.length < lookback * 2) return { supports: [], resistances: [] };

        const levels = [];
        const recent = prices.slice(-lookback * 2);

        for (let i = lookback; i < recent.length - lookback; i++) {
            const left = recent.slice(i - lookback, i);
            const right = recent.slice(i + 1, i + lookback + 1);
            const current = recent[i];

            const isLow = left.every(p => p >= current) && right.every(p => p >= current);
            const isHigh = left.every(p => p <= current) && right.every(p => p <= current);

            if (isLow) levels.push({ price: current, type: 'support', strength: 1 });
            if (isHigh) levels.push({ price: current, type: 'resistance', strength: 1 });
        }

        const clustered = [];
        for (const level of levels) {
            const existing = clustered.find(l => 
                Math.abs(l.price - level.price) / level.price < threshold
            );
            if (existing) {
                existing.strength++;
            } else {
                clustered.push({ ...level });
            }
        }

        return {
            supports: clustered.filter(l => l.type === 'support').sort((a, b) => b.strength - a.strength),
            resistances: clustered.filter(l => l.type === 'resistance').sort((a, b) => b.strength - a.strength)
        };
    }

    static TrendAnalysis(prices, shortPeriod = 20, longPeriod = 50) {
        if (prices.length < longPeriod) return null;

        const shortSMA = this.SMA(prices, shortPeriod);
        const longSMA = this.SMA(prices, longPeriod);
        const currentPrice = prices[prices.length - 1];

        const shortAboveLong = shortSMA > longSMA;
        const priceAboveShort = currentPrice > shortSMA;
        const priceAboveLong = currentPrice > longSMA;

        let trend;
        if (shortAboveLong && priceAboveShort && priceAboveLong) {
            trend = 'STRONG_UPTREND';
        } else if (shortAboveLong && priceAboveShort) {
            trend = 'UPTREND';
        } else if (!shortAboveLong && !priceAboveShort && !priceAboveLong) {
            trend = 'STRONG_DOWNTREND';
        } else if (!shortAboveLong) {
            trend = 'DOWNTREND';
        } else {
            trend = 'SIDEWAYS';
        }

        const momentum = ((currentPrice - prices[prices.length - 10]) / prices[prices.length - 10]) * 100;

        return {
            trend,
            shortSMA,
            longSMA,
            momentum: momentum.toFixed(2),
            pricePosition: priceAboveLong ? 'ABOVE_LONG_SMA' : 'BELOW_LONG_SMA'
        };
    }

    static FullAnalysis(prices, options = {}) {
        const {
            highs = prices,
            lows = prices,
            volumes = new Array(prices.length).fill(1),
            rsiPeriod = 14,
            macdFast = 12,
            macdSlow = 26,
            macdSignal = 9,
            bbPeriod = 20,
            bbStdDev = 2
        } = options;

        const rsi = this.RSIWithHistory(prices, rsiPeriod);
        const macd = this.MACD(prices, macdFast, macdSlow, macdSignal);
        const bollinger = this.BollingerBands(prices, bbPeriod, bbStdDev);
        const trend = this.TrendAnalysis(prices);
        const supportResistance = this.SupportResistance(prices);
        const atr = this.ATR(highs, lows, prices, 14);
        const vwap = this.VWAP(highs, lows, prices, volumes);

        const signals = [];
        let bullishScore = 0;
        let bearishScore = 0;

        if (rsi.current < 30) {
            signals.push({ indicator: 'RSI', signal: 'BULLISH', reason: 'Oversold', strength: 2 });
            bullishScore += 2;
        } else if (rsi.current > 70) {
            signals.push({ indicator: 'RSI', signal: 'BEARISH', reason: 'Overbought', strength: 2 });
            bearishScore += 2;
        }

        if (macd?.crossover === 'BULLISH_CROSSOVER') {
            signals.push({ indicator: 'MACD', signal: 'BULLISH', reason: 'Bullish crossover', strength: 2 });
            bullishScore += 2;
        } else if (macd?.trend === 'BULLISH') {
            signals.push({ indicator: 'MACD', signal: 'BULLISH', reason: 'Above signal line', strength: 1 });
            bullishScore += 1;
        } else if (macd?.trend === 'BEARISH') {
            signals.push({ indicator: 'MACD', signal: 'BEARISH', reason: 'Below signal line', strength: 1 });
            bearishScore += 1;
        }

        if (bollinger?.position === 'BELOW_LOWER') {
            signals.push({ indicator: 'Bollinger', signal: 'BULLISH', reason: 'Below lower band', strength: 1 });
            bullishScore += 1;
        } else if (bollinger?.position === 'ABOVE_UPPER') {
            signals.push({ indicator: 'Bollinger', signal: 'BEARISH', reason: 'Above upper band', strength: 1 });
            bearishScore += 1;
        }

        if (bollinger?.squeeze) {
            signals.push({ indicator: 'Bollinger', signal: 'NEUTRAL', reason: 'Squeeze detected - volatility incoming', strength: 1 });
        }

        if (trend?.trend === 'STRONG_UPTREND') {
            signals.push({ indicator: 'Trend', signal: 'BULLISH', reason: 'Strong uptrend', strength: 2 });
            bullishScore += 2;
        } else if (trend?.trend === 'STRONG_DOWNTREND') {
            signals.push({ indicator: 'Trend', signal: 'BEARISH', reason: 'Strong downtrend', strength: 2 });
            bearishScore += 2;
        }

        const netBias = bullishScore - bearishScore;
        let overallBias;
        if (netBias >= 3) overallBias = 'BULLISH';
        else if (netBias <= -3) overallBias = 'BEARISH';
        else overallBias = 'NEUTRAL';

        return {
            rsi,
            macd,
            bollinger,
            trend,
            supportResistance,
            atr,
            vwap,
            signals,
            summary: {
                bullishScore,
                bearishScore,
                netBias,
                overallBias,
                confidence: Math.min(100, Math.abs(netBias) * 15 + 25)
            }
        };
    }
}

export function getTechnicalIndicatorTools() {
    return [
        {
            name: 'tech_rsi',
            description: 'Calculate RSI (Relative Strength Index). Values >70 = overbought, <30 = oversold.',
            inputSchema: {
                type: 'object',
                properties: {
                    prices: { type: 'array', items: { type: 'number' }, description: 'Array of closing prices' },
                    period: { type: 'number', description: 'RSI period (default 14)' }
                },
                required: ['prices']
            }
        },
        {
            name: 'tech_macd',
            description: 'Calculate MACD (Moving Average Convergence Divergence). Bullish when MACD > signal.',
            inputSchema: {
                type: 'object',
                properties: {
                    prices: { type: 'array', items: { type: 'number' }, description: 'Array of closing prices' },
                    fastPeriod: { type: 'number', description: 'Fast EMA period (default 12)' },
                    slowPeriod: { type: 'number', description: 'Slow EMA period (default 26)' },
                    signalPeriod: { type: 'number', description: 'Signal line period (default 9)' }
                },
                required: ['prices']
            }
        },
        {
            name: 'tech_bollinger',
            description: 'Calculate Bollinger Bands. Price near upper = overbought, near lower = oversold. Squeeze = low volatility.',
            inputSchema: {
                type: 'object',
                properties: {
                    prices: { type: 'array', items: { type: 'number' }, description: 'Array of closing prices' },
                    period: { type: 'number', description: 'Period (default 20)' },
                    stdDev: { type: 'number', description: 'Standard deviations (default 2)' }
                },
                required: ['prices']
            }
        },
        {
            name: 'tech_support_resistance',
            description: 'Identify key support and resistance levels from price history.',
            inputSchema: {
                type: 'object',
                properties: {
                    prices: { type: 'array', items: { type: 'number' }, description: 'Array of prices' },
                    lookback: { type: 'number', description: 'Lookback period (default 20)' }
                },
                required: ['prices']
            }
        },
        {
            name: 'tech_full_analysis',
            description: 'Full technical analysis: RSI, MACD, Bollinger, Trend, Support/Resistance, and signal summary.',
            inputSchema: {
                type: 'object',
                properties: {
                    prices: { type: 'array', items: { type: 'number' }, description: 'Array of closing prices' },
                    highs: { type: 'array', items: { type: 'number' }, description: 'Array of high prices (optional)' },
                    lows: { type: 'array', items: { type: 'number' }, description: 'Array of low prices (optional)' },
                    volumes: { type: 'array', items: { type: 'number' }, description: 'Array of volumes (optional)' }
                },
                required: ['prices']
            }
        }
    ];
}

export async function handleTechnicalIndicatorTool(name, args) {
    switch (name) {
        case 'tech_rsi':
            return TechnicalIndicators.RSIWithHistory(args.prices, args.period);
        case 'tech_macd':
            return TechnicalIndicators.MACD(args.prices, args.macdFast, args.macdSlow, args.macdSignal);
        case 'tech_bollinger':
            return TechnicalIndicators.BollingerBands(args.prices, args.period, args.stdDev);
        case 'tech_support_resistance':
            return TechnicalIndicators.SupportResistance(args.prices, args.lookback);
        case 'tech_full_analysis':
            return TechnicalIndicators.FullAnalysis(args.prices, {
                highs: args.highs,
                lows: args.lows,
                volumes: args.volumes
            });
        default:
            throw new Error(`Unknown technical indicator tool: ${name}`);
    }
}

export { TechnicalIndicators };
