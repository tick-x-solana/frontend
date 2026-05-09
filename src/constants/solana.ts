import {
  SOLANA_DEVNET_RPC_URL,
  SOLANA_PROGRAM_ID,
  SOLANASCAN_DEVNET_TX_BASE_URL,
} from "./index";

// Re-export under the names expected by useDepositWithdraw and related hooks.
export const SOLANA_RPC_ENDPOINT = SOLANA_DEVNET_RPC_URL;
export const TICKX_SOLANA_PROGRAM_ID = SOLANA_PROGRAM_ID;
export const SOLANA_TX_EXPLORER_BASE_URL = SOLANASCAN_DEVNET_TX_BASE_URL;
