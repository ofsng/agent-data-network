//! Agent Data Network (ADN) — Devnet demo program.
//!
//! One fixed legacy SPL mint (6 decimals), fixed 2000 bps platform fee.
//! - Data assets are immutable versioned listings; providers may only toggle `active`.
//! - `purchase_unit` pays provider + treasury via TransferChecked CPI and writes an
//!   immutable receipt PDA. Clients put two of them (distinct providers) in ONE
//!   transaction; Solana transaction atomicity makes both succeed or both revert.
//! - Bounties lock a reward in a PDA-owned ATA vault; requester accepts a submission
//!   (80/20 split + bounty receipt) or refunds the full reward after the deadline.
//!
//! A receipt proves paid entitlement to a hash/version/license only. It does not
//! prove truth, ownership, delivery or consumption of the data.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

declare_id!("3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8");

pub mod constants {
    use super::*;

    #[constant]
    pub const CONFIG_SEED: &[u8] = b"config";
    #[constant]
    pub const ASSET_SEED: &[u8] = b"asset";
    #[constant]
    pub const RECEIPT_SEED: &[u8] = b"receipt";
    #[constant]
    pub const BOUNTY_SEED: &[u8] = b"bounty";
    #[constant]
    pub const SUBMISSION_SEED: &[u8] = b"submission";
    #[constant]
    pub const BOUNTY_RECEIPT_SEED: &[u8] = b"bounty_receipt";
    #[constant]
    pub const FEE_BPS: u16 = 2000;
    #[constant]
    pub const MINT_DECIMALS: u8 = 6;
    #[constant]
    pub const MAX_BOUNTY_DURATION_SECS: i64 = 7 * 24 * 60 * 60;

    pub const BPS_DENOMINATOR: u128 = 10_000;
    pub const KIND_PURCHASE: u8 = 0;
    pub const KIND_BOUNTY: u8 = 1;
    pub const BOUNTY_OPEN: u8 = 0;
    pub const BOUNTY_ACCEPTED: u8 = 1;
    pub const BOUNTY_REFUNDED: u8 = 2;
}

use constants::*;

