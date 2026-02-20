/**
 * Tool Handlers — All MCP tool dispatch and core handler logic.
 *
 * Dispatches incoming tool calls to the correct handler module,
 * and contains the core AI-Link handlers (register, message, task, context).
 */

import { handleSolanaTool } from '../solana_tools.js';
import { handleDriftTool } from '../drift_tools.js';
import { handleDuneTool } from '../dune_tools.js';
import { handlers as flipsideHandlers } from '../flipside_tools.js';
import { projectTools, handleProjectTool } from '../project_tools.js';
import { handleDisciplineTool } from '../trading_discipline.js';
import { handleAugmentedTraderTool } from '../augmented_trader.js';
import { handleMarketIntelligenceTool } from '../market_intelligence.js';
import { handleTechnicalIndicatorTool } from '../technical_indicators.js';
import { handleFlashExecutorTool } from '../flash_executor.js';
import { handleDriftExecutorTool } from '../drift_executor.js';
import { handleArbTool } from '../arbitrage_scanner.js';
import {
    registerAI,
    getAI,
    getAllAIs,
    saveMessage,
    getMessages,
    saveTask,
    getTask,
    getAllTasks,
    saveContext,
    getContext
} from '../database.js';

// ─── Core AI-Link Handlers ───────────────────────────────────────────

async function handleRegisterAI(args) {
    const { aiId, name, capabilities = [], metadata = {} } = args;
    await registerAI({ aiId, name, capabilities, metadata, registeredAt: new Date().toISOString() });
    return {
        content: [{ type: 'text', text: `AI "${name}" (${aiId}) registered successfully.` }]
    };
}

async function handleSendMessage(args) {
    const { fromAiId, toAiId, message, messageType, metadata = {} } = args;
    const recipient = await getAI(toAiId);
    if (!recipient) return { content: [{ type: 'text', text: `Recipient AI "${toAiId}" not found` }], isError: true };

    await saveMessage({
        fromAiId, toAiId, message, messageType, metadata,
        timestamp: new Date().toISOString(), read: false
    });
    return { content: [{ type: 'text', text: `Message sent from ${fromAiId} to ${toAiId}` }] };
}

async function handleReadMessages(args) {
    const { aiId, unreadOnly = false, markAsRead = false } = args;
    let msgs = await getMessages(aiId, unreadOnly);

    if (markAsRead && msgs.length > 0) {
        const { markMessagesRead } = await import('../database.js');
        await markMessagesRead(aiId);
        msgs.forEach(m => m.read = true);
    }

    return {
        content: [{
            type: 'text',
            text: JSON.stringify({ aiId, messageCount: msgs.length, messages: msgs }, null, 2)
        }]
    };
}

async function handleSubmitTask(args) {
    const { description, requiredCapabilities = [] } = args;
    const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await saveTask({
        taskId, description, requiredCapabilities, status: 'pending',
        createdAt: new Date().toISOString(),
        assignedTo: null, result: null, startedAt: null, completedAt: null
    });
    return { content: [{ type: 'text', text: JSON.stringify({ taskId, status: 'pending' }) }] };
}

async function handleListTasks(args) {
    const { status, capability } = args;
    let tasks = await getAllTasks();
    if (status) tasks = tasks.filter(x => x.status === status);
    if (capability) tasks = tasks.filter(x => x.requiredCapabilities.includes(capability));
    return { content: [{ type: 'text', text: JSON.stringify({ count: tasks.length, tasks }, null, 2) }] };
}

async function handleClaimTask(args) {
    const { taskId, aiId } = args;
    const task = await getTask(taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== 'pending') throw new Error(`Task is ${task.status}, cannot claim`);

    task.status = 'in-progress';
    task.assignedTo = aiId;
    task.startedAt = new Date().toISOString();
    await saveTask(task);
    return { content: [{ type: 'text', text: `Task ${taskId} claimed by ${aiId}` }] };
}

async function handleCompleteTask(args) {
    const { taskId, result } = args;
    const task = await getTask(taskId);
    if (!task) throw new Error("Task not found");

    task.status = 'completed';
    task.result = result;
    task.completedAt = new Date().toISOString();
    await saveTask(task);
    return { content: [{ type: 'text', text: `Task ${taskId} completed` }] };
}

