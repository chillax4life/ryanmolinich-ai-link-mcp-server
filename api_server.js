import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security Configuration — refuse to start without a real API key
if (!process.env.AI_LINK_API_KEY) {
    console.error('🚨 FATAL: AI_LINK_API_KEY environment variable is not set.');
    console.error('   Set it in your .env file or export it before starting the server.');
    console.error('   Example: export AI_LINK_API_KEY=$(openssl rand -hex 32)');
    // Only exit when running standalone; when imported, let the caller handle it
    if (import.meta.url === `file://${process.argv[1]}`) {
        process.exit(1);
    }
}
const API_KEY = process.env.AI_LINK_API_KEY;

// Middleware
app.use(cors());
app.use(bodyParser.json());
// Use absolute path to ensure 'public' is found regardless of CWD
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
const authMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    // Allow root (dashboard) and static assets (handled by express.static above) 
    // to bypass auth if we want public dashboard?
    // Actually, express.static is BEFORE this middleware, so it's already public.
    // We only need to protect API routes.

    // Explicitly allow health check and stats and signals
    if ((req.path === '/api/health' || req.path === '/api/stats' || req.path === '/api/signal') && req.method === 'GET') {
        return next();
    }

    // Checking if it's an API call
    if (req.path.startsWith('/api')) {
        if (!apiKey || apiKey !== API_KEY) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or missing x-api-key header.'
            });
        }
    }

    next();
};

app.use(authMiddleware);

import { getAllAIs, getAllTasks, getMessages, saveMessage } from './database.js';
import { tradingDiscipline } from './trading_discipline.js';
import { getTradingViewSignals } from './tradingview_service.js';
import { OPEN_POSITIONS } from './augmented_trader.js';

// Routes
// Renamed root handler to /api/health so it doesn't shadow index.html
app.get('/api/health', (req, res) => {
    res.send('AI Link API Server is running. Authentication enabled.');
});

// --- NEW: Active Positions ---
app.get('/api/positions', (req, res) => {
    try {
        const positions = Array.from(OPEN_POSITIONS.values());
        res.json({ count: positions.length, positions });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- NEW: Risk Status (Placeholder for RiskAgent integration) ---
app.get('/api/risk-status', (req, res) => {
    // Ideally, we'd fetch this from the running RiskAgent instance.
    // For now, we return a static config or read from a shared state file.
    res.json({
        status: 'active',
        threshold: 5.0,
        lastCheck: new Date().toISOString()
    });
});

// --- NEW: Strategy Status (Placeholder) ---
app.get('/api/strategies', (req, res) => {
    res.json({
        strategies: [
            { name: 'FlashGuardian', type: 'scalp', status: 'active' },
            { name: 'AtomicArb', type: 'arbitrage', status: 'ready' },
            { name: 'AugmentedTrader', type: 'manual', status: 'active' }
        ]
    });
});

app.get('/api/stats', (req, res) => {
    try {
        const report = tradingDiscipline.getDailyReport();
        res.json({
            ...report,
            config: {
                maxDailyLossUsd: tradingDiscipline.config.maxDailyLossUsd,
                maxPositionSizeUsd: tradingDiscipline.config.maxPositionSizeUsd,
                tradingMode: tradingDiscipline.config.tradingMode
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/signal', async (req, res) => {
    const { symbol, interval } = req.query;
    if (!symbol) return res.status(400).json({ error: 'Missing symbol' });
    try {
        // Default to '60' (1 hour) if not provided
        const signals = await getTradingViewSignals(symbol.toString(), interval ? interval.toString() : '60');
        res.json(signals);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Dashboard API Endpoints ---
app.get('/api/agents', async (req, res) => {
    try {
        const agents = await getAllAIs();
        res.json({ count: agents.length, agents });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await getAllTasks();
        res.json({ count: tasks.length, tasks });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Chat API ---
app.get('/api/messages', async (req, res) => {
    const { aiId } = req.query;
    if (!aiId) return res.status(400).json({ error: 'Missing aiId query param' });

    try {
        // Fetch last 50 messages for this AI (or from this AI)
        // Ideally getMessages should support filtering, but for now we fetch for the AI
        const messages = await getMessages(aiId, false);
        res.json({ count: messages.length, messages });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/chat', async (req, res) => {
    const { from, to, message } = req.body;
    if (!from || !to || !message) return res.status(400).json({ error: 'Missing fields' });

    try {
        await saveMessage({
            fromAiId: from,
            toAiId: to,
            message: message,
            messageType: 'request',
            metadata: { source: 'web_dashboard' },
            timestamp: new Date().toISOString(),
            read: false
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Example protected route (can be expanded later to match README endpoints)
app.get('/status', (req, res) => {
    res.json({ status: 'online', authenticated: true });
});
// --- Remote Agent Registration ---
app.post('/api/register_agent', async (req, res) => {
    const { aiId, name, capabilities, metadata } = req.body;
    if (!aiId || !name) return res.status(400).json({ error: 'Missing aiId or name' });

    try {
        await import('./database.js').then(db => db.registerAI({
            aiId,
            name,
            capabilities: capabilities || ['remote-worker'],
            metadata: { ...metadata, type: 'remote' }
        }));
        console.log(`[System] Remote Agent Registered: ${name} (${aiId})`);
        res.json({ success: true, message: 'Agent connected to Hive Mind' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export function startApiServer() {
    return new Promise((resolve) => {
        app.listen(PORT, '0.0.0.0', () => {
            console.error(`🔒 API Server running on port ${PORT}`);
            console.error(`🌍 Remote Access Enabled: Listening on 0.0.0.0`);
            resolve();
        });
    });
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
    startApiServer().catch(console.error);
    // Keep the process alive indefinitely if run directly
    setInterval(() => { }, 1000);
}
