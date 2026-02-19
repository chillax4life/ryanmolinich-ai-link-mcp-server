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
import { getDisciplineTools, handleDisciplineTool } from './trading_discipline.js';
import { getAugmentedTraderTools, handleAugmentedTraderTool } from './augmented_trader.js';
import { getMarketIntelligenceTools, handleMarketIntelligenceTool } from './market_intelligence.js';
import { getTechnicalIndicatorTools, handleTechnicalIndicatorTool } from './technical_indicators.js';
import { getFlashExecutorTools, handleFlashExecutorTool, initializeFlashExecutor } from './flash_executor.js';
import { getDriftExecutorTools, handleDriftExecutorTool } from './drift_executor.js';
import { getArbTools, handleArbTool } from './arbitrage_scanner.js';
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
        ...projectTools,
        // Add Trading Discipline Tools
        ...getDisciplineTools(),
        // Add Augmented Trader Tools
        ...getAugmentedTraderTools(),
        // Add Market Intelligence Tools (CoinGlass)
        ...getMarketIntelligenceTools(),
        // Add Technical Indicators
        ...getTechnicalIndicatorTools(),
        // Add Flash.trade Executor
        ...getFlashExecutorTools(),
        // Add Drift Executor
        ...getDriftExecutorTools(),
        // Add Arbitrage Scanner
        ...getArbTools()
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
        
        // Drift Executor (New)
        if (name.startsWith('drift_') && ['drift_get_price', 'drift_get_position', 'drift_open_position', 'drift_close_position'].includes(name)) {
          const result = await handleDriftExecutorTool(name, args);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
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
          return {
            content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }]
          };
        }
        
        // Trading Discipline Tools
        if (name.startsWith('trading_')) {
          const result = await handleDisciplineTool(name, args);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        // Market Intelligence Tools (CoinGlass)
        if (name.startsWith('market_')) {
          const result = await handleMarketIntelligenceTool(name, args);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        // Technical Indicators
        if (name.startsWith('tech_')) {
          const result = await handleTechnicalIndicatorTool(name, args);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        // Flash.trade Executor
        if (name.startsWith('flash_')) {
          const result = await handleFlashExecutorTool(name, args);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        // Drift Executor
        if (name.startsWith('drift_')) {
          const result = await handleDriftExecutorTool(name, args);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        // Arbitrage Scanner
        if (name === 'scan_arbitrage') {
          const result = await handleArbTool(name, args);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
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

    // Initialize Flash.trade Executor
    const flashInit = await initializeFlashExecutor();
    if (flashInit.initialized) {
      console.error(`[Flash] Executor initialized: ${flashInit.mode} mode`);
    }

    // --- INTERNAL AGENT BOOTSTRAP ---
    const internalClient = new InternalClient(this);

    // Helper: Initialize agent with graceful failure
    const safeInit = async (agent, name) => {
      try {
        await agent.initialize(internalClient);
        return agent;
      } catch (e) {
        console.error(`[System] Failed to initialize ${name}: ${e.message}`);
        return null;
      }
    };

    // Initialize agents in parallel with graceful failure handling
    const [oracle, flash, arb, drift, jup, quant, master, flashAgent] = await Promise.all([
      safeInit(new PriceOracleAgent({
        aiId: 'oracle-1',
        name: 'Oracle Eye',
        rpcUrl: process.env.RPC_URL || 'https://api.devnet.solana.com',
        heliusApiKey: process.env.HELIUS_API_KEY
      }), 'PriceOracleAgent'),
      
      safeInit(new FlashLoanAgent({
        aiId: 'flash-1',
        name: 'Flash Financier',
      }), 'FlashLoanAgent'),
      
      safeInit(new FlashArbAgent({
        aiId: 'arb-1',
        name: 'Arb Strategist'
      }), 'FlashArbAgent'),
      
      safeInit(new DriftAgent({
        aiId: 'drift-1',
        name: 'Drift Bot',
        rpcUrl: process.env.RPC_URL || 'https://api.devnet.solana.com',
        env: process.env.DRIFT_ENV || 'devnet'
      }), 'DriftAgent'),
      
      safeInit(new JupiterAgent({
        aiId: 'jup-1',
        name: 'Jupiter Aggillator',
        rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com'
      }), 'JupiterAgent'),
      
      safeInit(new MarketAnalyst({
        aiId: 'quant-1',
        name: 'Market Quant'
      }), 'MarketAnalyst'),
      
      safeInit(new MasterAgent({
        aiId: 'master-1',
        name: 'Master Brain',
        geminiApiKey: process.env.GEMINI_API_KEY
      }), 'MasterAgent'),

      (async () => {
        const MAINNET_RPC = process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';
        let mainnetWallet = null;
        try {
          const walletPath = process.env.SOLANA_WALLET_PATH;
          if (walletPath && fs.existsSync(walletPath)) {
            const secret = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')));
            mainnetWallet = Keypair.fromSecretKey(secret);
            console.log(`[Main] Loaded Wallet for Flash.Trade: ${mainnetWallet.publicKey.toBase58()}`);
          }
        } catch (e) { console.warn("Failed to load mainnet wallet:", e); }
        
        const agent = new FlashTradeAgent({
          aiId: 'flash-guardian',
          name: 'FlashGuardian',
          rpcUrl: MAINNET_RPC,
          wallet: mainnetWallet
        });
        return safeInit(agent, 'FlashTradeAgent');
      })()
    ]);

    // Initialize Flipside (Global Tool)
    if (process.env.FLIPSIDE_API_KEY) {
      initializeFlipside(process.env.FLIPSIDE_API_KEY);
    }

    // Wire up agent dependencies
    if (arb && flash) {
      arb.financier = flash;
    }

    // Log initialized agents
    const activeAgents = [oracle, flash, arb, drift, jup, quant, master, flashAgent].filter(a => a !== null);
    console.error(`[System] ${activeAgents.length}/8 agents initialized successfully.`);

    // --- AGENT HEARTBEAT LOOP ---
    setInterval(async () => {
      try {
        await Promise.all([
          master?.checkMessages().catch(e => {}),
          drift?.checkMessages().catch(e => {}),
          oracle?.checkMessages().catch(e => {}),
          flashAgent?.checkMessages().catch(e => {}),
          flash?.checkMessages().catch(e => {}),
          arb?.checkMessages().catch(e => {})
        ]);
      } catch (err) {
        console.error('[System] Heartbeat Error:', err);
      }
    }, 2000);
  }
}

const server = new AILinkServer();
server.run().catch(console.error);
