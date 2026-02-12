# RobinBot

AI-powered crypto trading platform built as a Telegram Mini App on Base. Browse bonding curve tokens with real-time risk analysis, execute trades with multi-level limit orders, auto-invest through strategy portfolios, and launch your own token — all without leaving Telegram.

## Architecture

```
Next.js 16 (Pages Router)
├── Telegram Mini App (frontend)
├── Telegraf Bot (webhook)
├── Goldsky Subgraph (on-chain data)
├── OpenAI GPT-4o-mini (risk analysis)
└── Solidity Contracts (Hardhat)
```

## Features

### Token Scanner
Browse all bonding curve tokens with live data from the Goldsky subgraph. Each token is scored 0–100 on a composite risk model evaluating volume, trade count, token age, graduation status, and activity recency. Tap any token for a detailed AI-generated risk report powered by GPT-4o-mini.

### Trading
Submit trades directly from Telegram. The trading interface supports multi-level limit orders with entry, take-profit, and stop-loss triggers that execute automatically when price targets are reached. Orders are tracked in your portfolio with real-time status updates.

### Strategy Portfolios
Auto-invest across top bonding curve tokens using risk-tiered portfolios:
- **Conservative** — 8-12% APR, low risk
- **Balanced** — 15-25% APR, medium risk
- **Aggressive** — 30-60% APR, high risk

Allocations are computed dynamically based on live token metrics. Rebalancing is automatic.

### Token Launch
Create a new startup token instantly tradeable on a bonding curve. Set a name, ticker, logo, description, and social links. Optionally be the first investor in your own project.

### Unified Portfolio
Track wallet balance, token holdings, PnL, open orders, and full trade history in a single view. Supports USDC balance tracking and real-time portfolio valuation.

### Telegram Bot
Full-featured bot with commands:
- `/start` — Welcome menu with quick-access buttons
- `/profile` — Wallet & portfolio
- `/tokens` — Paginated token scanner with inline risk scores
- `/trade` — Open trading panel
- `/strategy` — Strategy portfolio builder
- `/launch` — Launch a new token

Wallet connection is handled via encrypted private key input directly in chat.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6, React 19, TypeScript |
| Styling | Tailwind CSS 4, Telegram theme variables |
| Bot | Telegraf 4.16 (webhook mode) |
| On-chain data | Goldsky GraphQL subgraph |
| AI | OpenAI GPT-4o-mini |
| Charts | Lightweight Charts v4 |
| Smart contracts | Solidity, Hardhat, OpenZeppelin (upgradeable proxies) |
| Network | Base (L2) |

## Project Structure

```
pages/
├── pump.tsx              # Token listing (pump.fun-style)
├── analyze.tsx           # Token detail + AI risk analysis
├── limit-order.tsx       # Multi-level limit order builder
├── strategy.tsx          # Risk-tiered portfolio builder
├── launch.tsx            # Token launch form
├── profile.tsx           # Wallet, holdings, PnL, activity
├── trade.tsx             # Market trade panel
├── connect-wallet.tsx    # Wallet connection flow
├── project/[id].tsx      # Dynamic project detail page
└── api/
    ├── telegram.ts       # Telegraf webhook handler
    ├── analyze.ts        # AI risk analysis endpoint
    ├── portfolio.ts      # Portfolio management
    ├── strategy.ts       # Strategy allocation engine
    ├── limit-order.ts    # Limit order management
    ├── launch.ts         # Token launch endpoint
    ├── chart-data.ts     # OHLCV chart data
    └── connect-wallet.ts # Wallet connection

lib/
├── subgraph.ts           # Goldsky GraphQL queries
├── risk.ts               # Composite risk scoring engine
└── chart-utils.ts        # Chart data utilities

contracts/                # Hardhat project
├── contracts/            # Solidity (OpenZeppelin upgradeable proxies)
├── ignition/             # Deployment modules
├── scripts/              # Deploy scripts
└── test/                 # Contract tests

scripts/
└── set-webhook.ts        # Bot setup (webhook, commands, description)
```

## Getting Started

### Prerequisites
- Node.js 18+
- Telegram bot token (from [@BotFather](https://t.me/BotFather))
- OpenAI API key
- Public HTTPS URL (ngrok for local dev)

### Setup

```bash
npm install
```

Create `.env.local`:

```env
BOT_TOKEN=your_telegram_bot_token
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_APP_URL=https://your-domain.ngrok-free.app
```

### Configure the bot

```bash
npx tsx scripts/set-webhook.ts
```

This registers the webhook, sets bot commands, description, and the Mini App menu button.

### Run

```bash
npm run dev
```

### Build

```bash
npm run build && npm start
```

### Smart Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

## Risk Scoring Model

Tokens are scored 0–100 based on five weighted factors:

| Factor | Low Risk | Medium | High Risk |
|--------|----------|--------|-----------|
| Volume | > 1 ETH | 0.1–1 ETH | < 0.1 ETH |
| Trade count | > 20 | 5–20 | < 5 |
| Age | > 24h | 1–24h | < 1h |
| Graduated | Yes | — | No |
| Last trade | < 24h ago | — | > 24h ago |

The composite score feeds into GPT-4o-mini for a natural language risk assessment with a clear verdict: **SAFE**, **CAUTION**, or **AVOID**.

## License

MIT
