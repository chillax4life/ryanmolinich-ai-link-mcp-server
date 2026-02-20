import { Agent } from './AgentFramework.js';
import { PublicKey } from '@solana/web3.js';

/**
 * FlashArbAgent ("The Strategist")
 * Orchestrates the Atomic Flash Loan Arbitrage Strategy.
 */
export class FlashArbAgent extends Agent {
    constructor(config) {
        super({ ...config, name: 'FlashStrategist', capabilities: ['arbitrage', 'atomic-execution'] });
        this.jupiterAgent = config.jupiterAgent;
        this.flashLoanAgent = config.flashLoanAgent;
        this.oracleAgent = config.oracleAgent;
    }

    async initialize(client) {
        await super.initialize(client);
        console.log(`[${this.name}] Atomic Strategist Initialized.`);
    }

    /**
     * Executes a full atomic flash loan arbitrage:
     * 1. Borrow Asset A (MarginFi)
     * 2. Swap A -> B (Jupiter)
     * 3. Swap B -> A (Jupiter)
     * 4. Repay Asset A (MarginFi)
     */
    async executeAtomicArb(params) {
        const { borrowMint, targetMint, amount } = params;
        
        console.log(`[${this.name}] 🚀 Initiating Atomic Arb: Borrow ${amount} of ${borrowMint} -> Swap to ${targetMint} -> Back to ${borrowMint}`);

        try {
            // Leg 1: A -> B
            const quote1 = await this.jupiterAgent.getQuote(borrowMint, targetMint, amount);
            if (!quote1) throw new Error("Failed to get Leg 1 quote");
            
            const ix1 = await this.jupiterAgent.getSwapInstructions(quote1);

            // Leg 2: B -> A
            // We use the outAmount from Leg 1 as input for Leg 2
            const quote2 = await this.jupiterAgent.getQuote(targetMint, borrowMint, quote1.outAmount);
            if (!quote2) throw new Error("Failed to get Leg 2 quote");

            const ix2 = await this.jupiterAgent.getSwapInstructions(quote2);

            // Profit Check
            const finalAmount = parseInt(quote2.outAmount);
            if (finalAmount <= amount) {
                return { success: false, reason: `No profit detected. Expected out: ${finalAmount}, In: ${amount}` };
            }

            console.log(`[${this.name}] 💰 Potential Profit: ${finalAmount - amount} native units`);

            // Combine instructions from both swaps
            // Jupiter returns: computeBudget, setup, swap, cleanup
            const combinedInstructions = [
                ...ix1.computeBudgetInstructions,
                ...ix1.setupInstructions,
                ix1.swapInstruction,
                ...ix1.cleanupInstruction ? [ix1.cleanupInstruction] : [],
                ...ix2.setupInstructions,
                ix2.swapInstruction,
                ...ix2.cleanupInstruction ? [ix2.cleanupInstruction] : []
            ];

            // Combine ALTs
            const combinedALTs = [
                ...ix1.addressLookupTableAddresses,
                ...ix2.addressLookupTableAddresses
            ];

            // Trigger Flash Loan Bundle
            const flashLoanTx = await this.flashLoanAgent.createFlashLoanTx(
                borrowMint,
                amount,
                combinedInstructions,
                combinedALTs
            );

            return {
                success: true,
                profit: finalAmount - amount,
                tx: flashLoanTx,
                message: `Atomic Arb Transaction Built. Profit: ${finalAmount - amount} units.`
            };

        } catch (e) {
            console.error(`[${this.name}] Atomic Arb Failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    async processRequest(prompt) {
        if (prompt.toLowerCase().includes('run strategy') || prompt.toLowerCase().includes('scan')) {
            const result = await this.scanArbitrage();
            return {
                content: [{ type: 'text', text: result }]
            };
        }
        return super.processRequest(prompt);
    }
}
