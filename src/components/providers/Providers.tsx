"use client";

import DefaultLayout from "@/src/components/layout/DefaultLayout";
import AppErrorBoundary from "@/src/components/providers/AppErrorBoundary";
import AuthProvider from "@/src/components/providers/AuthProvider";
import { Toaster } from "@/src/components/shadcn/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/src/lib/wagmi";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <>
      <AppErrorBoundary>
        <WagmiProvider config={wagmiConfig}>
          <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <DefaultLayout>{children}</DefaultLayout>
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
