# TickX FE

TickX frontend, built with Next.js App Router, focused on real-time prediction market trading in the World ecosystem.

## Project goals

- Fast trading on a canvas-based price grid with continuous updates.
- User authentication via World Mini App or EVM wallet.
- Portfolio tracking, deposit/withdraw flows, leaderboard, referral, and explore modules.
- Mobile-first UI while maintaining full desktop support.

## Key features

- Trade screen (`/`):
  - Canvas-based trading grid with zoom/pan and click-to-bet.
  - Real-time updates over socket connections.
  - Follow-trading and win-sharing interactions.
- Portfolio (`/portfolio`):
  - Balance and trading history display.
  - Wallet action panel.
  - Debug faucet flow for dev environments.
- Leaderboard (`/leaderboard`):
  - Human and AI Agent tabs.
  - Optimized podium image rendering.
- Explore (`/explore`):
  - Browse modules: Follow Trading, Referral, Proof of Integrity, AI Agent.
  - World Mini App referral link generation and sharing integration.
- Referral redirect (`/ref/[refCode]`):
  - Redirects to `/` with `followRef` to prefill referral-driven flows.

## Tech stack

- Framework: Next.js `16.2.4` (App Router), React `19.2.4`, TypeScript.
- Styling: Tailwind CSS v4, shadcn/ui, tokenized CSS variables in `app/globals.css`.
- State and data:
  - TanStack Query for server state.
  - Zustand for local game/trade state.
- Auth and Web3:
  - `@worldcoin/minikit-js` for World App / Mini App integration.
  - `wagmi` + `viem` for EVM wallet connectivity.
- API client:
  - Orval-generated typed React Query hooks from OpenAPI.
  - Axios custom client with token and wallet-address interceptors.

## Directory structure

```text
app/                      # Next.js App Router pages/layout
src/
  components/             # layout, providers, common, shadcn wrappers
  features/
    trade/                # trading grid, controls, socket/order-follow logic
    portfolio/            # wallet actions, history, overview
    referrals/            # explore + referral + integrity flows
  hooks/                  # domain hooks (deposit/withdraw, mini-app, sharing...)
  services/               # orval generated queries + models + custom client
  utils/                  # canvas draw, grid math, shared utilities
public/                   # static assets
```

## Prerequisites

- Node.js `>= 20`
- npm or bun (this repo includes both `package-lock.json` and `bun.lock`)

## Installation and local run

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.public .env.local
```

3. Run the dev server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment variables

The current codebase uses only a small set of env vars, and several endpoints are still hardcoded. Minimum variables:

| Variable | Example | Purpose |
|---|---|---|
| `ENV` | `production` | Toggles environment-dependent behavior in parts of the referral flow. |
| `ORVAL_SWAGGER_URL` | `https://api-tap-fun-chainlink.nysm.work/swagger/json` | Overrides the OpenAPI source used by `generate:api`. |

## Scripts

- `npm run dev`: run local development server.
- `npm run build`: create production build.
- `npm run start`: run production server from build artifacts.
- `npm run lint`: run ESLint.
- `npm run format`: format code with Prettier.
- `npm run generate:api`: regenerate API client/hooks with Orval.

## API client generation (Orval)

Configured in `orval.config.ts`:

- Input: OpenAPI spec (`ORVAL_SWAGGER_URL` or the default URL).
- Output:
  - `src/services/queries.ts`
  - `src/services/models/*`
- Custom mutator: `src/services/custom-client.ts`.

Notes:

- `src/services/queries.ts` and `src/services/models/*` are generated files and should not be edited manually.
- Regenerate with `npm run generate:api` whenever the OpenAPI spec changes.

## Auth and session flow

- Mini App mode:
  - Uses MiniKit wallet auth + backend nonce.
  - Stores token/wallet/session in `localStorage`.
- Web mode:
  - Connect wallet via wagmi, sign challenge, then log in to backend for access token.
- Logout/401:
  - Interceptor clears token and emits `auth:logout` event to sync app state.

## Main routes

- `/`: Trading.
- `/portfolio`: Portfolio and wallet actions.
- `/leaderboard`: Leaderboard.
- `/explore`: Explore modules.
- `/ref/[refCode]`: Referral redirect.

## Code quality

- Lint:

```bash
npm run lint
```

- Format:

```bash
npm run format
```

## Build and deployment

```bash
npm run build
npm run start
```

Pre-deployment checklist:

- Ensure production API endpoints are correct.
- Regenerate API client if the spec changed.
- Verify chain/network settings in `src/lib/wagmi.ts` and related hooks.
- Confirm Mini App App ID and referral link configuration.

## Important technical notes

- `next.config.ts` includes:
  - Turbopack + SVGR config (`*.svg` imported as React components),
  - `allowedDevOrigins` for dev tunnel environments,
  - `images.remotePatterns` for remote image domains.
- Onboarding and auth gate logic live in the client-side provider layer.
- UI is token-driven via CSS variables in `app/globals.css`.

## Suggested backlog

- Move hardcoded values (API URLs, App IDs, chain IDs, contract addresses) to environment variables.
- Add automated tests for auth, trade flows, and API adapters.
- Add CI pipeline for lint + typecheck + build.

## License

No explicit license is currently defined in this repository.
