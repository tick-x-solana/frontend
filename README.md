# TickX FE

TickX frontend — a desktop-first Solana prediction market trading app built with Next.js App Router.

## Overview

TickX is a real-time prediction market where users trade on price movement outcomes. The frontend runs on Solana Devnet, supports Phantom and Solflare wallets, and denominates all balances in SOL. Trading is driven by a canvas-based price grid with continuous WebSocket updates.

## Key Features

- **Trading grid** (`/`): Canvas-based price grid with zoom/pan and click-to-bet. Real-time updates, follow-trading, and win-sharing.
- **Portfolio** (`/portfolio`): SOL balance, trading history, deposit and withdraw.
- **Leaderboard** (`/leaderboard`): Human and AI Agent tabs with podium rendering.
- **Explore** (`/explore`): Follow Trading, Referral, Proof of Integrity, and AI Agent modules.
- **Referral redirect** (`/ref/[refCode]`): Redirects to `/` with prefilled referral state.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js `16.2.4` (App Router), React `19.2.4`, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui, tokenized CSS variables in `app/globals.css` |
| State | TanStack Query (server state), Zustand (local trade/game state) |
| Web3 | `@solana/wallet-adapter-*` (Phantom, Solflare), `wagmi` + `viem` |
| Realtime | `socket.io-client` |
| API client | Orval-generated typed React Query hooks from OpenAPI spec |

## Solana Details

- Network: **Devnet** (hard-locked)
- Program ID: `Bwwg2cPZzgij4GT795iBB882wFtRyuSr5qBrAYzyAoWT`
- Contract interface: `POOL_RESERVE_IDL` in [src/constants/abi.ts](src/constants/abi.ts)
- SOL/USD price: fetched from CoinGecko every 10 seconds
- All backend balances are in SOL units (`balance: 1` = `1 SOL`)

## Directory Structure

```
app/                      # Next.js App Router pages and layout
src/
  components/             # Layout, providers, common UI, shadcn wrappers
  constants/              # Shared constants (abi.ts, index.ts, ...)
  features/
    trade/                # Trading grid, controls, socket/order-follow logic
    portfolio/            # Wallet actions, history, overview
    referrals/            # Explore, referral, and integrity flows
  hooks/                  # Domain hooks (deposit/withdraw, sharing, ...)
  services/               # Orval-generated queries + models + custom Axios client
  utils/                  # Canvas draw helpers, grid math, shared utilities
public/                   # Static assets
```

## Prerequisites

- Node.js `>= 20`
- npm or bun

## Getting Started

```bash
npm install
cp .env.public .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Example | Purpose |
|---|---|---|
| `ENV` | `production` | Toggles environment-dependent behavior (e.g. referral flow) |
| `RP_ID` | `rp_xxxxx` | World ID 4.0 relying-party ID for RP signature endpoints |
| `RP_SIGNING_KEY` | `<hex-private-key>` | Server-side secret for RP signature generation — never expose to the client |
| `ORVAL_SWAGGER_URL` | `https://api.example.com/swagger/json` | Overrides the OpenAPI source used by `generate:api` |

## Scripts

```bash
npm run dev           # Local development server
npm run build         # Production build
npm run start         # Run production build
npm run lint          # ESLint
npm run format        # Prettier
npm run generate:api  # Regenerate API client with Orval
```

## API Client Generation (Orval)

Configured in [orval.config.ts](orval.config.ts). Input is an OpenAPI spec; output is `src/services/queries.ts` and `src/services/models/*`. Do not edit generated files manually — run `npm run generate:api` when the spec changes.

## Notable Config

- [next.config.ts](next.config.ts): Turbopack, SVGR for `*.svg` imports, `allowedDevOrigins`, `images.remotePatterns`.
- [app/globals.css](app/globals.css): All design tokens as CSS variables — do not hardcode colors in components.

## License

No explicit license is currently defined in this repository.
