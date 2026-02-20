import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Load registry
const REGISTRY_PATH = path.resolve('./project_registry.json');
let projectRegistry = {};

try {
    if (fs.existsSync(REGISTRY_PATH)) {
        projectRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    } else {
        console.warn("[ProjectTools] project_registry.json not found.");
    }
} catch (e) {
    console.error("[ProjectTools] Failed to load registry:", e);
}

export const projectTools = [
    {
        name: 'list_projects',
        description: 'List all registered external projects and their paths.',
        inputSchema: {
            type: 'object',
            properties: {},
        }
    },
    {
        name: 'get_project_structure',
        description: 'Get a directory listing of a specific project. Use this to explore the codebase.',
        inputSchema: {
            type: 'object',
            properties: {
                projectName: { type: 'string', description: 'Name of the project from list_projects' },
                relativePath: { type: 'string', description: 'Subdirectory to list, defaults to root' },
                depth: { type: 'number', description: 'Depth of recursion, default 2' }
            },
            required: ['projectName']
        }
    },
    {
        name: 'read_project_file',
        description: 'Read the content of a specific file within a project.',
        inputSchema: {
            type: 'object',
            properties: {
                projectName: { type: 'string' },
                filePath: { type: 'string', description: 'Relative path to the file from project root' }
            },
            required: ['projectName', 'filePath']
        }
    },
    {
        name: 'search_project',
        description: 'Search for a string pattern (grep) within a project.',
        inputSchema: {
            type: 'object',
            properties: {
                projectName: { type: 'string' },
                query: { type: 'string', description: 'The search term or regex' },
                filePattern: { type: 'string', description: 'Optional glob pattern for files (e.g. "*.rs")' }
            },
            required: ['projectName', 'query']
        }
    },
    {
        name: 'pocket_options_get_stats',
        description: 'Read the current performance stats from the Pocket Options bot.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'solana_arb_get_status',
        description: 'Get the current active positions and funding rates from the Solana Arbitrage bot.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'openclaw_send_notification',
        description: 'Send a message to the user via OpenClaw channels (Telegram/WhatsApp/iMessage).',
        inputSchema: {
            type: 'object',
            properties: {
                message: { type: 'string', description: 'The notification content' },
                channel: { type: 'string', enum: ['telegram', 'whatsapp', 'imessage', 'auto'], default: 'auto' }
            },
            required: ['message']
        }
    }
];

