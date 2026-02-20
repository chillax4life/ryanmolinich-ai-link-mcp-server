import { Connection, Keypair, PublicKey, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js';
import { AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { PerpetualsClient, PoolConfig, Privilege, Side } from 'flash-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, 'flash_state.json');

let flashClient = null;
let wallet = null;
let connection = null;
let provider = null;
let poolConfig = null;

// Safety Config
const COMPUTE_UNIT_LIMIT = 600_000;
const PRIORITY_FEE = 10000; // 0.01 SOL roughly

export async function initializeFlashExecutor(config = {}) {
    const rpcUrl = config.rpcUrl || process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const walletPath = config.walletPath || process.env.SOLANA_WALLET_PATH;

    connection = new Connection(rpcUrl, 'confirmed');

    if (walletPath && fs.existsSync(walletPath)) {
        try {
            const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')));
            wallet = new Wallet(Keypair.fromSecretKey(secretKey));
            
            // Set ANCHOR_WALLET env var for SDK internal use
            process.env.ANCHOR_WALLET = walletPath;
            
            console.log(`[FlashExecutor] Wallet loaded: ${wallet.publicKey.toBase58()}`);
        } catch (e) {
            console.error(`[FlashExecutor] Failed to load wallet: ${e.message}`);
            return { initialized: false, error: 'Wallet load failed' };
        }
    } else if (process.env.TRADING_MODE === 'paper') {
        console.warn('[FlashExecutor] No wallet found. Using DUMMY wallet for PAPER MODE.');
        wallet = new Wallet(Keypair.generate());
    } else {
        console.warn('[FlashExecutor] No wallet found. Read-only mode unavailable for Flash SDK (requires wallet).');
        return { initialized: false, error: 'Wallet required for Flash SDK' };
    }

    provider = new AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
        skipPreflight: true
    });

    try {
        // Load Crypto.1 Pool (Mainnet)
        poolConfig = PoolConfig.fromIdsByName('Crypto.1', 'mainnet-beta');
        
        flashClient = new PerpetualsClient(
            provider,
            poolConfig.programId,
            poolConfig.perpComposibilityProgramId,
            poolConfig.fbNftRewardProgramId,
            poolConfig.rewardDistributionProgram?.programId,
            { prioritizationFee: PRIORITY_FEE }
        );

        // CRITICAL: Load Address Lookup Tables for transaction optimization
        if (process.env.TRADING_MODE === 'live') {
            try {
                await flashClient.loadAddressLookupTable(poolConfig);
            } catch (e) {
                console.warn(`[FlashExecutor] Failed to load ALTs: ${e.message}`);
            }
        }

        console.log(`[FlashExecutor] Connected to Flash.trade (Crypto.1) [${process.env.TRADING_MODE || 'paper'} mode]`);
        return { initialized: true, mode: process.env.TRADING_MODE || 'paper', wallet: wallet.publicKey.toBase58() };
    } catch (e) {
        console.error(`[FlashExecutor] Failed to initialize SDK: ${e.message}`);
        return { initialized: false, error: e.message };
    }
}

// --- Helper: Fetch Backup Oracle Data (Required for all trades) ---
async function getBackupOracleInstruction(poolAddress) {
    try {
        const response = await fetch(`https://flash.trade/api/backup-oracle?poolAddress=${poolAddress}`);
        const backupOracleData = await response.json();
        
        return new TransactionInstruction({
            keys: backupOracleData.keys.map(k => ({ ...k, pubkey: new PublicKey(k.pubkey) })),
            programId: new PublicKey(backupOracleData.programId),
            data: Buffer.from(backupOracleData.data),
        });
    } catch (e) {
        throw new Error(`Failed to fetch backup oracle: ${e.message}`);
    }
}

// --- PERSISTENCE ---
function saveState(trade) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(trade, null, 2));
    } catch (e) {
        console.error('Failed to save flash state:', e.message);
    }
}

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
            // Revive BN objects if necessary, or just store params we need to rebuild
            return data;
        }
    } catch (e) {}
    return null;
}

function clearState() {
    try {
        if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
    } catch (e) {}
}

// --- READ OPERATIONS ---

