"use client";

import { SOLANA_REQUIRED_CLUSTER } from "@/src/constants";

export function useSolanaNetworkGuard() {
  return {
    cluster: SOLANA_REQUIRED_CLUSTER,
    isWrongNetwork: false,
    canSubmitTransactions: true,
    warningMessage: null,
  };
}
