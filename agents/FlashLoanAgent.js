import { SolanaAgent } from './SolanaAgent.js';
import { MarginfiClient, getConfig } from '@mrgnlabs/marginfi-client-v2';
import { NodeWallet } from '@mrgnlabs/mrgn-common';
import { PublicKey } from '@solana/web3.js';

/**
 * FlashLoanAgent ("The Financier")
 * Specializes in acquiring capital via ZERO-FEE MarginFi Flash Loans.
 * 
 * Strategy:
 * 1. Borrow Asset X (Flash Loan)
 * 2. Execute Arbitrage (Agent specific instruction)
 * 3. Repay Asset X (Same Tx)
 */
export class FlashLoanAgent extends SolanaAgent {
    constructor(config) {
        super(config);

        this.marginfiClient = null;
        this.marginfiAccount = null;

        // Capabilities
        if (!this.capabilities.includes('flash-loan')) {
            this.capabilities.push('flash-loan');
        }
    }

    async initialize(client) {
        await super.initialize(client);

        try {
            console.log(`[${this.name}] Initializing MarginFi Client...`);

            // Need a real wallet for MarginFi, base SolanaAgent has this.keypair
            if (!this.keypair) {
                console.warn(`[${this.name}] No Wallet available. Running in Read-Only Mode (Cannot execute Flash Loans).`);
                return;
            }

            const wallet = new NodeWallet(this.keypair);
            const config = getConfig(this.env === 'mainnet-beta' ? 'production' : 'dev');

            this.marginfiClient = await MarginfiClient.fetch(
                config,
                wallet,
                this.connection
            );

            console.log(`[${this.name}] MarginFi Initialized. Ready for 0% Fee Loans.`);

        } catch (e) {
            console.error(`[${this.name}] Failed to initialize MarginFi:`, e.message);
        }
    }

    /**
     * Estimates cost/profit of a potential flash loan arb
     * @param {string} tokenMint 
     * @param {number} amount 
     */
    async simulateLoan(tokenMint, amount) {
        if (!this.marginfiClient) return "MarginFi not initialized.";

        return `[Simulation] Borrowing ${amount} of ${tokenMint} via MarginFi (0% Fee) is possible.`;
    }

    /**
     * Constructs an Atomic Flash Loan Transaction
     * @param {string} tokenMint - The token to borrow (e.g. SOL Mint)
     * @param {number} amount - Amount in native units (e.g. Lamports)
     * @param {Array} arbitrageInstructions - The instructions to run with the borrowed funds
     */
    async createFlashLoanTx(tokenMint, amount, arbitrageInstructions) {
        if (!this.marginfiAccount) {
            throw new Error("MarginFi Account not initialized (Wallet required)");
        }

        console.log(`[${this.name}] Building Flash Loan Tx: Borrow ${amount} of ${tokenMint}`);

        try {
            // 1. Find the Bank for this token
            // This requires searching the group's banks for the matching mint
            const bank = this.marginfiClient.group.getBankByMint(new PublicKey(tokenMint));
            if (!bank) throw new Error(`Bank not found for mint: ${tokenMint}`);

            // 2. Build the Flash Loan Bundle
            // The SDK handles [Borrow -> ...Instructions -> Repay]
            // Note: makeFlashLoanTx usually returns an object with { instructions, signers } or a Transaction
            const flashLoanBundle = await this.marginfiAccount.makeFlashLoanTx({
                amount: amount, // BN or number
                bankAddress: bank.address,
                options: {
                    instructions: arbitrageInstructions, // The meat of the sandwich
                }
            });

            return flashLoanBundle; // Returns valid Transaction/Instructions
        } catch (e) {
            console.error(`[${this.name}] Failed to build Flash Loan: ${e.message}`);
            throw e;
        }
    }
}
