import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = 3000;

// Security Configuration
const API_KEY = process.env.AI_LINK_API_KEY || 'ai-link-secure-key';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve dashboard files

// Authentication Middleware
const authMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    // Allow public access to root for health checks, or require auth for everything?
    // Let's require auth for everything except potentially a simple health endpoint if needed.
    // For now, strict security:
    if (req.path === '/' && req.method === 'GET') {
        return next(); // Allow root to be a public landing/health check
    }

    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or missing x-api-key header.'
        });
    }
    next();
};

app.use(authMiddleware);

import { withLock, loadData } from './persistence.js';

// Routes
app.get('/', (req, res) => {
    res.send('AI Link API Server is running. Authentication enabled.');
});

// --- Dashboard API Endpoints ---
app.get('/api/agents', async (req, res) => {
    try {
        const agents = await withLock(async () => {
            const data = await loadData();
            return Object.values(data.aiRegistry || {});
        });
        res.json({ count: agents.length, agents });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await withLock(async () => {
            const data = await loadData();
            return data.taskQueue || [];
        });
        res.json({ count: tasks.length, tasks });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Example protected route (can be expanded later to match README endpoints)
app.get('/status', (req, res) => {
    res.json({ status: 'online', authenticated: true });
});
export function startApiServer() {
    return new Promise((resolve) => {
        app.listen(PORT, () => {
            console.error(`🔒 API Server running on port ${PORT}`);
            if (!process.env.AI_LINK_API_KEY) {
                console.warn('⚠️  WARNING: Using default API Key "ai-link-secure-key". Set AI_LINK_API_KEY env var to secure.');
            }
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
