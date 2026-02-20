#!/usr/bin/env node

/**
 * AI Link MCP Server — Entry Point
 *
 * Thin orchestrator that wires together:
 *   - MCP Server (stdio transport)
 *   - Tool registry & dispatch (tools/)
 *   - Agent bootstrap & heartbeat (agents/initializer)
 *   - Express API server (api_server)
 *   - Database (SQLite + WAL)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { startApiServer } from './api_server.js';
import { initDatabase } from './database.js';
import { InternalClient } from './InternalClient.js';
import { initializeFlipside } from './flipside_tools.js';
import { initializeFlashExecutor } from './flash_executor.js';
import { getAllTools } from './tools/registry.js';
import { dispatchToolCall } from './tools/handlers.js';
import { initializeAllAgents, startHeartbeat } from './agents/initializer.js';

class AILinkServer {
  constructor() {
    this.server = new Server(
      { name: 'ai-link-mcp-server', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {} } }
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
    // List all available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: getAllTools(),
    }));

    // Dispatch tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        return await dispatchToolCall(name, args);
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));
  }

  async run() {
    // Database
    await initDatabase();

    // Scheduler
    const { Scheduler } = await import('./scheduler.js');
    this.scheduler = new Scheduler();
    this.scheduler.start();

    // API Server
    await startApiServer();

    // MCP Transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AI Link MCP server running on stdio');

    // Flash.trade Executor
    const flashInit = await initializeFlashExecutor();
    if (flashInit.initialized) {
      console.error(`[Flash] Executor initialized: ${flashInit.mode} mode`);
    }

    // Flipside
    if (process.env.FLIPSIDE_API_KEY) {
      initializeFlipside(process.env.FLIPSIDE_API_KEY);
    }

    // Agents
    const internalClient = new InternalClient(this);
    const agents = await initializeAllAgents(internalClient);
    startHeartbeat(agents);
  }
}

const server = new AILinkServer();
server.run().catch(console.error);