#[error_code]
pub enum AdnError {
    #[msg("Signer is not the program upgrade authority")]
    UnauthorizedInitializer,
    #[msg("Unauthorized signer or account role")]
    Unauthorized,
    #[msg("Mint is not the configured 6-decimal legacy SPL mint")]
    InvalidMint,
    #[msg("Token account is not the canonical ATA for the expected owner and mint")]
    InvalidTokenAccount,
    #[msg("Signed expected terms do not match the on-chain asset")]
    InvalidTerms,
    #[msg("Asset is inactive")]
    InactiveAsset,
    #[msg("Price or reward must be greater than zero and leave a nonzero provider share")]
    InvalidPrice,
    #[msg("Quote has expired")]
    ExpiredQuote,
    #[msg("Receipt already exists")]
    DuplicateReceipt,
    #[msg("Insufficient token balance")]
    InsufficientFunds,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Deadline must be in the future and at most 7 days away")]
    InvalidDeadline,
    #[msg("Submission does not match this bounty, asset or provider")]
    InvalidSubmission,
    #[msg("Bounty is not open")]
    BountyNotOpen,
    #[msg("Bounty deadline has passed")]
    DeadlinePassed,
    #[msg("Bounty deadline has not been reached")]
    DeadlineNotReached,
    #[msg("Hash mismatch or zero hash")]
    HashMismatch,
    #[msg("Version must be >= 1")]
    InvalidVersion,
    #[msg("Account roles must not alias (buyer/provider/treasury/requester)")]
    AliasedAccounts,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DataAsset {
    pub provider: Pubkey,
    pub asset_id: [u8; 16],
    pub version: u32,
    pub content_hash: [u8; 32],
    pub license_hash: [u8; 32],
    pub price: u64,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PurchaseReceipt {
    pub buyer: Pubkey,
    pub provider: Pubkey,
    pub asset: Pubkey,
    pub mint: Pubkey,
    pub order_id: [u8; 16],
    pub version: u32,
    pub content_hash: [u8; 32],
    pub license_hash: [u8; 32],
    pub amount: u64,
    pub provider_amount: u64,
    pub platform_amount: u64,
    pub timestamp: i64,
    pub kind: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Bounty {
    pub requester: Pubkey,
    pub bounty_id: [u8; 16],
    pub requirement_hash: [u8; 32],
    pub reward: u64,
    pub deadline: i64,
    pub status: u8,
    pub winner_submission: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Submission {
    pub bounty: Pubkey,
    pub provider: Pubkey,
    pub asset: Pubkey,
    pub bump: u8,
}

fn nonzero(h: &[u8; 32]) -> bool {
    h.iter().any(|b| *b != 0)
}

/// Returns (provider_amount, platform_amount) with platform = floor(amount * fee_bps / 10000).
pub fn split_amount(amount: u64, fee_bps: u16) -> Result<(u64, u64)> {
    let platform = (amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(AdnError::ArithmeticOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(AdnError::ArithmeticOverflow)?;
    let platform = u64::try_from(platform).map_err(|_| AdnError::ArithmeticOverflow)?;
    let provider = amount
        .checked_sub(platform)
        .ok_or(AdnError::ArithmeticOverflow)?;
    require!(provider > 0, AdnError::InvalidPrice);
    Ok((provider, platform))
}

fn transfer_checked<'info>(
    token_program: &Program<'info, Token>,
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    mint: &Account<'info, Mint>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let accounts = TransferChecked {
        from,
        mint: mint.to_account_info(),
        to,
        authority,
    };
    let ctx = CpiContext::new(token_program.key(), accounts).with_signer(signer_seeds);
    token::transfer_checked(ctx, amount, mint.decimals)
}

#[program]
pub mod adn {
    use super::*;

    /// One-time config. Only the program's upgrade authority may call it; PDA init
    /// makes any repeat call fail.
    pub fn initialize_config(ctx: Context<InitializeConfig>, treasury: Pubkey) -> Result<()> {
        require!(ctx.accounts.mint.decimals == MINT_DECIMALS, AdnError::InvalidMint);
        require_keys_neq!(treasury, Pubkey::default(), AdnError::Unauthorized);
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.authority.key();
        config.mint = ctx.accounts.mint.key();
        config.treasury = treasury;
        config.fee_bps = FEE_BPS;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn register_data_asset(
        ctx: Context<RegisterDataAsset>,
        asset_id: [u8; 16],
        version: u32,
        content_hash: [u8; 32],
        license_hash: [u8; 32],
        price: u64,
        active: bool,
    ) -> Result<()> {
        require!(version >= 1, AdnError::InvalidVersion);
        require!(price > 0, AdnError::InvalidPrice);
        split_amount(price, ctx.accounts.config.fee_bps)?;
        require!(nonzero(&content_hash) && nonzero(&license_hash), AdnError::HashMismatch);
        require_keys_neq!(
            ctx.accounts.provider.key(),
            ctx.accounts.config.treasury,
            AdnError::AliasedAccounts
        );
        let asset = &mut ctx.accounts.asset;
        asset.provider = ctx.accounts.provider.key();
        asset.asset_id = asset_id;
        asset.version = version;
        asset.content_hash = content_hash;
        asset.license_hash = license_hash;
        asset.price = price;
        asset.active = active;
        asset.bump = ctx.bumps.asset;
        Ok(())
    }

    /// Provider-only toggle; no other field is writable after registration.
    pub fn set_asset_active(ctx: Context<SetAssetActive>, active: bool) -> Result<()> {
        ctx.accounts.asset.active = active;
        Ok(())
    }

    pub fn purchase_unit(
        ctx: Context<PurchaseUnit>,
        order_id: [u8; 16],
        expected_price: u64,
        expected_content_hash: [u8; 32],
        expected_license_hash: [u8; 32],
        expires_at: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let asset = &ctx.accounts.asset;
        let config = &ctx.accounts.config;
        let buyer = ctx.accounts.buyer.key();

        require!(now < expires_at, AdnError::ExpiredQuote);
        require!(asset.active, AdnError::InactiveAsset);
        require!(
            asset.price == expected_price
                && asset.content_hash == expected_content_hash
                && asset.license_hash == expected_license_hash,
            AdnError::InvalidTerms
        );
        require!(
            buyer != asset.provider && buyer != config.treasury && asset.provider != config.treasury,
            AdnError::AliasedAccounts
        );
        require!(
            ctx.accounts.buyer_token.amount >= asset.price,
            AdnError::InsufficientFunds
        );

        let (provider_amount, platform_amount) = split_amount(asset.price, config.fee_bps)?;

        let a = &ctx.accounts;
        transfer_checked(
            &a.token_program,
            a.buyer_token.to_account_info(),
            a.provider_token.to_account_info(),
            a.buyer.to_account_info(),
            &a.mint,
            provider_amount,
            &[],
        )?;
        transfer_checked(
            &a.token_program,
            a.buyer_token.to_account_info(),
            a.treasury_token.to_account_info(),
            a.buyer.to_account_info(),
            &a.mint,
            platform_amount,
            &[],
        )?;

        let receipt = &mut ctx.accounts.receipt;
        receipt.buyer = buyer;
        receipt.provider = asset.provider;
        receipt.asset = asset.key();
        receipt.mint = config.mint;
        receipt.order_id = order_id;
        receipt.version = asset.version;
        receipt.content_hash = asset.content_hash;
        receipt.license_hash = asset.license_hash;
        receipt.amount = asset.price;
        receipt.provider_amount = provider_amount;
        receipt.platform_amount = platform_amount;
        receipt.timestamp = now;
        receipt.kind = KIND_PURCHASE;
        receipt.bump = ctx.bumps.receipt;
        Ok(())
    }

    pub fn create_bounty(
        ctx: Context<CreateBounty>,
        bounty_id: [u8; 16],
        requirement_hash: [u8; 32],
        reward: u64,
        deadline: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(
            deadline > now && deadline - now <= MAX_BOUNTY_DURATION_SECS,
            AdnError::InvalidDeadline
        );
        require!(reward > 0, AdnError::InvalidPrice);
        split_amount(reward, ctx.accounts.config.fee_bps)?;
        require!(nonzero(&requirement_hash), AdnError::HashMismatch);
        require_keys_neq!(
            ctx.accounts.requester.key(),
            ctx.accounts.config.treasury,
            AdnError::AliasedAccounts
        );
        require!(
            ctx.accounts.requester_token.amount >= reward,
            AdnError::InsufficientFunds
        );

        let a = &ctx.accounts;
        transfer_checked(
            &a.token_program,
            a.requester_token.to_account_info(),
            a.vault.to_account_info(),
            a.requester.to_account_info(),
            &a.mint,
            reward,
            &[],
        )?;

        let bounty = &mut ctx.accounts.bounty;
        bounty.requester = ctx.accounts.requester.key();
        bounty.bounty_id = bounty_id;
        bounty.requirement_hash = requirement_hash;
        bounty.reward = reward;
        bounty.deadline = deadline;
        bounty.status = BOUNTY_OPEN;
        bounty.winner_submission = Pubkey::default();
        bounty.bump = ctx.bumps.bounty;
        Ok(())
    }

    /// Records a reference to an inactive asset; moves no tokens.
    pub fn submit_bounty_solution(ctx: Context<SubmitBountySolution>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let bounty = &ctx.accounts.bounty;
        let provider = ctx.accounts.provider.key();
        require!(bounty.status == BOUNTY_OPEN, AdnError::BountyNotOpen);
        require!(now < bounty.deadline, AdnError::DeadlinePassed);
        require!(!ctx.accounts.asset.active, AdnError::InvalidSubmission);
        require!(
            provider != bounty.requester && provider != ctx.accounts.config.treasury,
            AdnError::AliasedAccounts
        );
        let submission = &mut ctx.accounts.submission;
        submission.bounty = bounty.key();
        submission.provider = provider;
        submission.asset = ctx.accounts.asset.key();
        submission.bump = ctx.bumps.submission;
        Ok(())
    }

    pub fn accept_bounty_solution(
        ctx: Context<AcceptBountySolution>,
        expected_requirement_hash: [u8; 32],
        expected_content_hash: [u8; 32],
        expected_license_hash: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let bounty = &ctx.accounts.bounty;
        let asset = &ctx.accounts.asset;
        require!(bounty.status == BOUNTY_OPEN, AdnError::BountyNotOpen);
        require!(now < bounty.deadline, AdnError::DeadlinePassed);
        require!(
            bounty.requirement_hash == expected_requirement_hash
                && asset.content_hash == expected_content_hash
                && asset.license_hash == expected_license_hash,
            AdnError::HashMismatch
        );

        let reward = bounty.reward;
        let (provider_amount, platform_amount) = split_amount(reward, ctx.accounts.config.fee_bps)?;
        // Exactly `reward` leaves the vault; unsolicited surplus stays (no sweep).
        require!(ctx.accounts.vault.amount >= reward, AdnError::InsufficientFunds);

        let requester = bounty.requester;
        let bounty_id = bounty.bounty_id;
        let bump = [bounty.bump];
        let seeds: &[&[u8]] = &[BOUNTY_SEED, requester.as_ref(), bounty_id.as_ref(), &bump];
        let a = &ctx.accounts;
        transfer_checked(
            &a.token_program,
            a.vault.to_account_info(),
            a.provider_token.to_account_info(),
            a.bounty.to_account_info(),
            &a.mint,
            provider_amount,
            &[seeds],
        )?;
        transfer_checked(
            &a.token_program,
            a.vault.to_account_info(),
            a.treasury_token.to_account_info(),
            a.bounty.to_account_info(),
            &a.mint,
            platform_amount,
            &[seeds],
        )?;

        let receipt = &mut ctx.accounts.bounty_receipt;
        receipt.buyer = requester;
        receipt.provider = asset.provider;
        receipt.asset = asset.key();
        receipt.mint = ctx.accounts.config.mint;
        receipt.order_id = bounty_id;
        receipt.version = asset.version;
        receipt.content_hash = asset.content_hash;
        receipt.license_hash = asset.license_hash;
        receipt.amount = reward;
        receipt.provider_amount = provider_amount;
        receipt.platform_amount = platform_amount;
        receipt.timestamp = now;
        receipt.kind = KIND_BOUNTY;
        receipt.bump = ctx.bumps.bounty_receipt;

        let bounty = &mut ctx.accounts.bounty;
        bounty.status = BOUNTY_ACCEPTED;
        bounty.winner_submission = ctx.accounts.submission.key();
        Ok(())
    }

    /// Full reward back to the requester after the deadline; no fee, no receipt.
    pub fn refund_expired_bounty(ctx: Context<RefundExpiredBounty>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let bounty = &ctx.accounts.bounty;
        require!(bounty.status == BOUNTY_OPEN, AdnError::BountyNotOpen);
        require!(now >= bounty.deadline, AdnError::DeadlineNotReached);
        let reward = bounty.reward;
        require!(ctx.accounts.vault.amount >= reward, AdnError::InsufficientFunds);

        let requester = bounty.requester;
        let bounty_id = bounty.bounty_id;
        let bump = [bounty.bump];
        let seeds: &[&[u8]] = &[BOUNTY_SEED, requester.as_ref(), bounty_id.as_ref(), &bump];
        let a = &ctx.accounts;
        transfer_checked(
            &a.token_program,
            a.vault.to_account_info(),
            a.requester_token.to_account_info(),
            a.bounty.to_account_info(),
            &a.mint,
            reward,
            &[seeds],
        )?;
        ctx.accounts.bounty.status = BOUNTY_REFUNDED;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    pub mint: Account<'info, Mint>,
    #[account(
        constraint = program.programdata_address()? == Some(program_data.key())
            @ AdnError::UnauthorizedInitializer
    )]
    pub program: Program<'info, crate::program::Adn>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(authority.key())
            @ AdnError::UnauthorizedInitializer
    )]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(asset_id: [u8; 16], version: u32)]
pub struct RegisterDataAsset<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = provider,
        space = 8 + DataAsset::INIT_SPACE,
        seeds = [ASSET_SEED, provider.key().as_ref(), asset_id.as_ref(), &version.to_le_bytes()],
        bump
    )]
    pub asset: Account<'info, DataAsset>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAssetActive<'info> {
    pub provider: Signer<'info>,
    #[account(
        mut,
        has_one = provider @ AdnError::Unauthorized,
        seeds = [ASSET_SEED, asset.provider.as_ref(), asset.asset_id.as_ref(), &asset.version.to_le_bytes()],
        bump = asset.bump
    )]
    pub asset: Account<'info, DataAsset>,
}

