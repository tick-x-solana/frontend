"use client";

import { useWallet } from "@solana/wallet-adapter-react";

// Thin wrapper around the wallet adapter so feature code doesn't import the
// adapter directly and can be swapped without touching every call-site.
export function useSolanaWallet() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();

  return {
    publicKey: publicKey?.toBase58() ?? null,
    signTransaction,
    sendTransaction,
  };
}
