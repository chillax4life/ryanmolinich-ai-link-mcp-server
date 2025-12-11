# Flash Arbitrage System

Multi-bot flash loan arbitrage system for Solana with recursive learning capabilities.

## Architecture

- **Scanner Bot**: High-frequency price discovery across Raydium, Orca, Meteora
- **First Wave Executors**: $100K-$3M flash loans via Mango Markets (0% fee)
- **Second Wave Capitalizers**: Profits from price impact of first wave
- **Swap Router**: Custom A* pathfinding algorithm for optimal DEX routing
- **ML Optimizer**: Kelly Criterion + momentum signals for strategy optimization

## Quick Start

### 1. Setup Environment

```bash
cp .env.example .env
# Edit .env with your Helius API keys and wallet key
```

### 2. Build (Rust components)

```bash
cargo build --release
```

### 3. Run Scanner Bot (Devnet)

```bash
cd scanner-bot
cargo run --release
```

### 4. Deploy Flash Loan Executor

```bash
cd flash-loan-executor
anchor build
anchor deploy --provider.cluster devnet
```

## Components

- `rpc-manager/` - Multi-RPC load balancing with rate limits
- `price-fetcher/` - Direct DEX on-chain price reads
- `scanner-bot/` - Opportunity detection bot
- `swap-router/` - Custom routing algorithm (no Jupiter)
- `flash-loan-executor/` - Anchor program for flash loan arbitrage
- `second-wave-bot/` - Micro-arb capitalizer
- `ml-optimizer/` - Recursive learning system

## Safety

⚠️ **This system executes real financial transactions. Always test on devnet first.**

- Start with small loan amounts ($100K max)
- Monitor logs carefully for errors
- Use throw-away wallets on devnet
- Never commit `.env` files with real keys

## License

Proprietary - All Rights Reserved
