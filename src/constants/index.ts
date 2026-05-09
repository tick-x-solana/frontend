// Shared viewport breakpoint used to switch mobile-only interactions to desktop UI.
export const MOBILE_VIEWPORT_BREAKPOINT_PX = 640;
// Number of recent user orders to request for the quick order list.
export const USER_ORDERS_FETCH_LIMIT = 20;
// Time range used to fetch the user's most recent grid orders.
export const USER_ORDERS_LOOKBACK_MS = 15_000;
// Max recent orders list height on inline desktop panel, capped by viewport.
export const RECENT_ORDERS_INLINE_MAX_HEIGHT =
  "min(560px, calc(100dvh - 400px))";
// Max recent orders list height inside sheets, capped by viewport.
export const RECENT_ORDERS_SHEET_MAX_HEIGHT = "calc(100dvh - 240px)";
// Solana program id used by TickX on Solana Devnet.
export const SOLANA_PROGRAM_ID = "Bwwg2cPZzgij4GT795iBB882wFtRyuSr5qBrAYzyAoWT";
// RPC endpoint hard-locked to Solana Devnet during migration.
export const SOLANA_DEVNET_RPC_URL = "https://api.devnet.solana.com";
// Base URL for SolanaScan transaction pages scoped to Solana Devnet.
export const SOLANASCAN_DEVNET_TX_BASE_URL = "https://solscan.io/tx";
// Single realtime socket endpoint for Solana market + user events.
export const SOLANA_SOCKET_BASE_URL = "https://api-tap-fun-solana.nysm.work";
// Each fortress diagnostics heatmap column covers this many seconds.
export const FORTRESS_MC_GRID_CELL_SECONDS = 5;
// Upper bound for the diagnostics heatmap probability color scale.
export const FORTRESS_MC_P_RAW_MAX = 1;
// Query key used by Explore route to persist opened section in browser history.
export const EXPLORE_TAB_QUERY_KEY = "tab";
// Local storage key for custom bid size value selected by the current wallet session.
export const CUSTOM_BID_SIZE_STORAGE_KEY = "tickx-custom-bid-size-sol";
// Default faucet amount in SOL for debug deposit endpoint.
export const FAUCET_DEPOSIT_AMOUNT_SOL = 3;
// Cooldown time in milliseconds between faucet requests.
export const FAUCET_COOLDOWN_MS = 30 * 60 * 1000;
// Local storage key for last faucet timestamp (milliseconds since epoch).
export const FAUCET_LAST_REQUEST_AT_STORAGE_KEY =
  "tickx-faucet-last-request-at";
