/**
 * Agent Initializer — Bootstrap all agents and start heartbeat loop.
 *
 * Extracted from the monolithic index.js to keep agent initialization
 * logic separate from MCP server concerns.
 */

import { Keypair } from '@solana/web3.js';
import fs from 'fs';

import { PriceOracleAgent } from './PriceOracleAgent.js';
import { FlashLoanAgent } from './FlashLoanAgent.js';
import { FlashArbAgent } from './FlashArbAgent.js';
import { DriftAgent } from './DriftAgent.js';
import { JupiterAgent } from './JupiterAgent.js';
import { FlashTradeAgent } from './FlashTradeAgent.js';
import { MarketAnalyst } from './MarketAnalyst.js';
import { MasterAgent } from './MasterAgent.js';
import { IntegratorAgent } from './IntegratorAgent.js';
import { SwarmAgent } from './SwarmAgent.js';
import { RiskAgent } from './RiskAgent.js';
import { Context7Agent } from './Context7Agent.js';

/**
 * Initialize an agent with graceful failure.
 * Returns the agent on success, or null on failure.
 */
async function safeInit(agent, name, client, extraInit) {
    try {
        if (extraInit) {
            await extraInit(agent, client);
        } else {
            await agent.initialize(client);
        }
        return agent;
    } catch (e) {
        console.error(`[System] Failed to initialize ${name}: ${e.message}`);
        return null;
    }
}

/**
 * Bootstrap all agents and wire up dependencies.
 * 
 * @param {Object} internalClient - The InternalClient instance for MCP communication
 * @returns {Object} Map of initialized agents by key
 */
export async function initializeAllAgents(internalClient) {
    const results = await Promise.all([
        safeInit(new PriceOracleAgent({
            aiId: 'oracle-1',
            name: 'Oracle Eye',
            rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
            heliusApiKey: process.env.HELIUS_API_KEY
        }), 'PriceOracleAgent', internalClient),

        safeInit(new FlashLoanAgent({
            aiId: 'flash-1',
            name: 'Flash Financier',
        }), 'FlashLoanAgent', internalClient),

        safeInit(new FlashArbAgent({
            aiId: 'arb-1',
            name: 'Arb Strategist'
        }), 'FlashArbAgent', internalClient),

        safeInit(new DriftAgent({
            aiId: 'drift-1',
            name: 'Drift Bot',
            rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
            env: 'mainnet-beta'
        }), 'DriftAgent', internalClient),

        safeInit(new JupiterAgent({
            aiId: 'jup-1',
            name: 'Jupiter Aggillator',
            rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com'
        }), 'JupiterAgent', internalClient),

        safeInit(new MarketAnalyst({
            aiId: 'quant-1',
            name: 'Market Quant'
        }), 'MarketAnalyst', internalClient),

        safeInit(new MasterAgent({
            aiId: 'master-1',
            name: 'Master Brain',
            geminiApiKey: process.env.GEMINI_API_KEY
        }), 'MasterAgent', internalClient),

        // FlashTradeAgent requires extra wallet loading
        (async () => {
            const MAINNET_RPC = process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';
            let mainnetWallet = null;
            try {
                const walletPath = process.env.SOLANA_WALLET_PATH;
                if (walletPath && fs.existsSync(walletPath)) {
                    const secret = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')));
                    mainnetWallet = Keypair.fromSecretKey(secret);
                    console.log(`[Main] Loaded Wallet for Flash.Trade: ${mainnetWallet.publicKey.toBase58()}`);
                }
            } catch (e) { console.warn("Failed to load mainnet wallet:", e); }

            const agent = new FlashTradeAgent({
                aiId: 'flash-guardian',
                name: 'FlashGuardian',
                rpcUrl: MAINNET_RPC,
                wallet: mainnetWallet
            });
            return safeInit(agent, 'FlashTradeAgent', internalClient);
        })(),

        safeInit(new IntegratorAgent({
            aiId: 'integrator-1',
            name: 'Project Integrator'
        }), 'IntegratorAgent', internalClient),

        safeInit(new SwarmAgent({
            aiId: 'drone-1',
            name: 'Swarm Drone'
        }), 'SwarmAgent', internalClient),

        safeInit(new RiskAgent({
            aiId: 'sentinel-1',
            name: 'Risk Sentinel',
            dangerZoneThreshold: 5.0
        }), 'RiskAgent', internalClient),

        safeInit(new Context7Agent({
            aiId: 'context-1',
            name: 'Context Sage'
        }), 'Context7Agent', internalClient)
    ]);

    const [oracle, flash, arb, drift, jup, quant, master, flashAgent, integrator, drone, sentinel, contextAgent] = results;

    // Wire up agent dependencies
    if (arb && flash) {
        arb.financier = flash;
    }

    const agents = { oracle, flash, arb, drift, jup, quant, master, flashAgent, integrator, drone, sentinel, contextAgent };
    const activeAgents = Object.values(agents).filter(a => a !== null);
    console.error(`[System] ${activeAgents.length}/12 agents initialized successfully.`);

    return agents;
}

/**
 * Start the agent heartbeat loop.
 * Polls messages for all active agents every 2 seconds.
 */
export function startHeartbeat(agents) {
    const { master, integrator, drone, drift, oracle, flashAgent, flash, arb, sentinel, contextAgent } = agents;

    setInterval(async () => {
        try {
            await Promise.all([
                master?.checkMessages().catch(() => { }),
                integrator?.checkMessages().catch(() => { }),
                drone?.checkMessages().catch(() => { }),
                drift?.checkMessages().catch(() => { }),
                oracle?.checkMessages().catch(() => { }),
                flashAgent?.checkMessages().catch(() => { }),
                flash?.checkMessages().catch(() => { }),
                arb?.checkMessages().catch(() => { }),
                sentinel?.checkMessages().catch(() => { }),
                contextAgent?.checkMessages().catch(() => { }),
            ]);
        } catch (err) {
            console.error('[System] Heartbeat Error:', err);
        }
    }, 2000);
}
