"use client";

import DefaultLayout from "@/src/components/layout/DefaultLayout";
import AppErrorBoundary from "@/src/components/providers/AppErrorBoundary";
import AuthGate from "@/src/components/providers/AuthGate";
import AuthProvider from "@/src/components/providers/AuthProvider";
import { Toaster } from "@/src/components/shadcn/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";

const SOLANA_ENDPOINT = clusterApiUrl("devnet");

function SolanaProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={SOLANA_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <AppErrorBoundary>
      <SolanaProviders>
        <NuqsAdapter>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AuthGate>
                <DefaultLayout>{children}</DefaultLayout>
              </AuthGate>
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </QueryClientProvider>
        </NuqsAdapter>
      </SolanaProviders>
    </AppErrorBoundary>
  );
};

export default Providers;
