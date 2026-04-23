"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ErrorBoundary,
  type FallbackProps,
} from "react-error-boundary";
import AppErrorFallback from "@/src/components/common/AppErrorFallback";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <AppErrorFallback
      error={error}
      description="A client-side rendering error was caught before it could crash the whole app."
      onRetry={() => resetErrorBoundary()}
    />
  );
}

export default function AppErrorBoundary({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={children}>
      <AppErrorBoundaryContent>{children}</AppErrorBoundaryContent>
    </Suspense>
  );
}

function AppErrorBoundaryContent({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      resetKeys={[pathname, searchParamsKey]}
      onError={(error, info) => {
        console.error("AppErrorBoundary caught an error:", error, info);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
