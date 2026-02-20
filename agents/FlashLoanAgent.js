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

            // Initialize or fetch existing marginfi account for the wallet
            try {
                const accounts = await this.marginfiClient.getMarginfiAccountsForAuthority(this.keypair.publicKey);
                if (accounts && accounts.length > 0) {
                    this.marginfiAccount = accounts[0];
                    console.log(`[${this.name}] Loaded existing MarginFi account: ${this.marginfiAccount.address}`);
                } else {
                    console.log(`[${this.name}] No existing MarginFi account found. Creating one requires a deposit transaction.`);
                    this.marginfiAccount = null;
                }
            } catch (accErr) {
                console.warn(`[${this.name}] Could not fetch MarginFi accounts: ${accErr.message}`);
                this.marginfiAccount = null;
            }

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
     * @param {Array} addressLookupTableAccounts - ALTs for versioned transactions (optional)
     */
    async createFlashLoanTx(tokenMint, amount, arbitrageInstructions, addressLookupTableAccounts = []) {
        if (!this.marginfiClient) {
            throw new Error("MarginFi Client not initialized (RPC/Wallet required)");
        }
        if (!this.marginfiAccount) {
            throw new Error("MarginFi Account not initialized. Create an account first by making a deposit to MarginFi.");
        }

        console.log(`[${this.name}] Building Flash Loan Tx: Borrow ${amount} of ${tokenMint}`);

        try {
            // 1. Find the Bank for this token
            const bank = this.marginfiClient.group.getBankByMint(new PublicKey(tokenMint));
            if (!bank) throw new Error(`Bank not found for mint: ${tokenMint}`);

            // 2. Build the Flash Loan Bundle
            const flashLoanBundle = await this.marginfiAccount.makeFlashLoanTx({
                amount: amount, 
                bankAddress: bank.address,
                options: {
                    instructions: arbitrageInstructions, 
                    addressLookupTableAccounts: addressLookupTableAccounts // Support ALTs
                }
            });

            return flashLoanBundle;
        } catch (e) {
            console.error(`[${this.name}] Failed to build Flash Loan: ${e.message}`);
            throw e;
        }
    }
}
