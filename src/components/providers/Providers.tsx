"use client";

import DefaultLayout from "@/src/components/layout/DefaultLayout";
import AppErrorBoundary from "@/src/components/providers/AppErrorBoundary";
import AuthGate from "@/src/components/providers/AuthGate";
import AuthProvider from "@/src/components/providers/AuthProvider";
import { Toaster } from "@/src/components/shadcn/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/src/lib/wagmi";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { MiniKit } from "@worldcoin/minikit-js";

const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    try {
      void import("eruda").then(({ default: eruda }) => {
        eruda.init();
      });
      console.log("MiniKit: ", MiniKit);

      const { success } = MiniKit.install();
      if (success) {
        console.warn("Minikit install successfully");
      } else {
        console.warn("Minikit install failed");
      }
    } catch (error) {
      console.warn("Minikit install failed", error);
    }
  }, []);

  return (
    <>
      <AppErrorBoundary>
        <WagmiProvider config={wagmiConfig}>
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
        </WagmiProvider>
      </AppErrorBoundary>
    </>
  );
};

export default Providers;
