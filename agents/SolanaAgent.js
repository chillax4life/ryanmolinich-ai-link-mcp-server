import { Agent } from './AgentFramework.js';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

/**
 * SolanaAgent (Bone Glass)
 * Base class for all Solana-capable agents.
 * Handles Wallet (Keypair) and RPC Connection.
 */
export class SolanaAgent extends Agent {
    constructor(config) {
        super(config);

        // Solana Config
        this.rpcUrl = config.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        this.connection = new Connection(this.rpcUrl, 'confirmed');

        this.walletPath = config.walletPath || process.env.SOLANA_WALLET_PATH;
        this.keypair = null;
    }

    async initialize(client) {
        // 1. Initialize Base Agent (Register with MCP)
        await super.initialize(client);

        // 2. Load Solana Wallet
        this.loadKeypair();

        // 3. Verify Connection
        try {
            const version = await this.connection.getVersion();
            console.log(`[${this.name}] Connected to Solana RPC: ${this.rpcUrl} (v${version['solana-core']})`);
        } catch (error) {
            console.error(`[${this.name}] Failed to connect to RPC: ${error.message}`);
        }
    }

    loadKeypair() {
        try {
            if (this.walletPath && fs.existsSync(this.walletPath)) {
                // Load from file (JSON array)
                const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(this.walletPath, 'utf-8')));
                this.keypair = Keypair.fromSecretKey(secretKey);
                console.log(`[${this.name}] Loaded Wallet from file: ${this.keypair.publicKey.toBase58()}`);
            } else if (process.env.SOLANA_PRIVATE_KEY) {
                // Load from Env (Base58 string)
                // Need bs58 decode validation? Assume JSON array for simplicity or implement decoding
                // For now, let's assume JSON array in env or investigate helpers
                // Typically env vars are base58 strings. 
                // Let's defer to file for now as primary.
                console.warn(`[${this.name}] Env loading not fully implemented, strictly using file path if provided.`);
            } else {
                console.warn(`[${this.name}] No wallet provided. Running in Read-Only mode.`);
            }
        } catch (error) {
            console.error(`[${this.name}] Error loading keypair: ${error.message}`);
        }
    }

    /**
     * Helper: Get Balance
     */
    async getBalance(publicKey = null) {
        try {
            const pubkey = publicKey ? new PublicKey(publicKey) : (this.keypair ? this.keypair.publicKey : null);
            if (!pubkey) throw new Error("No public key to check balance for.");

            const balance = await this.connection.getBalance(pubkey);
            return balance / 1_000_000_000; // SOL
        } catch (error) {
            console.error(`[${this.name}] Balance check failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Override processRequest to handle basic Solana commands
     */
    async processRequest(prompt, metadata) {
        const lower = prompt.toLowerCase();

        if (lower.includes('balance') || lower.includes('funds')) {
            // Try to find a public key in the prompt (simple regex for base58-like string, ~32-44 chars)
            const match = prompt.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
            const targetKey = match ? match[0] : null;

            try {
                const bal = await this.getBalance(targetKey);
                return `Balance for ${targetKey || 'Me'}: ${bal.toFixed(4)} SOL`;
            } catch (e) {
                return `Could not fetch balance. If I am read-only, you must provide an address. Error: ${e.message}`;
            }
        }

        return "I am a Base Solana Agent. I can check 'balance', but my children do the real work.";
    }
}
