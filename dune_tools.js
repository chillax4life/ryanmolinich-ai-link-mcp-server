import fetch from 'node-fetch';

const DUNE_API_KEY = process.env.DUNE_API_KEY;

export const duneTools = [
    {
        name: 'dune_execute_query',
        description: 'Execute a new query on Dune Analytics',
        inputSchema: {
            type: 'object',
            properties: {
                queryId: { type: 'number', description: 'The ID of the query to execute' },
                query_parameters: { type: 'object', description: 'Key-value pairs for query parameters' }
            },
            required: ['queryId']
        }
    },
    {
        name: 'dune_get_latest_result',
        description: 'Get the latest results for a query ID (cached)',
        inputSchema: {
            type: 'object',
            properties: {
                queryId: { type: 'number', description: 'The ID of the query to fetch results for' }
            },
            required: ['queryId']
        }
    }
];

export async function handleDuneTool(name, args) {
    switch (name) {
        case 'dune_execute_query':
            return await executeQuery(args.queryId, args.query_parameters);
        case 'dune_get_latest_result':
            return await getLatestResult(args.queryId);
        default:
            throw new Error(`Unknown Dune tool: ${name}`);
    }
}

async function executeQuery(queryId, params = {}) {
    console.log(`[Dune] Executing Query ${queryId}...`);

    // In strict API terms, we might need to POST to /v1/query/{queryId}/execute
    // But for simple "get data", simpler is often checking latest result. 
    // If the user wants to *trigger* a run, we do this:

    const url = `https://api.dune.com/api/v1/query/${queryId}/execute`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'X-Dune-Api-Key': DUNE_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query_parameters: params })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Dune API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
}

async function getLatestResult(queryId) {
    console.log(`[Dune] Fetching results for Query ${queryId}...`);

    // Limits applied: 1000 rows max for this MCP tool to avoid context overflow
    const url = `https://api.dune.com/api/v1/query/${queryId}/results?limit=1000`;

    const response = await fetch(url, {
        headers: {
            'X-Dune-Api-Key': DUNE_API_KEY
        }
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Dune API Error (${response.status}): ${err}`);
    }

    const data = await response.json();

    // Basic summarization if too large? 
    // For now returning raw rows found in 'result.rows'
    const rows = data.result?.rows || [];
    const summary = {
        queryId,
        rowCount: rows.length,
        submitted_at: data.submitted_at,
        execution_ended_at: data.execution_ended_at,
        rows: rows
    };

    return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
    };
}
