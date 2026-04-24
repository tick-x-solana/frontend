"use client";

import DefaultLayout from "@/src/components/layout/DefaultLayout";
import AppErrorBoundary from "@/src/components/providers/AppErrorBoundary";
import AuthGate from "@/src/components/providers/AuthGate";
import AuthProvider from "@/src/components/providers/AuthProvider";
import { Toaster } from "@/src/components/shadcn/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/src/lib/wagmi";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { MiniKit } from "@worldcoin/minikit-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function tryDecodePathParam(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function decodePathParamDeep(path: string) {
  let current = path;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const decoded = tryDecodePathParam(current);
    if (decoded === current) {
      break;
    }
    current = decoded;
  }
  return current;
}

function extractRefCodeFromMiniAppPath(pathParam: string) {
  const normalizedPath = decodePathParamDeep(pathParam).trim();
  const referralRouteMatch = normalizedPath.match(
    /^\/?ref\/([^/?#]+)(?:\?.*)?$/i,
  );
  if (referralRouteMatch?.[1]) {
    return referralRouteMatch[1].trim();
  }

  const draftRouteMatch = normalizedPath.match(
    /^\/?([^/?#]+)\/draft(?:\?.*)?$/i,
  );
  return draftRouteMatch?.[1]?.trim() || null;
}

const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    try {
      void import("eruda").then(({ default: eruda }) => {
        // eruda.init();
      });

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
      <Suspense fallback={null}>
        <MiniAppPathRedirect />
      </Suspense>
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

function MiniAppPathRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const rawPath = searchParams.get("path");
    if (!rawPath) {
      return;
    }

    const refCode = extractRefCodeFromMiniAppPath(rawPath);
    if (!refCode) {
      return;
    }

    const targetPath = `/ref/${encodeURIComponent(refCode)}`;
    if (pathname === targetPath) {
      return;
    }

    router.replace(targetPath);
  }, [pathname, router, searchParams]);

  return null;
}

export default Providers;
