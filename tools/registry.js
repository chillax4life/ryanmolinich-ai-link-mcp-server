/**
 * Tool Registry — All MCP tool definitions (schemas) in one place.
 * 
 * Each tool module exports its own schema array. This file aggregates
 * them alongside the core AI-Link tools (register, message, task, context).
 */

import { solanaTools } from '../solana_tools.js';
import { driftTools } from '../drift_tools.js';
import { duneTools } from '../dune_tools.js';
import { tools as flipsideTools } from '../flipside_tools.js';
import { projectTools } from '../project_tools.js';
import { getDisciplineTools } from '../trading_discipline.js';
import { getAugmentedTraderTools } from '../augmented_trader.js';
import { getMarketIntelligenceTools } from '../market_intelligence.js';
import { getTechnicalIndicatorTools } from '../technical_indicators.js';
import { getFlashExecutorTools } from '../flash_executor.js';
import { getDriftExecutorTools } from '../drift_executor.js';
import { getArbTools } from '../arbitrage_scanner.js';

/**
 * Core AI-Link tool schemas (register, message, task, context).
 */
const coreTools = [
    {
        name: 'register_ai',
        description: 'Register an AI system in the network with metadata (name, capabilities, etc.)',
        inputSchema: {
            type: 'object',
            properties: {
                aiId: { type: 'string', description: 'Unique identifier for the AI system' },
                name: { type: 'string', description: 'Display name for the AI' },
                capabilities: { type: 'array', items: { type: 'string' }, description: 'List of capabilities this AI has' },
                metadata: { type: 'object', description: 'Additional metadata about the AI' },
            },
            required: ['aiId', 'name'],
        },
    },
    {
        name: 'send_message',
        description: 'Send a message from one AI to another AI in the network',
        inputSchema: {
            type: 'object',
            properties: {
                fromAiId: { type: 'string', description: 'ID of the sending AI' },
                toAiId: { type: 'string', description: 'ID of the receiving AI' },
                message: { type: 'string', description: 'The message content' },
                messageType: { type: 'string', enum: ['request', 'response', 'notification', 'data'], description: 'Type of message being sent' },
                metadata: { type: 'object', description: 'Additional metadata for the message' },
            },
            required: ['fromAiId', 'toAiId', 'message', 'messageType'],
        },
    },
    {
        name: 'read_messages',
        description: 'Read messages sent to a specific AI',
        inputSchema: {
            type: 'object',
            properties: {
                aiId: { type: 'string', description: 'ID of the AI to read messages for' },
                unreadOnly: { type: 'boolean', description: 'Only return unread messages' },
                markAsRead: { type: 'boolean', description: 'Mark retrieved messages as read' },
            },
            required: ['aiId'],
        },
    },
    {
        name: 'submit_task',
        description: 'Submit a new task to the global queue',
        inputSchema: {
            type: 'object',
            properties: {
                description: { type: 'string' },
                requiredCapabilities: { type: 'array', items: { type: 'string' } }
            },
            required: ['description']
        }
    },
    {
        name: 'list_tasks',
        description: 'List available tasks in the queue',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['pending', 'in-progress', 'completed'] },
                capability: { type: 'string' }
            }
        }
    },
    {
        name: 'claim_task',
        description: 'Claim a task to work on',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string' },
                aiId: { type: 'string' }
            },
            required: ['taskId', 'aiId']
        }
    },
    {
        name: 'complete_task',
        description: 'Mark a task as completed with a result',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string' },
                result: { type: 'string' }
            },
            required: ['taskId', 'result']
        }
    },
    {
        name: 'list_connected_ais',
        description: 'List all registered AI systems in the network',
        inputSchema: {
            type: 'object',
            properties: {
                filterByCapability: { type: 'string', description: 'Filter AIs by a specific capability' }
            }
        }
    },
    {
        name: 'share_context',
        description: 'Share a context object with other AIs',
        inputSchema: {
            type: 'object',
            properties: {
                contextId: { type: 'string' },
                data: { type: 'object' },
                authorizedAiIds: { type: 'array', items: { type: 'string' } },
                expiresIn: { type: 'number', description: 'Expiration in seconds' }
            },
            required: ['contextId', 'data']
        }
    },
    {
        name: 'get_shared_context',
        description: 'Retrieve a shared context object',
        inputSchema: {
            type: 'object',
            properties: {
                contextId: { type: 'string' },
                aiId: { type: 'string', description: 'ID of the AI requesting the context' }
            },
            required: ['contextId', 'aiId']
        }
    },
];

/**
 * Returns the full list of all registered MCP tools.
 */
export function getAllTools() {
    return [
        ...coreTools,
        ...solanaTools,
        ...driftTools,
        ...duneTools,
        ...flipsideTools,
        ...projectTools,
        ...getDisciplineTools(),
        ...getAugmentedTraderTools(),
        ...getMarketIntelligenceTools(),
        ...getTechnicalIndicatorTools(),
        ...getFlashExecutorTools(),
        ...getDriftExecutorTools(),
        ...getArbTools(),
    ];
}