export async function getFlashPositions() {
    if (!flashClient || !wallet) return { error: 'Not initialized' };

    try {
        // Fetch all active positions for user
        const positions = await flashClient.getUserPositions(wallet.publicKey, poolConfig);
        const results = [];

        for (const pos of positions) {
            const token = poolConfig.tokens.find(t => t.mintKey.equals(pos.tokenMint));
            const symbol = token ? token.symbol : 'UNKNOWN';
            
            // Get PnL and Metrics
            const metrics = await flashClient.getPositionMetrics(pos, poolConfig);
            
            results.push({
                symbol,
                side: pos.side.long ? 'LONG' : 'SHORT',
                sizeUsd: pos.sizeUsd.toNumber() / 1e6, // USDC decimals
                collateralUsd: pos.collateralUsd.toNumber() / 1e6,
                entryPrice: pos.entryPrice.toNumber() / 1e6,
                liquidationPrice: pos.liquidationPrice.toNumber() / 1e6,
                pnl: metrics.pnl.toNumber() / 1e6,
                pnlPercent: ((metrics.pnl.toNumber() / pos.collateralUsd.toNumber()) * 100).toFixed(2) + '%',
                leverage: pos.leverage.toNumber() / 1000 // BPS to float
            });
        }

        return { positions: results, count: results.length };
    } catch (e) {
        return { error: `Fetch positions failed: ${e.message}` };
    }
}

export async function getFlashPrice(symbol) {
    if (!flashClient) return { error: 'Not initialized' };
    return { message: "Use trading_analyze for price data. This tool is for execution state." };
}

// --- WRITE OPERATIONS (TRADING) ---

let pendingTrade = null;

export async function prepareOpenPosition(params) {
    const { symbol, side, sizeUsd, collateralUsd, leverage } = params;
    
    if (!flashClient) return { error: 'Not initialized' };

    try {
        const isLong = side.toLowerCase() === 'long';
        
        // 1. Get Token Config
        const targetToken = poolConfig.tokens.find(t => t.symbol === symbol.toUpperCase());
        if (!targetToken) return { error: `Token ${symbol} not found in pool` };
        
        // 2. Prepare Params
        const sizeBN = new BN(sizeUsd * 1e6); // USDC decimals
        const collateralBN = new BN(collateralUsd * 1e6);
        
        const trade = {
            id: `OPEN-${Date.now()}`,
            type: 'OPEN',
            symbol: symbol.toUpperCase(),
            side: isLong ? 'Long' : 'Short',
            sizeUsd,
            collateralUsd,
            leverage,
            status: 'PREPARED',
            expiresAt: Date.now() + 60000 // 1 min expiry
        };
        
        pendingTrade = { 
            ...trade, 
            params: { 
                targetTokenSymbol: targetToken.symbol, 
                isLong, 
                sizeUsd, // Store raw numbers, rebuild BN on execute
                collateralUsd 
            } 
        };
        saveState(pendingTrade);

        return {
            prepared: true,
            trade,
            confirmationRequired: "Reply 'EXECUTE FLASH' to confirm transaction."
        };
    } catch (e) {
        return { prepared: false, error: e.message };
    }
}

export async function executeOpenPosition(confirmCode) {
    if (!pendingTrade) pendingTrade = loadState();

    if (confirmCode !== 'EXECUTE FLASH') return { error: 'Invalid confirmation code' };
    if (!pendingTrade || pendingTrade.type !== 'OPEN') return { error: 'No pending OPEN trade' };
    if (Date.now() > pendingTrade.expiresAt) return { error: 'Trade expired' };

    // SAFETY CHECK
    if (process.env.TRADING_MODE !== 'live') {
        clearState();
        return { 
            executed: true, 
            status: 'SIMULATED', 
            message: `[PAPER MODE] Trade ${pendingTrade?.symbol} simulated successfully. Set TRADING_MODE=live to execute on mainnet.` 
        };
    }

    try {
        // Rebuild BNs from saved state
        const { targetTokenSymbol, isLong, sizeUsd, collateralUsd } = pendingTrade.params;
        const sizeBN = new BN(sizeUsd * 1e6);
        const collateralBN = new BN(collateralUsd * 1e6);
        const side = isLong ? Side.Long : Side.Short;

        const targetToken = poolConfig.tokens.find(t => t.symbol === targetTokenSymbol);
        if (!targetToken) return { error: `Token ${targetTokenSymbol} not found in pool config` };

        // 2. Build Instructions
        // Note: Using 0 as market price placeholder, Flash handles oracle internal
        const { instructions, additionalSigners } = await flashClient.openPosition(
            collateralBN,
            sizeBN,
            targetToken.symbol, 
            'USDC',             
            side,
            { price: new BN(0), exponent: -6 }, 
            poolConfig,
            Privilege.Standard
        );

        // 3. Add Backup Oracle & Compute Budget
        const backupOracleIx = await getBackupOracleInstruction(poolConfig.poolAddress.toBase58());
        const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT });

        const tx = [backupOracleIx, computeIx, ...instructions];

        // 4. Send Transaction
        const txId = await flashClient.sendTransaction(tx, { 
            additionalSigners, 
            alts: flashClient.poolAddressLookupTables.get(poolConfig.poolAddress.toBase58()) ? [flashClient.poolAddressLookupTables.get(poolConfig.poolAddress.toBase58())] : []
        });

        clearState();
        return { executed: true, txId, message: 'Position opened on Mainnet' };

    } catch (e) {
        return { executed: false, error: e.message };
    }
}

