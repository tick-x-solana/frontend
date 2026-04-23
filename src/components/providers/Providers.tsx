"use client";

import DefaultLayout from "@/src/components/layout/DefaultLayout";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/src/components/shadcn/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <div>
      <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
          <DefaultLayout>{children}</DefaultLayout>
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </NuqsAdapter>
    </div>
  );
};

export default Providers;
