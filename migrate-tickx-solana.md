# TickX Solana Desktop Migration Plan (Final Pre-Implementation)

## 1) Objective

Migrate TickX from World Mini App to a desktop-first Solana website on **Solana Devnet**.

Primary goals:

- Remove World Mini App / World ID onboarding and dependencies from active user flow.
- Keep Solana wallet support for **Phantom + Solflare**.
- Login by wallet connect + sign message to receive backend access token.
- Replace all WLD references with SOL across code, UI, naming, and filenames.
- Refactor deposit/withdraw to Solana onchain flow + required backend debug/finalize APIs.
- Refactor trading grid to **single socket architecture** for all realtime + place bet.

## 2) Confirmed Inputs

- Solana program ID (devnet): `Bwwg2cPZzgij4GT795iBB882wFtRyuSr5qBrAYzyAoWT`.
- Contract interface source of truth: `POOL_RESERVE_IDL` in `src/constants/abi.ts` (latest updated version).
- Remove EVM ABI surface from `src/constants/abi.ts`.
- Auth login endpoint: `/api/auth/login`.
- Remove miniapp login flow and World onboarding logic.
- Backend balance is already parsed in SOL (`balance: 1` means `1 SOL`).
- Backend payment amounts are already SOL unit in API payloads.
- Solana cluster hard-lock to devnet for now.
- Keep socket auth/challenge/wss-signature flow.
- Keep bet event name `place_bet`.
- Use one socket only (no split `liveSocket` and `actionSocket`).
- Market for trading grid: `SOL/USDT`.
- SOL/USD price source: `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd`, refresh every 10s.
- `logIndex` for debug/finalize APIs: always `0`.
- Use real tx hash/signature if available; fallback format can be `0x + timestamp` only when needed.
- Rust scripts are out of scope for implementation; used only as behavior reference.

## 3) Required Business Flows

### 3.1 Login Flow

1. Connect wallet (Phantom/Solflare).
2. Request challenge from backend.
3. Sign challenge with Solana wallet.
4. Call `/api/auth/login` with wallet address + message + signature.
5. Store token/session and rehydrate app state.

### 3.2 Deposit Flow (Required)

1. User enters SOL amount.
2. FE sends Solana onchain `depositTrader` transaction.
3. After onchain success, FE calls `POST /api/payment/debug/deposit` with body:

```json
{
  "amount": "string",
  "txHash": "string",
  "logIndex": 0
}
```

Notes:

- `amount` is SOL unit string.
- `txHash` should prefer real Solana transaction signature when available.
- `logIndex` fixed to `0`.

### 3.3 Withdraw Flow (Required)

1. FE calls `POST /api/payment/withdraw` to create withdrawal session/input.
2. FE sends Solana onchain withdrawal transaction using latest `POOL_RESERVE_IDL` withdraw instruction signature/args.
3. After onchain success, FE calls `POST /api/payment/debug/finalize-withdrawal` with body:

```json
{
  "sessionId": "string",
  "txHash": "string",
  "logIndex": 0
}
```

Notes:

- `sessionId` comes from withdraw API response.
- `txHash` same rule as deposit.
- `logIndex` fixed to `0`.

## 4) Trading Grid Migration (SOL/USDT + Single Socket)

## 4.1 Realtime Socket Architecture

Refactor from split socket model into one socket endpoint:

- Socket base: `https://api-tap-fun-solana.nysm.work`
- Keep existing auth/challenge/wss-signature handshake logic.
- Use this single socket for:
  - `price_update`
  - `order_update`
  - `balance_update`
  - `grid_update`
  - `place_bet`
  - other related trade events currently consumed

## 4.2 Place Bet Behavior

- Continue using socket event `place_bet`.
- Remove dependency on separate action socket channel/mechanism.
- Keep pending bet -> confirmation by `order_update` behavior.

## 4.3 Price Source Update

- Replace WLD price query hook with SOL/USD from CoinGecko.
- Poll every 10 seconds.
- Apply to approximate USD displays in trading/portfolio where needed.

## 5) Naming and File Refactor Policy (Mandatory)

Perform complete migration from WLD naming to SOL naming:

- Variables: `amountWld` -> `amountSol`, `wldUsdPrice` -> `solUsdPrice`, etc.
- Constants: `BID_OPTIONS_WLD` -> `BID_OPTIONS_SOL`, etc.
- Functions/hooks/files: rename WLD-specific artifacts to SOL equivalents.
- UI text: replace `WLD` with `SOL`.
- Icons/assets: replace token visuals with `/sol.png`.

This applies to:

