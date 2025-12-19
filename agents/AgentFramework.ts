import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export interface AgentConfig {
    aiId: string;
    name: string;
    capabilities?: string[];
    metadata?: Record<string, any>;
}

export interface Message {
    from: string;
    to: string;
    message: string;
    type: 'request' | 'response' | 'notification' | 'data';
    metadata?: any;
    timestamp?: number;
}

export interface ReadMessagesResponse {
    messageCount: number;
    messages: Message[];
}

export abstract class Agent {
    public aiId: string;
    public name: string;
    public capabilities: string[];
    public metadata: Record<string, any>;
    public client: Client | null = null;

    constructor(config: AgentConfig) {
        this.aiId = config.aiId;
        this.name = config.name;
        this.capabilities = config.capabilities || [];
        this.metadata = config.metadata || {};
    }

    /**
     * Initialize and register the agent with the server
     */
    async initialize(client: Client) {
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
            const result = await this.callTool('read_messages', {
                aiId: this.aiId,
                unreadOnly: true,
                markAsRead: true
            });

            // The tool returns a JSON string, need to parse it
            // Adjust depending on actual server implementation; assuming string return
            const data: ReadMessagesResponse = typeof result === 'string' ? JSON.parse(result) : result;

            if (data.messageCount > 0) {
                console.log(`[${this.name}] Received ${data.messageCount} messages.`);
                for (const msg of data.messages) {
                    await this.handleMessage(msg);
                }
            }
        } catch (error: any) {
            console.error(`[${this.name}] Error checking messages:`, error.message);
        }
    }

    /**
     * Handle an incoming message
     */
    async handleMessage(msg: Message) {
        // console.log(`[${this.name}] Processing message from ${msg.from}:`, msg.message); // verbose

        if (msg.type === 'request') {
            try {
                const result = await this.processRequest(msg.message, msg.metadata);

                // Send response back
                await this.sendMessage(msg.from, result, 'response');
            } catch (error: any) {
                console.error(`[${this.name}] Processing error:`, error);
                await this.sendMessage(msg.from, `Error: ${error.message}`, 'response');
            }
        }
    }

    /**
     * Abstract method to be implemented by subclasses
     */
    abstract processRequest(prompt: string, metadata?: any): Promise<string>;

    /**
     * Helper to send a message
     */
    async sendMessage(toAiId: string, message: string | object, type: 'request' | 'response' | 'notification' = 'request', metadata: any = {}) {
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
    async callTool(name: string, args: Record<string, any>): Promise<any> {
        if (!this.client) throw new Error("Client not initialized");
        const result: any = await this.client.callTool({ name, arguments: args });

        // MCP SDK result structure: content is an array of content objects
        // We assume text content for these tools
        if (result.content && result.content.length > 0 && result.content[0].type === 'text') {
            return result.content[0].text;
        }
        return result;
    }
}
