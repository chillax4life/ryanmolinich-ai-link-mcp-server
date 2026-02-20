/**
 * InternalClient.js
 * Acts as a bridge for Agents running within the same process as the Server.
 * Mimics the MCP Client interface but routes calls directly to Server handlers.
 */
import { handleSolanaTool } from './solana_tools.js';
import { handleDriftTool } from './drift_tools.js';
import { handleDuneTool } from './dune_tools.js';
import { handlers as flipsideHandlers } from './flipside_tools.js';
import { handleProjectTool, projectTools } from './project_tools.js';
import { handleAugmentedTraderTool } from './augmented_trader.js';
import { handleMarketIntelligenceTool } from './market_intelligence.js';
import { handleTechnicalIndicatorTool } from './technical_indicators.js';
import { handleFlashExecutorTool } from './flash_executor.js';
import { handleArbTool } from './arbitrage_scanner.js';
import { handleDisciplineTool } from './trading_discipline.js';
import { handleDriftExecutorTool } from './drift_executor.js';


export class InternalClient {
    constructor(serverInstance) {
        this.server = serverInstance;
        
        // This is the critical fix. It ensures that when callTool is invoked
        // by other classes, 'this' still refers to the InternalClient instance.
        this.callTool = this.callTool.bind(this);

        this.toolsets = [
            { prefix: 'solana_', handler: handleSolanaTool },
            { prefix: 'drift_', handler: handleDriftExecutorTool }, // Corrected from handleDriftTool
            { prefix: 'dune_', handler: handleDuneTool },
            { prefix: 'market_', handler: handleMarketIntelligenceTool },
            { prefix: 'tech_', handler: handleTechnicalIndicatorTool },
            { prefix: 'flash_', handler: handleFlashExecutorTool },
            { 
                prefix: 'trading_', 
                handler: async (name, args) => {
                    const augmentedTools = ['trading_analyze', 'trading_prepare', 'trading_execute', 'trading_cancel', 'trading_positions', 'trading_close', 'trading_pending'];
                    if (augmentedTools.includes(name)) {
                        return await handleAugmentedTraderTool(name, args);
                    }
                    return await handleDisciplineTool(name, args);
                } 
            },
            {
                match: (name) => name === 'scan_arbitrage',
                handler: handleArbTool
            },
            { 
                prefix: 'flipside_', 
                handler: async (name, args) => {
                    if (flipsideHandlers[name]) {
                        return await flipsideHandlers[name](args);
                    }
                    throw new Error(`Unknown Flipside tool: ${name}`);
                } 
            },
            {
                match: (name) => projectTools.some(t => t.name === name),
                handler: handleProjectTool
            }
        ];

        this.coreHandlers = {
            'register_ai': async (args) => await this.server.handleRegisterAI(args),
            'send_message': async (args) => await this.server.handleSendMessage(args),
            'read_messages': async (args) => await this.server.handleReadMessages(args),
            'submit_task': async (args) => await this.server.handleSubmitTask(args),
            'list_tasks': async (args) => await this.server.handleListTasks(args),
            'claim_task': async (args) => await this.server.handleClaimTask(args),
            'complete_task': async (args) => await this.server.handleCompleteTask(args),
            'list_connected_ais': async (args) => await this.server.handleListConnectedAIs(args),
            'share_context': async (args) => await this.server.handleShareContext(args),
            'get_shared_context': async (args) => await this.server.handleGetSharedContext(args)
        };
    }

    async callTool(request) {
        const { name, arguments: args } = request;

        try {
            if (this.coreHandlers[name]) {
                const result = await this.coreHandlers[name](args);
                return result.content[0].text;
            }

            for (const toolset of this.toolsets) {
                const isMatch = toolset.prefix ? name.startsWith(toolset.prefix) : (toolset.match && toolset.match(name));
                if (isMatch) {
                    const result = await toolset.handler(name, args);
                    if (result && result.content && result.content[0] && result.content[0].text) {
                        return result.content[0].text;
                    }
                    return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                }
            }

            throw new Error(`Unknown tool: ${name}`);
        } catch (error) {
            console.error(`[InternalClient] Error calling ${name}:`, error);
            return JSON.stringify({ error: true, message: error.message });
        }
    }
}
