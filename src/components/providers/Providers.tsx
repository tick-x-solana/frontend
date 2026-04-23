"use client";

import DefaultLayout from "@/src/components/layout/DefaultLayout";
import AuthProvider from "@/src/components/providers/AuthProvider";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/src/components/shadcn/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/src/lib/wagmi";

const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <div>
      <NuqsAdapter>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <DefaultLayout>{children}</DefaultLayout>
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </NuqsAdapter>
    </div>
  );
};

export default Providers;