#[derive(Accounts)]
#[instruction(order_id: [u8; 16])]
pub struct PurchaseUnit<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        seeds = [ASSET_SEED, asset.provider.as_ref(), asset.asset_id.as_ref(), &asset.version.to_le_bytes()],
        bump = asset.bump
    )]
    pub asset: Account<'info, DataAsset>,
    #[account(
        init,
        payer = buyer,
        space = 8 + PurchaseReceipt::INIT_SPACE,
        seeds = [RECEIPT_SEED, buyer.key().as_ref(), order_id.as_ref(), asset.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, PurchaseReceipt>,
    #[account(address = config.mint @ AdnError::InvalidMint)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = buyer,
        associated_token::token_program = token_program,
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = asset.provider,
        associated_token::token_program = token_program,
    )]
    pub provider_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = config.treasury,
        associated_token::token_program = token_program,
    )]
    pub treasury_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(bounty_id: [u8; 16])]
pub struct CreateBounty<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = requester,
        space = 8 + Bounty::INIT_SPACE,
        seeds = [BOUNTY_SEED, requester.key().as_ref(), bounty_id.as_ref()],
        bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(address = config.mint @ AdnError::InvalidMint)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = requester,
        associated_token::token_program = token_program,
    )]
    pub requester_token: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = requester,
        associated_token::mint = mint,
        associated_token::authority = bounty,
        associated_token::token_program = token_program,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitBountySolution<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        seeds = [BOUNTY_SEED, bounty.requester.as_ref(), bounty.bounty_id.as_ref()],
        bump = bounty.bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        has_one = provider @ AdnError::Unauthorized,
        seeds = [ASSET_SEED, asset.provider.as_ref(), asset.asset_id.as_ref(), &asset.version.to_le_bytes()],
        bump = asset.bump
    )]
    pub asset: Account<'info, DataAsset>,
    #[account(
        init,
        payer = provider,
        space = 8 + Submission::INIT_SPACE,
        seeds = [SUBMISSION_SEED, bounty.key().as_ref(), provider.key().as_ref(), asset.key().as_ref()],
        bump
    )]
    pub submission: Account<'info, Submission>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptBountySolution<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        has_one = requester @ AdnError::Unauthorized,
        seeds = [BOUNTY_SEED, bounty.requester.as_ref(), bounty.bounty_id.as_ref()],
        bump = bounty.bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        seeds = [SUBMISSION_SEED, bounty.key().as_ref(), submission.provider.as_ref(), submission.asset.as_ref()],
        bump = submission.bump,
        constraint = submission.bounty == bounty.key() @ AdnError::InvalidSubmission,
        constraint = submission.asset == asset.key() @ AdnError::InvalidSubmission,
        constraint = submission.provider == asset.provider @ AdnError::InvalidSubmission,
    )]
    pub submission: Account<'info, Submission>,
    #[account(
        seeds = [ASSET_SEED, asset.provider.as_ref(), asset.asset_id.as_ref(), &asset.version.to_le_bytes()],
        bump = asset.bump
    )]
    pub asset: Account<'info, DataAsset>,
    #[account(address = config.mint @ AdnError::InvalidMint)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bounty,
        associated_token::token_program = token_program,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = asset.provider,
        associated_token::token_program = token_program,
    )]
    pub provider_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = config.treasury,
        associated_token::token_program = token_program,
    )]
    pub treasury_token: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = requester,
        space = 8 + PurchaseReceipt::INIT_SPACE,
        seeds = [BOUNTY_RECEIPT_SEED, bounty.key().as_ref(), asset.key().as_ref()],
        bump
    )]
    pub bounty_receipt: Account<'info, PurchaseReceipt>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundExpiredBounty<'info> {
    pub requester: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        has_one = requester @ AdnError::Unauthorized,
        seeds = [BOUNTY_SEED, bounty.requester.as_ref(), bounty.bounty_id.as_ref()],
        bump = bounty.bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(address = config.mint @ AdnError::InvalidMint)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bounty,
        associated_token::token_program = token_program,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = requester,
        associated_token::token_program = token_program,
    )]
    pub requester_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_examples() {
        assert_eq!(split_amount(30_000, 2000).unwrap(), (24_000, 6_000));
        assert_eq!(split_amount(2_000_000, 2000).unwrap(), (1_600_000, 400_000));
        assert_eq!(split_amount(30_001, 2000).unwrap(), (24_001, 6_000));
        assert_eq!(split_amount(1, 2000).unwrap(), (1, 0));
        assert_eq!(split_amount(4, 2000).unwrap(), (4, 0));
        assert_eq!(split_amount(5, 2000).unwrap(), (4, 1));
        let (p, f) = split_amount(u64::MAX, 2000).unwrap();
        assert_eq!(p as u128 + f as u128, u64::MAX as u128);
    }

    #[test]
    fn receipt_size_is_254_with_discriminator() {
        assert_eq!(8 + PurchaseReceipt::INIT_SPACE, 254);
    }
}
