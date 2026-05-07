# TickX Solana Website Migration Plan

## Objective

Migrate TickX from a World Mini App oriented product into a desktop-first Solana website.

Primary goals:

- Replace World Mini App auth and World-specific UX with Solana wallet connection.
- Refactor the product from mobile-first mini-app patterns into a desktop web experience.
- Preserve the existing product strengths: fast trading, portfolio tracking, leaderboard, and referral flows.
- Keep the migration incremental so the current app can continue to run while major pieces are replaced.

## Current State Summary

The current frontend is strongly coupled to World Mini App and EVM-based flows:

- `src/components/providers/Providers.tsx` installs `MiniKit` and redirects mini-app path params.
- `src/components/providers/AuthProvider.tsx` mixes World Mini App login with `wagmi` wallet auth.
- `src/components/providers/AuthGate.tsx` is built around World ID onboarding and proof verification.
- `src/hooks/useDepositWithdraw.ts` uses World-chain specific RPC and user-op behavior.
- `src/hooks/useMiniAppUsername.ts`, `src/hooks/useWorldMiniAppChatPay.ts`, `src/hooks/useWinShareActions.ts`, and several referral/explore features depend on World APIs and chat/share behavior.
- `src/components/layout/Header.tsx` still assumes `wagmi`, `sepolia`, and a mini-app aware auth button.
- The UI is functional on desktop, but the structure and copy are still optimized for mini-app onboarding and mobile navigation.

## Target Product Direction

TickX should become a desktop-first Solana trading website with:

- Solana wallet connection via Phantom and other common Solana wallets.
- A clean wallet session model based on wallet public key + signed backend challenge.
- Desktop navigation, header actions, and dashboard spacing optimized for large screens first.
- Solana-native language in the UI, docs, onboarding, and portfolio flows.
- Removal of World Mini App assumptions from auth, referral, payments, verification, and sharing.

## Recommended Tech Changes

### Wallet and chain

Replace current wallet stack for the web app:

- Remove `wagmi` and `viem` from primary user wallet flows.
- Add Solana wallet libraries:
  - `@solana/web3.js`
  - `@solana/wallet-adapter-react`
  - `@solana/wallet-adapter-react-ui`
  - `@solana/wallet-adapter-wallets`
  - `@solana/wallet-adapter-phantom`
- Add a Solana config layer for:
  - cluster selection (`devnet`, `mainnet-beta`)
  - RPC endpoint
  - supported wallets
  - explorer URL builder

### Auth

Replace World/EVM auth with a Solana wallet challenge flow:

1. User connects wallet.
2. Frontend requests a backend nonce/challenge.
3. User signs the challenge with the Solana wallet.
4. Frontend sends `publicKey`, `signature`, and `message` to backend.
5. Backend verifies signature and returns app access token.

### UI direction

Refactor the app into desktop-first layout rules:

- Keep the existing design token approach in `app/globals.css`.
- Extend tokens for a Solana visual system instead of hardcoding colors in components.
- Replace mini-app splash/onboarding screens with desktop wallet onboarding.
- Reduce dependence on bottom navigation patterns for primary desktop flows.
- Promote trading workspace layout, wallet summary, and portfolio data density for large screens.

## Suggested File-Level Migration Map

### Remove or replace

- `src/components/providers/AuthGate.tsx`
  - Replace World ID onboarding with desktop wallet onboarding.
- `src/components/providers/AuthProvider.tsx`
  - Replace MiniKit and `wagmi` auth logic with Solana wallet session logic.
- `src/components/providers/Providers.tsx`
  - Remove MiniKit install and `WagmiProvider`; add Solana wallet providers.
- `src/lib/wagmi.ts`
  - Remove and replace with `src/lib/solana.ts` or `src/lib/solana-config.ts`.
- `app/api/rp-signature/route.ts`
  - Remove if no longer needed.
- `app/api/verify-proof/route.ts`
  - Remove if no longer needed.
- `src/hooks/useMiniAppUsername.ts`
  - Remove or replace with wallet profile / ENS-like display abstraction if needed.