export async function handleProjectTool(name, args) {
    switch (name) {
        case 'openclaw_send_notification': {
            const { message, channel = 'auto' } = args;
            // Use the openclaw CLI to broadcast/send
            const cmd = `~/.openclaw/bin/openclaw broadcast "${message}" --channel=${channel}`;
            try {
                await execPromise(cmd);
                return { content: [{ type: 'text', text: `Notification sent via OpenClaw (${channel}): ${message}` }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `Failed to send OpenClaw notification: ${e.message}` }], isError: true };
            }
        }

        case 'pocket_options_get_stats': {
            console.log('[ProjectTools] pocket_options_get_stats: Handler triggered.');
            const botPath = projectRegistry['pocket-options'];
            if (!botPath) {
                console.error('[ProjectTools] pocket_options_get_stats: Project not found in registry.');
                throw new Error("Pocket Options project not found in registry.");
            }

            const dataFile = path.join(botPath, 'learning_data.json');
            console.log(`[ProjectTools] pocket_options_get_stats: Checking for data file at ${dataFile}`);

            if (!fs.existsSync(dataFile)) {
                console.warn('[ProjectTools] pocket_options_get_stats: learning_data.json not found.');
                return { content: [{ type: 'text', text: "### Pocket Options Stats\nNo performance data (learning_data.json) found yet." }] };
            }

            console.log('[ProjectTools] pocket_options_get_stats: Data file found. Reading and parsing...');
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
            const total = data.length;
            const wins = data.filter(t => t.result === 'WIN').length;
            const winRate = total > 0 ? ((wins / total) * 100) : 0;
            
            const output = `### Pocket Options Stats\nTotal Trades: ${total}\nWin Rate: ${winRate.toFixed(1)}%\nConfidence: ${Math.min(100, (total / 50) * 100).toFixed(0)}%`;
            console.log(`[ProjectTools] pocket_options_get_stats: Success. Output: ${output}`);
            
            return {
                content: [{ type: 'text', text: output }]
            };
        }

        case 'solana_arb_get_status': {
            console.log('[ProjectTools] solana_arb_get_status: Handler triggered.');
            const homeDir = process.env.HOME || '~';
            const historyFile = path.join(homeDir, '.clawd', 'funding-arb', 'history.json');
            const tradesFile = path.join(homeDir, '.solarb', 'trades.json');
            console.log(`[ProjectTools] solana_arb_get_status: Checking for files: ${historyFile}, ${tradesFile}`);

            let output = '### Solana Arb Status\n';
            let trades = 0;
            let winRate = 0;

            if (fs.existsSync(tradesFile)) {
                console.log('[ProjectTools] solana_arb_get_status: trades.json found.');
                const data = JSON.parse(fs.readFileSync(tradesFile, 'utf-8'));
                trades = data.length;
                const wins = data.filter(t => t.success && t.profitUsd > 0).length;
                winRate = trades > 0 ? (wins / trades) * 100 : 0;
                output += `Total Trades: ${trades}\nWin Rate: ${winRate.toFixed(1)}%\n`;
            } else {
                console.warn('[ProjectTools] solana_arb_get_status: trades.json not found.');
                output += 'No trade data found.\n';
            }

            if (fs.existsSync(historyFile)) {
                console.log('[ProjectTools] solana_arb_get_status: history.json found.');
                const history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
                const openPositions = history.filter(h => h.type === 'open').length;
                const closedPositions = history.filter(h => h.type === 'close').length;
                output += `Open Positions: ${openPositions}\nLifetime Positions: ${closedPositions}`;
            } else {
                console.warn('[ProjectTools] solana_arb_get_status: history.json not found.');
                output += 'No position history found.';
            }
            
            console.log(`[ProjectTools] solana_arb_get_status: Success. Output: ${output}`);
            return { content: [{ type: 'text', text: output }] };
        }

        case 'list_projects':
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(projectRegistry, null, 2)
                }]
            };

        case 'get_project_structure': {
            const { projectName, relativePath = '.', depth = 2 } = args;
            const rootPath = projectRegistry[projectName];
            if (!rootPath) throw new Error(`Project "${projectName}" not found.`);

            const targetPath = path.resolve(rootPath, relativePath);
            // Security check: ensure targetPath is still inside rootPath
            if (!targetPath.startsWith(rootPath)) {
                throw new Error("Access denied: Cannot access files outside project root.");
            }

            try {
                // Use 'tree' command if available, or 'find'
                // Fallback to simple recursive ls with node if needed, but let's try 'find' for portability on mac/linux
                // Mac doesn't always have 'tree'.
                // Let's use 'find' with maxdepth.
                const cmd = `cd "${targetPath}" && find . -maxdepth ${depth} -not -path '*/.*'`;
                const { stdout } = await execPromise(cmd);
                return { content: [{ type: 'text', text: stdout }] };
            } catch (e) {
                return { content: [{ type: 'text', text: `Error listing directory: ${e.message}` }], isError: true };
            }
        }

        case 'read_project_file': {
            const { projectName, filePath } = args;
            const rootPath = projectRegistry[projectName];
            if (!rootPath) throw new Error(`Project "${projectName}" not found.`);

            const targetPath = path.resolve(rootPath, filePath);
            if (!targetPath.startsWith(rootPath)) {
                throw new Error("Access denied: Cannot access files outside project root.");
            }

            if (!fs.existsSync(targetPath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            if (fs.statSync(targetPath).isDirectory()) {
                throw new Error(`Path is a directory, not a file: ${filePath}`);
            }

            const content = fs.readFileSync(targetPath, 'utf-8');
            return { content: [{ type: 'text', text: content }] };
        }

        case 'search_project': {
            const { projectName, query, filePattern } = args;
            const rootPath = projectRegistry[projectName];
            if (!rootPath) throw new Error(`Project "${projectName}" not found.`);

            // Use git grep if it's a git repo (faster), else grep
            // We know they are git repos mostly.
            const isGit = fs.existsSync(path.join(rootPath, '.git'));

            try {
                let cmd;
                if (isGit) {
                    const include = filePattern ? `-- "${filePattern}"` : '';
                    cmd = `cd "${rootPath}" && git grep -n "${query}" ${include} | head -n 20`;
                } else {
                    const include = filePattern ? `--include="${filePattern}"` : '';
                    // recursive grep, line number, max 20 matches
                    cmd = `cd "${rootPath}" && grep -rn "${query}" ${include} . | head -n 20`;
                }

                const { stdout } = await execPromise(cmd);
                if (!stdout) return { content: [{ type: 'text', text: "No matches found." }] };

                return { content: [{ type: 'text', text: stdout }] };
            } catch (e) {
                // git grep returns exit code 1 if no matches, which throws error in execPromise
                if (e.code === 1) return { content: [{ type: 'text', text: "No matches found." }] };
                return { content: [{ type: 'text', text: `Search error: ${e.message}` }], isError: true };
            }
        }

        default:
            throw new Error(`Unknown project tool: ${name}`);
    }
}