- code logic
- filenames
- component props/state names
- API payload field wrappers on FE side
- labels, messages, toasts, helper text

## 6) File-Level Execution Plan

## 6.1 Providers, Auth, Onboarding

- `src/components/providers/Providers.tsx`
  - Remove MiniKit install and miniapp-specific path assumptions.
  - Keep Solana wallet providers.
  - Hard-lock devnet endpoint.

- `src/components/providers/AuthProvider.tsx`
  - Keep Solana sign-message auth only.
  - Remove miniapp login branches and World-specific storage keys.
  - Standardize on `/api/auth/login`.

- `src/components/providers/AuthGate.tsx`
  - Replace World ID onboarding with Solana desktop onboarding gate.

- Remove legacy world proof routes if unused:
  - `app/api/rp-signature/route.ts`
  - `app/api/verify-proof/route.ts`

## 6.2 Contract and Constants

- `src/constants/abi.ts`
  - Remove EVM ABI exports and metadata.
  - Keep only Solana IDL and related constants.
  - Export explicit Solana program ID constant.

- Add/adjust Solana constants module for:
  - devnet RPC
  - program ID
  - explorer helper (optional)

## 6.3 Deposit/Withdraw

- `src/hooks/useDepositWithdraw.ts`
  - Rewrite to Solana tx flow using latest `POOL_RESERVE_IDL`.
  - Implement required post-onchain API calls:
    - `/api/payment/debug/deposit`
    - `/api/payment/debug/finalize-withdrawal`
  - Align withdraw pre-step with `/api/payment/withdraw` response contract.
  - Rename all WLD-oriented naming to SOL.

- `src/features/portfolio/components/WalletActionPanel.tsx`
  - Replace all WLD copy/logic/icons with SOL.
  - Keep deposit/withdraw UX aligned with new hook contract.

## 6.4 Trading Grid

- `src/features/trade/components/TradingGrid.tsx`
- `src/features/trade/hooks/useTradingGridSocketEffects.ts`
- related constants/hooks/store utils

Tasks:

- Move to single socket endpoint architecture.
- Keep socket auth/signature flow.
- Keep `place_bet` event for bet placement.
- Rename WLD naming to SOL across trade feature.
- Switch price hook integration to SOL/USD CoinGecko (10s).

## 6.5 UI Sweep (Desktop + SOL Branding)

- Portfolio desktop optimization and SOL labels.
- Leaderboard desktop optimization and SOL metrics labels.
- Remove residual World/MiniApp language.

## 7) Desktop UI Plan

## 7.1 Portfolio

- 2-column desktop layout:
  - left: balance/performance/history
  - right: wallet info + deposit/withdraw action panel
- Surface Devnet status and SOL primary balances.
- Replace WLD iconography with SOL branding.

## 7.2 Leaderboard

- Desktop-first table readability:
  - sticky header
  - compact rows
  - strong number alignment
- Ensure all value units/copy are SOL-oriented.

## 8) Migration Phases

## Phase A: Foundation Cleanup

- Remove World/MiniKit/IDKit active dependencies.
- Hard-lock devnet config.

## Phase B: Auth Stabilization

- Solana-only challenge-sign login.
- Remove miniapp login branches.

## Phase C: Contract + Payment Flows

- Clean `abi.ts` to Solana-only.
- Rewrite deposit/withdraw hook with required debug/finalize callbacks.

## Phase D: Trading Grid Socket Consolidation

- One socket endpoint for market + user + actions.
- Preserve auth/signature handshake and `place_bet`.
- SOL/USD price integration at 10s cadence.

## Phase E: UI and Naming Completion

- Full WLD -> SOL rename sweep (including filenames).
- Portfolio/Leaderboard desktop pass.

## Phase F: QA

- Connect wallet -> login -> trade -> deposit -> withdraw -> balance refresh.
- Verify debug/finalize API payloads and success paths.

## 9) Acceptance Criteria

- No active World onboarding flow in user journey.
- Solana auth works via signed challenge and `/api/auth/login`.
- Deposit and withdraw execute onchain then call required backend debug/finalize endpoints.
- Trading grid runs fully on one socket endpoint (`https://api-tap-fun-solana.nysm.work`).
- Bet placement uses socket event `place_bet`.
- SOL/USD data uses CoinGecko every 10s.
- All WLD references removed from UI, naming, and filenames in migrated scope.

## 10) Risks / Dependencies

- Withdraw API response must provide all required fields to build exact onchain withdraw instruction from latest IDL.
- Single-socket server must expose full event set currently split across two channels.
- Large rename (including filenames) may require careful import updates to avoid regressions.
