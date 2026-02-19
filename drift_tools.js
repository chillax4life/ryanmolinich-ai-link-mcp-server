import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { createRequire } from 'module';

let Wallet, DriftClient;
let driftEnabled = false;

try {
    const require = createRequire(import.meta.url);
    const sdk = require('@drift-labs/sdk');
    Wallet = sdk.Wallet;
    DriftClient = sdk.DriftClient;
    driftEnabled = true;
} catch (e) {
    console.warn("⚠️ Failed to load Drift SDK. Drift tools will be disabled. Error:", e.message);
}

const DRIFT_ENV = process.env.DRIFT_ENV || 'mainnet-beta';
const CONNECTION_URL = process.env.MAINNET_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(CONNECTION_URL);


/**
 * Helper to initialize a Read-Only Drift Client
 * We don't need a wallet for read-only operations, so we create a dummy one.
 */
async function getDriftClient() {
    // Dummy wallet for read-only access
    const wallet = new Wallet(new Keypair());

    // We can't really "initialize" a full DriftClient easily without a real wallet/provider 
    // in a serverless/stateless way efficiently for every call.
    // However, for pure data reading (markets), we can often just use the Connection/Program directly
    // or use the SDK in read-only mode if supported.

    // For now, let's focus on raw Account fetching or using the SDK's efficient loading if possible.
    // Initializing the full SDK might be heavy for a simple "get price" tool call.

    // Let's rely on constructing the client light-weight or just using the program ID.
    // Drift Devnet Program ID
    const DRIFT_PROGRAM_ID = new PublicKey('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH');

    // For this implementation, we will use the SDK to create a client
    const driftClient = new DriftClient({
        connection,
        wallet,
        env: DRIFT_ENV,
        accountSubscription: { type: 'polling', accountLoader: { type: 'cached', resamplingIntervalMs: 1000 } }
    });

    // We need to subscribe to fetch data
    // optimization: only subscribe to what we need? 
    // For now, let's subscribe to all allows for easiest "get everything"
    // But that is slow.

    return driftClient;
}

// Optimization: We'll just fetch specific accounts if possible without full subscription
// or manage a singleton if the server stays alive long.

export const driftTools = [
    {
        name: 'drift_get_market_summary',
        description: 'Get price and funding info for a Drift market (e.g. SOL-PERP)',
        inputSchema: {
            type: 'object',
            properties: {
                symbol: { type: 'string', description: 'Market symbol, e.g. "SOL-PERP"' }
            },
            required: ['symbol']
        }
    },
    {
        name: 'drift_get_user',
        description: 'Get user account details (collateral, leverage)',
        inputSchema: {
            type: 'object',
            properties: {
                userPublicKey: { type: 'string', description: 'The user account public key' }
            },
            required: ['userPublicKey']
        }
    }
];



let _cachedClient = null;

async function getOrInitDriftClient() {
    if (_cachedClient) return _cachedClient;

    const wallet = new Wallet(new Keypair());
    const client = new DriftClient({
        connection,
        wallet,
        env: DRIFT_ENV
    });

    await client.subscribe();
    _cachedClient = client;
    return client;
}

export async function handleDriftTool(name, args) {
    if (!driftEnabled) {
        return { content: [{ type: 'text', text: "Drift tools are currently disabled due to SDK loading error." }], isError: true };
    }

    try {
        const client = await getOrInitDriftClient();

        switch (name) {
            case 'drift_get_market_summary': {
                const symbol = args.symbol.toUpperCase();
                
                // Market index mapping (Drift standard indices)
                const MARKET_INDICES = {
                    'SOL-PERP': 0,
                    'BTC-PERP': 1,
                    'ETH-PERP': 2,
                    'DOGE-PERP': 3,
                    'SUI-PERP': 4,
                    'WIF-PERP': 5,
                    'BONK-PERP': 6,
                };
                
                const marketIndex = MARKET_INDICES[symbol];
                if (marketIndex === undefined) {
                    return { 
                        content: [{ 
                            type: 'text', 
                            text: `Unknown market: ${symbol}. Supported markets: ${Object.keys(MARKET_INDICES).join(', ')}` 
                        }] 
                    };
                }

                const price = client.getOracleDataForPerpMarket(marketIndex).price;

                return {
                    content: [{
                        type: 'text', text: JSON.stringify({
                            symbol: symbol,
                            price: price.toString(),
                            marketIndex: marketIndex
                        }, null, 2)
                    }]
                };
            }
            case 'drift_get_user': {
                // To fetch ANTOHER user, we need to manually fetch the account data
                // client.getProgram().account.user.fetch(pubkey)...
                const pubKey = new PublicKey(args.userPublicKey);
                const userAccount = await client.program.account.user.fetch(pubKey);

                return {
                    content: [{
                        type: 'text', text: JSON.stringify(userAccount, (key, value) =>
                            typeof value === 'bigint' ? value.toString() : value // Handle BigInt
                            , 2)
                    }]
                };
            }
            default:
                throw new Error(`Unknown Drift tool: ${name}`);
        }
    } catch (error) {
        return {
            content: [{ type: 'text', text: `Drift Error: ${error.message}` }],
            isError: true
        };
    }
}
