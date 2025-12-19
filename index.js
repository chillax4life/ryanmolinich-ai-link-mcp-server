#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { startApiServer } from './api_server.js';
import { solanaTools, handleSolanaTool } from './solana_tools.js';
import { driftTools, handleDriftTool } from './drift_tools.js';
import { duneTools, handleDuneTool } from './dune_tools.js';
import { InternalClient } from './InternalClient.js';
import { PriceOracleAgent } from './agents/PriceOracleAgent.js';
import { FlashLoanAgent } from './agents/FlashLoanAgent.js';
import { FlashArbAgent } from './agents/FlashArbAgent.js';
import { DriftAgent } from './agents/DriftAgent.js';
import { JupiterAgent } from './agents/JupiterAgent.js';
import { FlashTradeAgent } from './agents/FlashTradeAgent.js';
import { MarketAnalyst } from './agents/MarketAnalyst.js';
import { MasterAgent } from './agents/MasterAgent.js';
import { tools as flipsideTools, handlers as flipsideHandlers, initializeFlipside } from './flipside_tools.js';
import { projectTools, handleProjectTool } from './project_tools.js';
import {
  initDatabase,
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
} from './database.js';

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
        // Core tools
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
        // Context Tools
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
        // Add Solana Tools
        ...solanaTools,
        // Add Drift Tools
        ...driftTools,
        // Add Dune Tools
        ...duneTools,
        // Add Flipside Tools
        ...flipsideTools,
        // Add Project Tools
        ...projectTools
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
        if (name.startsWith('dune_')) {
          return await handleDuneTool(name, args);
        }
        if (name.startsWith('flipside_')) {
          return await flipsideHandlers[name](args);
        }

        // Check Project Tools
        if (projectTools.some(t => t.name === name)) {
          return await handleProjectTool(name, args);
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
          case 'share_context': return this.handleShareContext(args);
          case 'get_shared_context': return this.handleGetSharedContext(args);
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
    await registerAI({ aiId, name, capabilities, metadata, registeredAt: new Date().toISOString() });
    return {
      content: [{ type: 'text', text: `AI "${name}" (${aiId}) registered successfully.` }]
    };
  }

  async handleSendMessage(args) {
    const { fromAiId, toAiId, message, messageType, metadata = {} } = args;

    // Check Recipient
    const recipient = await getAI(toAiId);

    if (!recipient) return { content: [{ type: 'text', text: `Recipient AI "${toAiId}" not found` }], isError: true };

    await saveMessage({
      fromAiId, toAiId, message, messageType, metadata,
      timestamp: new Date().toISOString(), read: false
    });

    return { content: [{ type: 'text', text: `Message sent from ${fromAiId} to ${toAiId}` }] };
  }

  async handleReadMessages(args) {
    const { aiId, unreadOnly = false, markAsRead = false } = args;

    let msgs = await getMessages(aiId, unreadOnly);

    if (markAsRead && msgs.length > 0) {
      const { markMessagesRead } = await import('./database.js');
      await markMessagesRead(aiId);
      msgs.forEach(m => m.read = true);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          aiId, messageCount: msgs.length,
          messages: msgs
        }, null, 2)
      }]
    };
  }

  async handleSubmitTask(args) {
    const { description, requiredCapabilities = [] } = args;
    const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await saveTask({
      taskId, description, requiredCapabilities, status: 'pending',
      createdAt: new Date().toISOString(),
      assignedTo: null, result: null, startedAt: null, completedAt: null
    });

    return { content: [{ type: 'text', text: JSON.stringify({ taskId, status: 'pending' }) }] };
  }

  async handleListTasks(args) {
    const { status, capability } = args;
    let tasks = await getAllTasks();

    if (status) tasks = tasks.filter(x => x.status === status);
    if (capability) tasks = tasks.filter(x => x.requiredCapabilities.includes(capability));

    return { content: [{ type: 'text', text: JSON.stringify({ count: tasks.length, tasks }, null, 2) }] };
  }

  async handleClaimTask(args) {
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

  async handleCompleteTask(args) {
    const { taskId, result } = args;

    const task = await getTask(taskId);

    if (!task) throw new Error("Task not found");

    task.status = 'completed';
    task.result = result;
    task.completedAt = new Date().toISOString();

    await saveTask(task);

    return { content: [{ type: 'text', text: `Task ${taskId} completed` }] };
  }

  async handleListConnectedAIs(args) {
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

  async handleShareContext(args) {
    const { contextId, data, authorizedAiIds = [], expiresIn } = args;

    let expiresAt = null;
    if (expiresIn) {
      const expDate = new Date();
      expDate.setSeconds(expDate.getSeconds() + expiresIn);
      expiresAt = expDate.toISOString();
    }

    await saveContext({
      contextId, data, authorizedAiIds,
      createdAt: new Date().toISOString(),
      expiresAt
    });

    return { content: [{ type: 'text', text: `Context ${contextId} shared` }] };
  }

  async handleGetSharedContext(args) {
    const { contextId, aiId } = args;
    const context = await getContext(contextId);

    if (!context) throw new Error("Context not found");

    // Check Authorization
    if (context.authorizedAiIds && context.authorizedAiIds.length > 0) {
      if (!context.authorizedAiIds.includes(aiId)) {
        throw new Error("Unauthorized to access this context");
      }
    }

    // Check expiration
    if (context.expiresAt) {
      if (new Date() > new Date(context.expiresAt)) {
        throw new Error("Context expired");
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify(context.data, null, 2) }] };
  }

  setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));
  }

  async run() {
    await initDatabase(); // Initialize SQLite with WAL

    // Start the Agave-style Scheduler
    const { Scheduler } = await import('./scheduler.js');
    this.scheduler = new Scheduler();
    this.scheduler.start();

    await startApiServer();  // Start Express API
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AI Link MCP server running on stdio');

    // --- INTERNAL AGENT BOOTSTRAP ---
    try {
      const internalClient = new InternalClient(this);

      // 1. Price Oracle (The Eyes) - Agent ID: oracle-1
      const oracle = new PriceOracleAgent({
        aiId: 'oracle-1',
        name: 'Oracle Eye',
        rpcUrl: process.env.RPC_URL || 'https://api.devnet.solana.com',
        heliusApiKey: process.env.HELIUS_API_KEY
      });
      await oracle.initialize(internalClient);

      // 1.5 Flash Loan Agent (The Financier) - Agent ID: flash-1
      const flash = new FlashLoanAgent({
        aiId: 'flash-1',
        name: 'Flash Financier',
        // env: 'dev' 
      });
      await flash.initialize(internalClient);

      // 1.8 Flash Arb Strategist (The Strategist) - Agent ID: arb-1
      const arb = new FlashArbAgent({
        aiId: 'arb-1',
        name: 'Arb Strategist'
      });
      await arb.initialize(internalClient);
      arb.financier = flash; // Give Strategist access to the Bank

      // Initialize Flipside (Global Tool)
      if (process.env.FLIPSIDE_API_KEY) {
        initializeFlipside(process.env.FLIPSIDE_API_KEY);
      }

      // 2. Drift Agent (The Muscle) - Agent ID: drift-1
      const drift = new DriftAgent({
        aiId: 'drift-1',
        name: 'Drift Bot',
        rpcUrl: process.env.RPC_URL || 'https://api.devnet.solana.com',
        env: process.env.DRIFT_ENV || 'devnet' // Default to devnet for safety
      });
      await drift.initialize(internalClient);

      // 3. Jupiter Agent (The Aggillator) - Agent ID: jup-1
      const jup = new JupiterAgent({
        aiId: 'jup-1',
        name: 'Jupiter Aggillator',
        rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com'
      });
      await jup.initialize(internalClient);

      // 4. Market Analyst (The Quant) - Agent ID: quant-1
      const quant = new MarketAnalyst({
        aiId: 'quant-1',
        name: 'Market Quant'
      });
      await quant.initialize(internalClient);

      // 5. Master Agent (The Brain) - Agent ID: master-1
      const master = new MasterAgent({
        aiId: 'master-1',
        name: 'Master Brain',
        geminiApiKey: process.env.GEMINI_API_KEY
      });
      await master.initialize(internalClient);

      console.error('[System] Internal Agents (Oracle, Drift, Master) initialized.');

      // 4. Flash Trade Agent (Mainnet Guard)
      // Needs Mainnet RPC. If process.env.RPC_URL is devnet, we might need a separate one.
      // Assuming RPC_URL is generic or user provides it. 
      // For safety, let's look for a MAINNET specific var or fallback to public.
      const MAINNET_RPC = process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';

      // Load persisted wallet if available
      let mainnetWallet = null;
      try {
        if (fs.existsSync('solana_wallet.json')) {
          const secret = Uint8Array.from(JSON.parse(fs.readFileSync('solana_wallet.json', 'utf-8')));
          mainnetWallet = Keypair.fromSecretKey(secret);
          console.log(`[Main] Loaded Wallet for Flash.Trade: ${mainnetWallet.publicKey.toBase58()}`);
        }
      } catch (e) { console.warn("Failed to load mainnet wallet:", e); }

      const flashAgent = new FlashTradeAgent({
        aiId: 'flash-guardian',
        name: 'FlashGuardian',
        rpcUrl: MAINNET_RPC,
        wallet: mainnetWallet // Can be null, agent handles it
      });

      // Assign tools
      // flashAgent.registerTools(solanaTools); // If it needed generic tools

      // Init
      await flashAgent.initialize(internalClient, oracle);

      // --- REGISTRATION (Using internal registry in MasterAgent) ---
      // master.registerAgent is not a function. MasterAgent has a hardcoded registry.
      // We must update MasterAgent.js to know about these new agents.
      // But we MUST keep the heartbeat loop below.

      // --- AGENT HEARTBEAT LOOP ---
      // Poll for messages every 2 seconds so they can react to Chat UI
      setInterval(async () => {
        try {
          // Parallel checks
          await Promise.all([
            master.checkMessages().catch(e => console.error(`[Loop] Master check failed: ${e.message}`)),
            drift.checkMessages().catch(e => console.error(`[Loop] Drift check failed: ${e.message}`)),
            oracle.checkMessages().catch(e => console.error(`[Loop] Oracle check failed: ${e.message}`)),
            flashAgent.checkMessages().catch(e => console.error(`[Loop] FlashGuardian check failed: ${e.message}`)),
            flash.checkMessages().catch(e => console.error(`[Loop] Financier check failed: ${e.message}`)),
            arb.checkMessages().catch(e => console.error(`[Loop] Strategist check failed: ${e.message}`))
          ]);
        } catch (err) {
          console.error('[System] Heartbeat Error:', err);
        }
      }, 2000);

    } catch (e) {
      console.error('[System] Failed to initialize internal agents:', e);
    }
  }
}

const server = new AILinkServer();
server.run().catch(console.error);
