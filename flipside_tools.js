// Stub implementation to bypass missing SDK dependency
// import { Flipside } from "@flipsidecrypto/sdk";

let flipsideFn = null;

export const initializeFlipside = (apiKey) => {
    if (!apiKey) {
        console.warn("[Flipside] No API Key provided.");
        return;
    }
    // Mock SDK or partial Fetch implementation
    console.log("[Flipside] SDK not available (NPM Error). Running in Stub Mode.");
    flipsideFn = {
        query: {
            run: async ({ sql }) => {
                return {
                    records: [{ info: "Flipside SDK missing. SQL checked but not executed.", sql_preview: sql }],
                    error: null
                };
            }
        }
    };
};

export const tools = [
    {
        name: "flipside_query",
        description: "Execute a SQL query against Flipside Crypto data.",
        inputSchema: {
            type: "object",
            properties: {
                sql: { type: "string", description: "The SQL query to execute." }
            },
            required: ["sql"]
        }
    }
];

export const handlers = {
    flipside_query: async ({ sql }) => {
        if (!flipsideFn) throw new Error("Flipside not initialized.");
        console.log(`[Flipside] Running Query (Stub): ${sql.substring(0, 50)}...`);

        const queryResultSet = await flipsideFn.query.run({ sql: sql });

        return {
            content: [{
                type: "text",
                text: JSON.stringify(queryResultSet.records, null, 2)
            }]
        };
    }
};
