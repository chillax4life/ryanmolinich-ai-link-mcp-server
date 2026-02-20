import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;

/**
 * Safely parse a JSON string. Returns fallback on failure instead of crashing.
 */
function safeJsonParse(str, fallback = null) {
    if (str === null || str === undefined) return fallback;
    try {
        return JSON.parse(str);
    } catch {
        console.error(`[DB] Failed to parse JSON: "${String(str).substring(0, 100)}"`);
        return fallback;
    }
}

export async function initDatabase() {
    try {
        db = await open({
            filename: './ai_link.db',
            driver: sqlite3.Database
        });

        await db.exec('PRAGMA journal_mode = WAL;');

        await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_registry (
      aiId TEXT PRIMARY KEY,
      name TEXT,
      capabilities TEXT, -- JSON string
      metadata TEXT, -- JSON string
      registeredAt TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromAiId TEXT,
      toAiId TEXT,
      message TEXT,
      messageType TEXT,
      metadata TEXT, -- JSON string
      timestamp TEXT,
      read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      taskId TEXT PRIMARY KEY,
      description TEXT,
      requiredCapabilities TEXT, -- JSON string
      status TEXT,
      assignedTo TEXT,
      result TEXT,
      createdAt TEXT,
      startedAt TEXT,
      completedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS contexts (
      contextId TEXT PRIMARY KEY,
      data TEXT, -- JSON string
      authorizedAiIds TEXT, -- JSON string
      createdAt TEXT,
      expiresAt TEXT
    );
  `);

        console.log('Database initialized (WAL mode)');
    } catch (error) {
        console.error('[DB] FATAL: Failed to initialize database:', error.message);
        throw error;
    }
}

export async function getDb() {
    if (!db) await initDatabase();
    return db;
}

// ─── AI Registry ─────────────────────────────────────────────────────

export async function registerAI(ai) {
    if (!ai?.aiId || !ai?.name) {
        throw new Error('[DB] registerAI requires aiId and name');
    }
    try {
        const database = await getDb();
        await database.run(
            `INSERT OR REPLACE INTO ai_registry (aiId, name, capabilities, metadata, registeredAt) VALUES (?, ?, ?, ?, ?)`,
            ai.aiId, ai.name, JSON.stringify(ai.capabilities || []), JSON.stringify(ai.metadata || {}), ai.registeredAt || new Date().toISOString()
        );
    } catch (error) {
        console.error(`[DB] Failed to register AI "${ai.aiId}":`, error.message);
        throw error;
    }
}

export async function getAI(aiId) {
    if (!aiId) return null;
    try {
        const database = await getDb();
        const ai = await database.get('SELECT * FROM ai_registry WHERE aiId = ?', aiId);
        if (ai) {
            ai.capabilities = safeJsonParse(ai.capabilities, []);
            ai.metadata = safeJsonParse(ai.metadata, {});
        }
        return ai;
    } catch (error) {
        console.error(`[DB] Failed to get AI "${aiId}":`, error.message);
        return null;
    }
}

export async function getAllAIs() {
    try {
        const database = await getDb();
        const ais = await database.all('SELECT * FROM ai_registry');
        return ais.map(ai => ({
            ...ai,
            capabilities: safeJsonParse(ai.capabilities, []),
            metadata: safeJsonParse(ai.metadata, {})
        }));
    } catch (error) {
        console.error('[DB] Failed to get all AIs:', error.message);
        return [];
    }
}

// ─── Messages ────────────────────────────────────────────────────────

export async function saveMessage(msg) {
    if (!msg?.fromAiId || !msg?.toAiId) {
        throw new Error('[DB] saveMessage requires fromAiId and toAiId');
    }
    try {
        const database = await getDb();
        await database.run(
            `INSERT INTO messages (fromAiId, toAiId, message, messageType, metadata, timestamp, read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            msg.fromAiId, msg.toAiId, msg.message, msg.messageType, JSON.stringify(msg.metadata || {}), msg.timestamp || new Date().toISOString(), msg.read ? 1 : 0
        );
    } catch (error) {
        console.error(`[DB] Failed to save message from "${msg.fromAiId}" to "${msg.toAiId}":`, error.message);
        throw error;
    }
}

export async function getMessages(aiId, unreadOnly = false) {
    if (!aiId) return [];
    try {
        const database = await getDb();
        let query = 'SELECT * FROM messages WHERE toAiId = ?';
        if (unreadOnly) query += ' AND read = 0';

        const msgs = await database.all(query, aiId);
        return msgs.map(msg => ({
            ...msg,
            metadata: safeJsonParse(msg.metadata, {}),
            read: !!msg.read
        }));
    } catch (error) {
        console.error(`[DB] Failed to get messages for "${aiId}":`, error.message);
        return [];
    }
}

export async function markMessagesRead(aiId) {
    if (!aiId) return;
    try {
        const database = await getDb();
        await database.run('UPDATE messages SET read = 1 WHERE toAiId = ?', aiId);
    } catch (error) {
        console.error(`[DB] Failed to mark messages read for "${aiId}":`, error.message);
    }
}

// ─── Tasks ───────────────────────────────────────────────────────────

export async function saveTask(task) {
    if (!task?.taskId) {
        throw new Error('[DB] saveTask requires taskId');
    }
    try {
        const database = await getDb();
        await database.run(
            `INSERT OR REPLACE INTO tasks (taskId, description, requiredCapabilities, status, assignedTo, result, createdAt, startedAt, completedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            task.taskId, task.description, JSON.stringify(task.requiredCapabilities || []), task.status, task.assignedTo, task.result, task.createdAt, task.startedAt, task.completedAt
        );
    } catch (error) {
        console.error(`[DB] Failed to save task "${task.taskId}":`, error.message);
        throw error;
    }
}

export async function getTask(taskId) {
    if (!taskId) return null;
    try {
        const database = await getDb();
        const task = await database.get('SELECT * FROM tasks WHERE taskId = ?', taskId);
        if (task) {
            task.requiredCapabilities = safeJsonParse(task.requiredCapabilities, []);
        }
        return task;
    } catch (error) {
        console.error(`[DB] Failed to get task "${taskId}":`, error.message);
        return null;
    }
}

export async function getAllTasks() {
    try {
        const database = await getDb();
        const tasks = await database.all('SELECT * FROM tasks');
        return tasks.map(t => ({
            ...t,
            requiredCapabilities: safeJsonParse(t.requiredCapabilities, [])
        }));
    } catch (error) {
        console.error('[DB] Failed to get all tasks:', error.message);
        return [];
    }
}

// ─── Contexts ────────────────────────────────────────────────────────

export async function saveContext(context) {
    if (!context?.contextId) {
        throw new Error('[DB] saveContext requires contextId');
    }
    try {
        const database = await getDb();
        await database.run(
            `INSERT OR REPLACE INTO contexts (contextId, data, authorizedAiIds, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)`,
            context.contextId, JSON.stringify(context.data), JSON.stringify(context.authorizedAiIds || []), context.createdAt, context.expiresAt
        );
    } catch (error) {
        console.error(`[DB] Failed to save context "${context.contextId}":`, error.message);
        throw error;
    }
}

export async function getContext(contextId) {
    if (!contextId) return null;
    try {
        const database = await getDb();
        const context = await database.get('SELECT * FROM contexts WHERE contextId = ?', contextId);
        if (context) {
            context.data = safeJsonParse(context.data, {});
            context.authorizedAiIds = safeJsonParse(context.authorizedAiIds, []);
        }
        return context;
    } catch (error) {
        console.error(`[DB] Failed to get context "${contextId}":`, error.message);
        return null;
    }
}

export async function deleteContext(contextId) {
    if (!contextId) return;
    try {
        const database = await getDb();
        await database.run('DELETE FROM contexts WHERE contextId = ?', contextId);
    } catch (error) {
        console.error(`[DB] Failed to delete context "${contextId}":`, error.message);
    }
}