async function handleListConnectedAIs(args) {
    const { filterByCapability } = args || {};
    let ais = await getAllAIs();
    if (filterByCapability) {
        ais = ais.filter(ai => ai.capabilities.includes(filterByCapability));
    }
    return {
        content: [{
            type: 'text',
            text: JSON.stringify({ totalAIs: ais.length, ais: ais }, null, 2)
        }]
    };
}

async function handleShareContext(args) {
    const { contextId, data, authorizedAiIds = [], expiresIn } = args;
    let expiresAt = null;
    if (expiresIn) {
        const expDate = new Date();
        expDate.setSeconds(expDate.getSeconds() + expiresIn);
        expiresAt = expDate.toISOString();
    }
    await saveContext({ contextId, data, authorizedAiIds, createdAt: new Date().toISOString(), expiresAt });
    return { content: [{ type: 'text', text: `Context ${contextId} shared` }] };
}

async function handleGetSharedContext(args) {
    const { contextId, aiId } = args;
    const context = await getContext(contextId);
    if (!context) throw new Error("Context not found");

    if (context.authorizedAiIds && context.authorizedAiIds.length > 0) {
        if (!context.authorizedAiIds.includes(aiId)) {
            throw new Error("Unauthorized to access this context");
        }
    }
    if (context.expiresAt) {
        if (new Date() > new Date(context.expiresAt)) {
            throw new Error("Context expired");
        }
    }
    return { content: [{ type: 'text', text: JSON.stringify(context.data, null, 2) }] };
}

// ─── Dispatch Router ─────────────────────────────────────────────────

/**
 * Route an incoming tool call to the correct handler.
 * Returns the MCP response object.
 */
export async function dispatchToolCall(name, args) {
    // Solana Tools
    if (name.startsWith('solana_')) {
        return await handleSolanaTool(name, args);
    }

    // Drift Executor (new-style tools)
    if (name.startsWith('drift_') && ['drift_get_price', 'drift_get_position', 'drift_open_position', 'drift_close_position'].includes(name)) {
        const result = await handleDriftExecutorTool(name, args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    // Drift Tools (Legacy)
    if (name.startsWith('drift_')) {
        return await handleDriftTool(name, args);
    }

    if (name.startsWith('dune_')) {
        return await handleDuneTool(name, args);
    }
    if (name.startsWith('flipside_')) {
        return await flipsideHandlers[name](args);
    }

    // Augmented Trader Tools (must check before generic trading_ prefix)
    const augmentedTools = ['trading_analyze', 'trading_prepare', 'trading_execute', 'trading_cancel', 'trading_positions', 'trading_close', 'trading_pending'];
    if (augmentedTools.includes(name)) {
        const result = await handleAugmentedTraderTool(name, args);
        return { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] };
    }

    // Trading Discipline Tools
    if (name.startsWith('trading_')) {
        const result = await handleDisciplineTool(name, args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    // Market Intelligence Tools
    if (name.startsWith('market_')) {
        const result = await handleMarketIntelligenceTool(name, args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    // Technical Indicators
    if (name.startsWith('tech_')) {
        const result = await handleTechnicalIndicatorTool(name, args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    // Flash.trade Executor
    if (name.startsWith('flash_')) {
        const result = await handleFlashExecutorTool(name, args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    // Arbitrage Scanner
    if (name === 'scan_arbitrage') {
        const result = await handleArbTool(name, args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    // Project Tools
    if (projectTools.some(t => t.name === name)) {
        return await handleProjectTool(name, args);
    }

    // Core AI-Link handlers
    switch (name) {
        case 'register_ai': return handleRegisterAI(args);
        case 'send_message': return handleSendMessage(args);
        case 'read_messages': return handleReadMessages(args);
        case 'submit_task': return handleSubmitTask(args);
        case 'list_tasks': return handleListTasks(args);
        case 'claim_task': return handleClaimTask(args);
        case 'complete_task': return handleCompleteTask(args);
        case 'list_connected_ais': return handleListConnectedAIs(args);
        case 'share_context': return handleShareContext(args);
        case 'get_shared_context': return handleGetSharedContext(args);
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
