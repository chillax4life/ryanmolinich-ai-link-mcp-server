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

export class InternalClient {
    constructor(serverInstance) {
        this.server = serverInstance;
    }

    /**
     * Mimic client.callTool(name, args)
     */
    async callTool(request) {
        const { name, arguments: args } = request;

        try {
            // Solana tools
            if (name.startsWith('solana_')) {
                return await handleSolanaTool(name, args);
            }
            // Drift tools
            if (name.startsWith('drift_')) {
                return await handleDriftTool(name, args);
            }
            // Dune tools
            if (name.startsWith('dune_')) {
                return await handleDuneTool(name, args);
            }
            // Flipside tools
            if (name.startsWith('flipside_') && flipsideHandlers[name]) {
                return await flipsideHandlers[name](args);
            }
            // Project tools
            if (projectTools.some(t => t.name === name)) {
                return await handleProjectTool(name, args);
            }

            // Core tools (messaging, tasks, context)
            switch (name) {
                case 'register_ai': return await this.server.handleRegisterAI(args);
                case 'send_message': return await this.server.handleSendMessage(args);
                case 'read_messages': return await this.server.handleReadMessages(args);
                case 'submit_task': return await this.server.handleSubmitTask(args);
                case 'list_tasks': return await this.server.handleListTasks(args);
                case 'claim_task': return await this.server.handleClaimTask(args);
                case 'complete_task': return await this.server.handleCompleteTask(args);
                case 'list_connected_ais': return await this.server.handleListConnectedAIs(args);
                case 'share_context': return await this.server.handleShareContext(args);
                case 'get_shared_context': return await this.server.handleGetSharedContext(args);
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        } catch (error) {
            console.error(`[InternalClient] Error calling ${name}:`, error);
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true
            };
        }
    }
}
