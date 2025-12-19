export class Agent {
    aiId;
    name;
    capabilities;
    metadata;
    client = null;
    constructor(config) {
        this.aiId = config.aiId;
        this.name = config.name;
        this.capabilities = config.capabilities || [];
        this.metadata = config.metadata || {};
    }
    /**
     * Initialize and register the agent with the server
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
        if (!this.client)
            return;
        try {
            const result = await this.callTool('read_messages', {
                aiId: this.aiId,
                unreadOnly: true,
                markAsRead: true
            });
            // The tool returns a JSON string, need to parse it
            // Adjust depending on actual server implementation; assuming string return
            const data = typeof result === 'string' ? JSON.parse(result) : result;
            if (data.messageCount > 0) {
                console.log(`[${this.name}] Received ${data.messageCount} messages.`);
                for (const msg of data.messages) {
                    await this.handleMessage(msg);
                }
            }
        }
        catch (error) {
            console.error(`[${this.name}] Error checking messages:`, error.message);
        }
    }
    /**
     * Handle an incoming message
     */
    async handleMessage(msg) {
        // console.log(`[${this.name}] Processing message from ${msg.from}:`, msg.message); // verbose
        if (msg.type === 'request') {
            try {
                const result = await this.processRequest(msg.message, msg.metadata);
                // Send response back
                await this.sendMessage(msg.from, result, 'response');
            }
            catch (error) {
                console.error(`[${this.name}] Processing error:`, error);
                await this.sendMessage(msg.from, `Error: ${error.message}`, 'response');
            }
        }
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
        if (!this.client)
            throw new Error("Client not initialized");
        const result = await this.client.callTool({ name, arguments: args });
        // MCP SDK result structure: content is an array of content objects
        // We assume text content for these tools
        if (result.content && result.content.length > 0 && result.content[0].type === 'text') {
            return result.content[0].text;
        }
        return result;
    }
}
