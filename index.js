#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { startApiServer } from './api_server.js';
import { solanaTools, handleSolanaTool } from './solana_tools.js';
import { driftTools, handleDriftTool } from './drift_tools.js';
import { withLock, loadData, saveData, DEFAULT_STATE } from './persistence.js';

class AILinkServer {
  constructor() {
    this.server = new Server(
      {
        name: 'ai-link-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
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
        // ... include other core tools here if needed, keeping it lean for now ... 
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
        // Add Solana Tools
        ...solanaTools,
        // Add Drift Tools
        ...driftTools
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Check for Solana tools first
        if (name.startsWith('solana_')) {
          return await handleSolanaTool(name, args);
        }
        if (name.startsWith('drift_')) {
          return await handleDriftTool(name, args);
        }

        switch (name) {
          case 'register_ai': return this.handleRegisterAI(args);
          case 'send_message': return this.handleSendMessage(args);
          case 'read_messages': return this.handleReadMessages(args);
          case 'submit_task': return this.handleSubmitTask(args);
          case 'list_tasks': return this.handleListTasks(args);
          case 'claim_task': return this.handleClaimTask(args);
          case 'complete_task': return this.handleCompleteTask(args);
          case 'list_connected_ais': return this.handleListConnectedAIs(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async handleRegisterAI(args) {
    const { aiId, name, capabilities = [], metadata = {} } = args;
    await withLock(async () => {
      const data = await loadData();
      data.aiRegistry[aiId] = { aiId, name, capabilities, metadata, registeredAt: new Date().toISOString() };
      await saveData(data);
    });
    return {
      content: [{ type: 'text', text: `AI "${name}" (${aiId}) registered successfully.` }]
    };
  }

  async handleSendMessage(args) {
    const { fromAiId, toAiId, message, messageType, metadata = {} } = args;

    // Check Recipient
    const recipientExists = await withLock(async () => {
      const data = await loadData();
      return !!data.aiRegistry[toAiId];
    });

    if (!recipientExists) return { content: [{ type: 'text', text: `Recipient AI "${toAiId}" not found` }], isError: true };

    await withLock(async () => {
      const data = await loadData();
      data.messages.push({
        fromAiId, toAiId, message, messageType, metadata,
        timestamp: new Date().toISOString(), read: false
      });
      await saveData(data);
    });

    return { content: [{ type: 'text', text: `Message sent from ${fromAiId} to ${toAiId}` }] };
  }

  async handleReadMessages(args) {
    const { aiId, unreadOnly = false, markAsRead = false } = args;

    return await withLock(async () => {
      const data = await loadData();
      let msgs = data.messages.filter(m => m.toAiId === aiId);

      if (unreadOnly) {
        msgs = msgs.filter(m => !m.read);
      }

      const responseMsgs = JSON.parse(JSON.stringify(msgs)); // Deep copy for response

      if (markAsRead && msgs.length > 0) {
        msgs.forEach(m => m.read = true);
        await saveData(data);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            aiId, messageCount: msgs.length,
            messages: responseMsgs
          }, null, 2)
        }]
      };
    });
  }

  async handleSubmitTask(args) {
    const { description, requiredCapabilities = [] } = args;
    const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await withLock(async () => {
      const data = await loadData();
      if (!data.taskQueue) data.taskQueue = [];
      data.taskQueue.push({
        taskId, description, requiredCapabilities, status: 'pending',
        createdAt: new Date().toISOString()
      });
      await saveData(data);
    });

    return { content: [{ type: 'text', text: JSON.stringify({ taskId, status: 'pending' }) }] };
  }

  async handleListTasks(args) {
    const { status, capability } = args;
    const tasks = await withLock(async () => {
      const data = await loadData();
      let t = data.taskQueue || [];
      if (status) t = t.filter(x => x.status === status);
      if (capability) t = t.filter(x => x.requiredCapabilities.includes(capability));
      return t;
    });

    return { content: [{ type: 'text', text: JSON.stringify({ count: tasks.length, tasks }, null, 2) }] };
  }

  async handleClaimTask(args) {
    const { taskId, aiId } = args;
    return await withLock(async () => {
      const data = await loadData();
      const task = (data.taskQueue || []).find(t => t.taskId === taskId);

      if (!task) throw new Error("Task not found");
      if (task.status !== 'pending') throw new Error(`Task is ${task.status}, cannot claim`);

      task.status = 'in-progress';
      task.assignedTo = aiId;
      task.startedAt = new Date().toISOString();
      await saveData(data);
      return { content: [{ type: 'text', text: `Task ${taskId} claimed by ${aiId}` }] };
    });
  }

  async handleCompleteTask(args) {
    const { taskId, result } = args;
    return await withLock(async () => {
      const data = await loadData();
      const task = (data.taskQueue || []).find(t => t.taskId === taskId);

      if (!task) throw new Error("Task not found");

      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date().toISOString();
      await saveData(data);
      return { content: [{ type: 'text', text: `Task ${taskId} completed` }] };
    });
  }

  async handleListConnectedAIs(args) {
    const { filterByCapability } = args || {};
    const ais = await withLock(async () => {
      const data = await loadData();
      return Object.values(data.aiRegistry || {});
    });

    let filtered = ais;
    if (filterByCapability) {
      filtered = ais.filter(ai => ai.capabilities.includes(filterByCapability));
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ totalAIs: filtered.length, ais: filtered }, null, 2)
      }]
    };
  }

  setupResourceHandlers() {
    // Basic resource handler for now
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: []
    }));
  }

  async run() {
    // await db.initDatabase(); // Legacy SQLite
    await startApiServer();  // Start Express API
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AI Link MCP server running on stdio');
  }
}

const server = new AILinkServer();
server.run().catch(console.error);
