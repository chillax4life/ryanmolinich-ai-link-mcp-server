
import fs from 'fs/promises';
import { existsSync, mkdirSync, rmdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_FILE = path.join(__dirname, 'storage.json');
const LOCK_DIR = path.join(__dirname, 'storage.lock');

// Initial State
const DEFAULT_STATE = {
    aiRegistry: {},
    messages: [],
    contexts: {},
    taskQueue: [], // [ { taskId, description, status, assignedTo, result, ... } ]
    messageCount: 0
};

// --- Transactional Locking Helper ---
async function withLock(operation) {
    let retries = 0;
    while (retries < 50) { // Try for ~5 seconds
        try {
            mkdirSync(LOCK_DIR); // Atomic lock
            // Lock acquired
            try {
                return await operation();
            } finally {
                rmdirSync(LOCK_DIR); // Release lock
            }
        } catch (e) {
            if (e.code === 'EEXIST') {
                // Locked, wait and retry
                await new Promise(r => setTimeout(r, 100));
                retries++;
            } else {
                throw e;
            }
        }
    }
    throw new Error('Could not acquire lock on storage.json after 5s');
}

// --- Persistence Operations ---
async function loadData() {
    try {
        if (!existsSync(STORAGE_FILE)) {
            await saveData(DEFAULT_STATE);
            return JSON.parse(JSON.stringify(DEFAULT_STATE));
        }
        const data = await fs.readFile(STORAGE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error loading data:", e);
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
}

async function saveData(data) {
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export { withLock, loadData, saveData, DEFAULT_STATE };
