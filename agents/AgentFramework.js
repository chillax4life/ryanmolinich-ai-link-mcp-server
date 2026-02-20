/**
 * Base Agent Framework
 * 
 * Provides the foundation for creating specialized agents that connect
 * to the AI Link MCP Server.
 */
export class Agent {
    constructor(config) {
        this.aiId = config.aiId;
        this.name = config.name;
        this.capabilities = config.capabilities || [];
        this.metadata = config.metadata || {};
        this.client = null; // MCP Client instance
    }

    /**
     * Initialize and register the agent with the server
     * @param {Object} client - Connected MCP client instance
     */
    async initialize(client) {
        this.client = client;
        console.log(`[${this.name}] Registering...`);

        await this.callTool('register_ai', {
            aiId: this.aiId,
            name: this.name,
            capabilities: this.capabilities,
            metadata: this.metadata
        });

        console.log(`[${this.name}] Registered successfully.`);
    }

    /**
     * Poll for new messages and process them
     */
    async checkMessages() {
        if (!this.client) return;

        try {
            const response = await this.callTool('read_messages', {
                aiId: this.aiId,
                unreadOnly: true,
                markAsRead: true
            });

            const data = JSON.parse(response);

            if (data.messageCount > 0) {
                console.log(`[${this.name}] Received ${data.messageCount} messages.`);
                for (const msg of data.messages) {
                    await this.handleMessage(msg);
                }
            }
        } catch (error) {
            console.error(`[${this.name}] Error checking messages:`, error.message);
        }
    }

    /**
     * Handle an incoming message
     * @param {Object} msg - The message object
     */
    async handleMessage(msg) {
        console.log(`[${this.name}] Processing message from ${msg.fromAiId || msg.from}: "${(msg.message || '').substring(0, 50)}..."`);

        const type = msg.messageType || msg.type;

        if (type === 'request') {
            try {
                const result = await this.processRequest(msg.message, msg.metadata);

                // Send response back
                await this.sendMessage(msg.from, result, 'response');
            } catch (error) {
                console.error(`[${this.name}] Processing error:`, error);
                await this.sendMessage(msg.from, `Error: ${error.message}`, 'response');
            }
        }
    }

    /**
     * Abstract method to be implemented by subclasses
     * @param {string} prompt - The request content
     * @param {Object} metadata - Additional context
     */
    async processRequest(prompt, metadata) {
        throw new Error('processRequest must be implemented by subclass');
    }

    /**
     * Helper to send a message
     */
    async sendMessage(toAiId, message, type = 'request', metadata = {}) {
        await this.callTool('send_message', {
            fromAiId: this.aiId,
            toAiId,
            message: typeof message === 'string' ? message : JSON.stringify(message),
            messageType: type,
            metadata
        });
        console.log(`[${this.name}] Sent ${type} to ${toAiId}`);
    }

    /**
     * Helper to execute MCP tool calls
     */
    async callTool(name, args) {
        // The client.callTool method (InternalClient) is now responsible for extracting the text.
        // This method should just return the raw string result.
        return await this.client.callTool({ name, arguments: args });
    }
}
