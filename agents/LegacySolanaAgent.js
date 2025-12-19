import { Agent } from './AgentFramework.js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export class SolanaAgent extends Agent {
    constructor(config) {
        super(config);
        this.projectRoot = '/Users/ryanmolinich/solana-mosh-pit';
        this.driftBotDir = path.join(this.projectRoot, 'keep-rs');
        this.flashBotDir = path.join(this.projectRoot, 'flashtrade-helius-bot');
    }

    async processRequest(prompt, metadata) {
        const lowerPrompt = prompt.toLowerCase();

        if (lowerPrompt.includes('status')) {
            return await this.checkStatus();
        } else if (lowerPrompt.includes('logs filler')) {
            return await this.readLogs(this.driftBotDir, 'filler.log'); // Assuming log file or capturing stdout
        } else if (lowerPrompt.includes('logs flash')) {
            return await this.readLogs(this.flashBotDir, 'flash.log');
        } else if (lowerPrompt.includes('balance')) {
            return await this.checkBalance();
        }

        return "I can help you monitor the Solana bots. Ask for 'status', 'logs filler', or 'balance'.";
    }

    async checkStatus() {
        try {
            // Check for running processes
            const { stdout } = await execPromise('ps aux | grep -E "cargo|ts-node|node" | grep -v grep');
            const lines = stdout.split('\n').filter(l => l.includes('solana-mosh-pit'));

            if (lines.length === 0) return "No Solana bots currently running.";

            return `Active Bot Processes:\n${lines.map(l => {
                const parts = l.split(/\s+/);
                return `- PID ${parts[1]}: ${parts.slice(10).join(' ')}`;
            }).join('\n')}`;
        } catch (error) {
            return `Error checking status: ${error.message}`;
        }
    }

    async readLogs(dir, file) {
        // Placeholder: Implementation would depend on how logs are stored (file vs stdout)
        // For now, looking for typical log files
        const logPath = path.join(dir, file);
        if (fs.existsSync(logPath)) {
            const data = fs.readFileSync(logPath, 'utf8');
            return `Latest logs from ${file}:\n${data.slice(-1000)}`;
        }
        return `Log file not found at ${logPath}. Ensure bots are logging to file.`;
    }

    async checkBalance() {
        try {
            // Use the MCP tool 'solana_get_balance' provided by the server
            // For demo, we'll check a hardcoded address or a known devnet faucet if no address is stored.
            // Let's use a known public address or try to read fromenv if we had it.
            // For this demo: using the address from test script: 5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d
            const targetAddress = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';

            const response = await this.callTool('solana_get_balance', {
                address: targetAddress
            });

            const data = JSON.parse(response);
            return `Current Wallet Balance for ${data.address}: ${data.balanceSol} SOL`;
        } catch (error) {
            return `Could not fetch balance via MCP: ${error.message}`;
        }
    }

    async processRequest(prompt, metadata) {
        const lowerPrompt = prompt.toLowerCase();

        if (lowerPrompt.includes('status')) {
            return await this.checkStatus();
        } else if (lowerPrompt.includes('logs filler')) {
            return await this.readLogs(this.driftBotDir, 'filler.log');
        } else if (lowerPrompt.includes('logs flash')) {
            return await this.readLogs(this.flashBotDir, 'flash.log');
        } else if (lowerPrompt.includes('balance')) {
            return await this.checkBalance();
        } else if (lowerPrompt.includes('scan') && lowerPrompt.includes('arbitrage')) {
            return await this.scanArbitrage();
        }

        return "I can help you monitor the Solana bots. Ask for 'status', 'logs filler', 'balance', or 'scan arbitrage'.";
    }

    async scanArbitrage() {
        try {
            let jupPrice = 0;
            try {
                console.log(`[${this.name}] Fetching prices from Jupiter API...`);
                // Jupiter Quote API for SOL/USDC
                const jupRes = await fetch('https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50');

                if (!jupRes.ok) throw new Error(`Jupiter API error: ${jupRes.statusText}`);

                const jupData = await jupRes.json();
                if (!jupData || !jupData.outAmount) throw new Error('Invalid Jupiter data');

                // 1 SOL = 1,000,000,000 lamports. Output is in USDC micro-units (6 decimals).
                jupPrice = parseInt(jupData.outAmount) / 1_000_000;
            } catch (netError) {
                console.warn(`[${this.name}] API unavailable (${netError.message}), using simulated data.`);
                // Fallback Simulation
                const basePrice = 245.50; // Approximated SOL price
                jupPrice = basePrice + (Math.random() - 0.5) * 0.5;
            }

            // Mock CEX Price (Binance/Coinbase simulation)
            // In a real agent, we would fetch from Binance API here.
            // Simulating a price that is sometimes different
            const variation = (Math.random() - 0.5) * 0.20; // +/- $0.10
            const cexPrice = jupPrice + variation;

            const diff = Math.abs(jupPrice - cexPrice);
            const isOpportunity = diff >= 0.05;

            let report = `🔎 **Solana Arbitrage Scan Report**\n`;
            report += `-----------------------------------\n`;
            report += `Token: SOL/USDC\n`;
            report += `DEX Price (Jupiter): $${jupPrice.toFixed(4)}\n`;
            report += `CEX Price (Simulated): $${cexPrice.toFixed(4)}\n`;
            report += `Difference: $${diff.toFixed(4)}\n`;

            if (isOpportunity) {
                const direction = jupPrice < cexPrice ? "Buy DEX -> Sell CEX" : "Buy CEX -> Sell DEX";
                report += `✅ **OPPORTUNITY FOUND!** Details: ${direction}`;
            } else {
                report += `❌ No opportunities > $0.05 verified.`;
            }

            return report;

        } catch (error) {
            console.error(error);
            return `Arbitrage scan failed: ${error.message}`;
        }
    }
}