- `src/hooks/useWorldMiniAppChatPay.ts`
  - Remove or redesign for normal web sharing.
- `src/features/referrals/worldChatShare.ts`
  - Replace with web share / copy link logic.

### Refactor

- `src/components/layout/Header.tsx`
  - Replace EVM and mini-app logic with Solana connect/disconnect UI.
- `src/components/layout/DefaultLayout.tsx`
  - Shift to desktop-first shell and make mobile nav secondary.
- `src/features/portfolio/components/WalletActionPanel.tsx`
  - Replace World identity references and show Solana wallet details.
- `src/features/portfolio/Portfolio.tsx`
  - Update faucet/dev tooling, wallet copy, and network assumptions.
- `src/hooks/useDepositWithdraw.ts`
  - Rework for Solana transaction flow and token accounts.
- `src/services/custom-client.ts`
  - Confirm wallet header and auth token strategy still match backend needs.
- `src/features/referrals/*`
  - Remove World chat assumptions and convert to website referral flows.
- `README.md`
  - Rewrite stack, auth, and deployment notes around Solana.

### Add

- `src/lib/solana.ts`
  - Connection, cluster, explorer helpers.
- `src/components/providers/SolanaWalletProvider.tsx`
  - Solana wallet adapter composition.
- `src/components/auth/SolanaConnectGate.tsx`
  - Desktop connect/sign-in experience.
- `src/hooks/useSolanaAuth.ts`
  - Wallet challenge login/logout/session refresh.
- `src/constants/solana.ts` or shared entries in `src/constants/index.ts`
  - RPC URLs, cluster names, explorer base URL, signature message labels.
- `docs/solana-backend-contract.md`
  - Optional backend API contract for signature verification and account mapping.

## UI Refactor Direction For Solana Desktop

### Design principles

- Make desktop the default canvas, not a stretched mini-app.
- Keep the dark trading aesthetic, but tune it toward a sharper Solana-native identity.
- Use denser panels, stronger hierarchy, wider content containers, and more persistent side-by-side information.
- Preserve token-driven Tailwind classes through `app/globals.css`.

### Concrete UI changes

- Header:
  - Add clear wallet state, network badge, and primary account action.
  - Replace generic `Connect Wallet` logic with Solana wallet modal.
- Trading page:
  - Increase use of horizontal space for chart/grid, order controls, and active positions.
  - Move transient mobile overlays into desktop side panels where possible.
- Portfolio:
  - Surface wallet balance, token holdings, claimable rewards, and transaction history in desktop cards/tables.
- Navigation:
  - Keep top navigation as primary on desktop.
  - Downgrade bottom nav importance; retain mobile support only as secondary.
- Explore / referrals:
  - Replace World-specific education and CTAs with Solana-compatible product messaging.
- Onboarding:
  - Remove World ID stepper flow.
  - Replace with a short desktop welcome panel: connect wallet, sign in, start trading.

### Visual system adjustments

Update token usage in `app/globals.css` before changing component styling:

- Keep semantic tokens such as `--background-main`, `--stroke-main`, `--text-heading`.
- Add Solana-accent semantic tokens if needed, for example:
  - `--accent-solana-green`
  - `--accent-solana-blue`
  - `--surface-wallet`
  - `--border-wallet`
- Expose each through `--color-*` aliases so components stay token-driven.

## Migration Phases

## Phase 1: Audit and architecture freeze

Deliverables:

- List all World-specific and EVM-specific dependencies.
- Confirm backend changes required for Solana signature verification.
- Decide supported wallets and first network target.
- Freeze routes and feature scope for v1 migration.

Tasks:

- Inventory all `MiniKit`, `World ID`, `wagmi`, `viem`, and `sepolia` references.
- Confirm whether the backend remains the same product backend or a new Solana backend layer is needed.
- Decide whether token settlement is native SOL, SPL token, or off-chain ledger with wallet auth only.

## Phase 2: Solana wallet foundation

Deliverables:

