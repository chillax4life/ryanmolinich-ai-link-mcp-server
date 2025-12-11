use anchor_lang::prelude::*;

declare_id!("F1ashArbMangof1ashLoAnArBitRageDEXSwapRou7er");

#[program]
pub mod flash_arb {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        // TODO: Implement Mango flash loan callback
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
