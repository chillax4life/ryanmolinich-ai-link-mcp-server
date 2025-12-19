/**
 * InternalClient.js
 * acts as a bridge for Agents running within the same process as the Server.
 * Mimics the MCP Client interface but routes calls directly to Server handlers.
 */
export class InternalClient {
    constructor(serverInstance) {
        this.server = serverInstance;
    }

    /**
     * Mimic client.callTool(name, args)
     */
    async callTool(request) {
        const { name, arguments: args } = request;

        // Route directly to server methods based on naming convention
        // This mirrors the switch statement in index.js setupToolHandlers
        try {
            switch (name) {
                case 'register_ai': return await this.server.handleRegisterAI(args);
                case 'send_message': return await this.server.handleSendMessage(args);
                case 'read_messages': return await this.server.handleReadMessages(args);
                case 'submit_task': return await this.server.handleSubmitTask(args);
                case 'list_tasks': return await this.server.handleListTasks(args);
                case 'claim_task': return await this.server.handleClaimTask(args);
                case 'complete_task': return await this.server.handleCompleteTask(args);
                case 'list_connected_ais': return await this.server.handleListConnectedAIs(args);

                // For Solana/Drift tools, we might need to route differently or
                // expose handleSolanaTool/handleDriftTool on the server instance.
                // For now, let's assume agents mostly use the Core Tools (messaging/tasks).
                default:
                    // If the server exposes a generic tool handler, we could use that.
                    // Or we just throw for now if they try to call external tools via loopback.
                    // Ideally, we'd refactor index.js to expose a unified `executeTool` method.
                    throw new Error(`Tool ${name} not supported via InternalClient yet.`);
            }
        } catch (error) {
            console.error(`[InternalClient] Error calling ${name}:`, error);
            // Return error in MCP format
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true
            };
        }
    }
}