- Solana provider setup in app root.
- Connect/disconnect UX working on desktop.
- Shared Solana config and constants added.

Tasks:

- Add Solana wallet adapter dependencies.
- Create `src/lib/solana.ts`.
- Replace `WagmiProvider` with Solana wallet provider composition.
- Refactor header wallet action to use Solana connect state.

## Phase 3: Solana auth migration

Deliverables:

- Login via signed wallet challenge.
- Logout and 401 recovery working.
- Legacy World onboarding removed from the main app path.

Tasks:

- Replace auth context internals with Solana public key + signature flow.
- Remove `MiniKit.install()` and world-only local storage keys.
- Replace `AuthGate` with a desktop sign-in gate.
- Update API client interceptors if backend expects a different wallet identifier format.

## Phase 4: Transaction and portfolio migration

Deliverables:

- Deposit/withdraw flow aligned with Solana.
- Portfolio screens show correct balances and history assumptions.
- Explorer links point to Solana explorer.

Tasks:

- Replace World-chain RPC logic in `useDepositWithdraw.ts`.
- Define token account and transaction confirmation behavior.
- Update portfolio labels, status messages, and history schema handling if backend payloads change.

## Phase 5: Desktop UI refactor

Deliverables:

- Desktop-first navigation and page shells.
- Desktop trading workspace layout.
- Refreshed portfolio and explore surfaces for Solana branding.

Tasks:

- Remove mini-app style splash and two-step onboarding.
- Rebalance `Header`, `DefaultLayout`, and key feature pages for large screens.
- Replace World-specific product copy, images, and CTAs.
- Review component reuse before introducing any new presentation components.

## Phase 6: Cleanup and release readiness

Deliverables:

- World-specific code removed from production paths.
- Documentation updated.
- Regression checklist completed.

Tasks:

- Remove unused packages and dead code.
- Update README, env docs, and deployment notes.
- Validate desktop layouts at common widths: `1280`, `1440`, `1728`.
- Run lint, build, and targeted manual QA.

## Backend Dependencies To Confirm Early

The frontend plan depends on backend confirmation for:

- Challenge endpoint for Solana wallet auth.
- Signature verification endpoint and message format.
- Mapping between Solana public key and TickX user profile.
- Deposit address model and supported asset model.
- Order placement payload changes if wallet format or settlement flow changes.
- Referral format if wallet-linked identities replace World usernames.

## Risks

- Existing business logic may still assume EVM-style addresses or World identities in API responses.
- Deposit/withdraw behavior is likely the most chain-specific part of the app and may require backend redesign, not just frontend changes.
- Referral and share features currently contain World ecosystem assumptions that will not translate directly to a normal website.
- Some copy-trading and identity UI may depend on usernames that no longer exist once World profile lookup is removed.

## Acceptance Criteria For Migration v1

- User can open TickX as a normal desktop website.
- User can connect a Solana wallet and sign in successfully.
- World Mini App onboarding and proof verification are removed from primary flows.
- Header, onboarding, and portfolio reflect Solana wallet state instead of World identity state.
- Trading, leaderboard, and portfolio routes work without `MiniKit`, `wagmi`, or `World ID`.
- Desktop UI feels intentional for large screens rather than adapted from mobile mini-app layouts.

## Recommended Execution Order In This Repo

1. Create Solana provider and wallet config.
2. Replace header wallet connect UX.
3. Replace auth provider and auth gate.
4. Remove mini-app redirects and World onboarding APIs.
5. Refactor portfolio and transaction flows.
6. Refactor explore/referral/share flows.
7. Apply desktop-first UI pass across major pages.
8. Remove obsolete dependencies and update docs.

## Notes For Implementation

- Keep constants centralized in `src/constants/index.ts` or a small adjacent constants module if the domain becomes large.
- Prefer extending existing layout and shadcn primitives before creating new components.
- Keep color changes token-driven through `app/globals.css`.
- Avoid mixing legacy World and new Solana auth in the same final production path longer than necessary; use a short transition branch rather than a long-lived hybrid state.
