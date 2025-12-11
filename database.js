import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;

export async function initDatabase() {
    db = await open({
        filename: './ai_link.db',
        driver: sqlite3.Database
    });

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

    console.log('Database initialized');
}

export async function getDb() {
    if (!db) await initDatabase();
    return db;
}

// Helpers for AI Registry
export async function registerAI(ai) {
    const database = await getDb();
    await database.run(
        `INSERT OR REPLACE INTO ai_registry (aiId, name, capabilities, metadata, registeredAt) VALUES (?, ?, ?, ?, ?)`,
        ai.aiId, ai.name, JSON.stringify(ai.capabilities), JSON.stringify(ai.metadata), ai.registeredAt
    );
}

export async function getAI(aiId) {
    const database = await getDb();
    const ai = await database.get('SELECT * FROM ai_registry WHERE aiId = ?', aiId);
    if (ai) {
        ai.capabilities = JSON.parse(ai.capabilities);
        ai.metadata = JSON.parse(ai.metadata);
    }
    return ai;
}

export async function getAllAIs() {
    const database = await getDb();
    const ais = await database.all('SELECT * FROM ai_registry');
    return ais.map(ai => ({
        ...ai,
        capabilities: JSON.parse(ai.capabilities),
        metadata: JSON.parse(ai.metadata)
    }));
}

// Helpers for Messages
export async function saveMessage(msg) {
    const database = await getDb();
    await database.run(
        `INSERT INTO messages (fromAiId, toAiId, message, messageType, metadata, timestamp, read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        msg.fromAiId, msg.toAiId, msg.message, msg.messageType, JSON.stringify(msg.metadata), msg.timestamp, msg.read ? 1 : 0
    );
}

export async function getMessages(aiId, unreadOnly = false) {
    const database = await getDb();
    let query = 'SELECT * FROM messages WHERE toAiId = ?';
    if (unreadOnly) query += ' AND read = 0';

    const msgs = await database.all(query, aiId);
    return msgs.map(msg => ({
        ...msg,
        metadata: JSON.parse(msg.metadata),
        read: !!msg.read
    }));
}

export async function markMessagesRead(aiId) {
    const database = await getDb();
    await database.run('UPDATE messages SET read = 1 WHERE toAiId = ?', aiId);
}

// Helpers for Tasks
export async function saveTask(task) {
    const database = await getDb();
    await database.run(
        `INSERT OR REPLACE INTO tasks (taskId, description, requiredCapabilities, status, assignedTo, result, createdAt, startedAt, completedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        task.taskId, task.description, JSON.stringify(task.requiredCapabilities), task.status, task.assignedTo, task.result, task.createdAt, task.startedAt, task.completedAt
    );
}

export async function getTask(taskId) {
    const database = await getDb();
    const task = await database.get('SELECT * FROM tasks WHERE taskId = ?', taskId);
    if (task) {
        task.requiredCapabilities = JSON.parse(task.requiredCapabilities);
    }
    return task;
}

export async function getAllTasks() {
    const database = await getDb();
    const tasks = await database.all('SELECT * FROM tasks');
    return tasks.map(t => ({
        ...t,
        requiredCapabilities: JSON.parse(t.requiredCapabilities)
    }));
}