export async function prepareClosePosition(params) {
    const { symbol, sizePercent = 100 } = params;
    if (!flashClient) return { error: 'Not initialized' };

    try {
        // Find position
        const positions = await flashClient.getUserPositions(wallet.publicKey);
        const position = positions.find(p => {
            const t = poolConfig.tokens.find(token => token.mintKey.equals(p.tokenMint));
            return t && t.symbol === symbol.toUpperCase();
        });

        if (!position) return { error: `No open position found for ${symbol}` };

        const trade = {
            id: `CLOSE-${Date.now()}`,
            type: 'CLOSE',
            symbol: symbol.toUpperCase(),
            sizePercent,
            status: 'PREPARED'
        };

        pendingTrade = { 
            ...trade, 
            params: { 
                tokenMint: position.tokenMint.toBase58(), 
                side: position.side 
            } 
        };
        saveState(pendingTrade);

        return {
            prepared: true,
            trade,
            confirmationRequired: "Reply 'EXECUTE FLASH' to confirm CLOSING this position."
        };

    } catch (e) {
        return { error: e.message };
    }
}

export async function executeClosePosition(confirmCode) {
    if (!pendingTrade) pendingTrade = loadState();

    if (confirmCode !== 'EXECUTE FLASH') return { error: 'Invalid confirmation' };
    if (!pendingTrade || pendingTrade.type !== 'CLOSE') return { error: 'No pending CLOSE' };

    if (process.env.TRADING_MODE !== 'live') {
        const sym = pendingTrade.symbol;
        clearState();
        return { executed: true, status: 'SIMULATED', message: `[PAPER MODE] Position ${sym} closed.` };
    }

    try {
        const { tokenMint, side } = pendingTrade.params;
        const targetToken = poolConfig.tokens.find(t => t.mintKey.toBase58() === tokenMint);

        const { instructions, additionalSigners } = await flashClient.closePosition(
            targetToken.symbol,
            'USDC',
            { price: new BN(0), exponent: -6 }, // Market close
            side,
            poolConfig,
            Privilege.Standard
        );

        const backupOracleIx = await getBackupOracleInstruction(poolConfig.poolAddress.toBase58());
        const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT });

        const txId = await flashClient.sendTransaction([backupOracleIx, computeIx, ...instructions], {
            additionalSigners
        });

        clearState();
        return { executed: true, txId, message: 'Position closed' };

    } catch (e) {
        return { error: e.message };
    }
}

// --- TOOL MAPPING ---

export function getFlashExecutorTools() {
    return [
        {
            name: 'flash_init',
            description: 'Initialize Flash.trade mainnet connection',
            inputSchema: { type: 'object', properties: {} }
        },
        {
            name: 'flash_get_positions',
            description: 'Get all open Flash.trade positions with PnL',
            inputSchema: { type: 'object', properties: {} }
        },
        {
            name: 'flash_open_position',
            description: 'Prepare to open a new position',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    side: { type: 'string', enum: ['long', 'short'] },
                    sizeUsd: { type: 'number' },
                    collateralUsd: { type: 'number' },
                    leverage: { type: 'number' }
                },
                required: ['symbol', 'side', 'sizeUsd', 'leverage']
            }
        },
        {
            name: 'flash_close_position',
            description: 'Prepare to close a position',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string' },
                    sizePercent: { type: 'number', description: 'Default 100%' }
                },
                required: ['symbol']
            }
        },
        {
            name: 'flash_confirm_execute',
            description: 'Confirm execution of a prepared trade',
            inputSchema: {
                type: 'object',
                properties: {
                    code: { type: 'string', description: 'Must be "EXECUTE FLASH"' }
                },
                required: ['code']
            }
        }
    ];
}

export async function handleFlashExecutorTool(name, args) {
    // Ensure state is loaded for execution commands
    if (name === 'flash_confirm_execute' && !pendingTrade) {
        pendingTrade = loadState();
    }

    switch (name) {
        case 'flash_init': return initializeFlashExecutor();
        case 'flash_get_positions': return getFlashPositions();
        case 'flash_open_position': return prepareOpenPosition(args);
        case 'flash_close_position': return prepareClosePosition(args);
        case 'flash_confirm_execute': 
            if (pendingTrade?.type === 'OPEN') return executeOpenPosition(args.code);
            if (pendingTrade?.type === 'CLOSE') return executeClosePosition(args.code);
            return { error: 'No pending trade' };
        default: throw new Error(`Unknown tool ${name}`);
    }
}
