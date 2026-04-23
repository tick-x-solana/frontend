"use client";

import { useEffect } from "react";
import AppErrorFallback from "@/src/components/common/AppErrorFallback";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("App Router error boundary caught an error:", error);
  }, [error]);

  return (
    <AppErrorFallback
      error={error}
      title="This page failed to load"
      description="Next.js caught a route-level error for this segment."
      onRetry={() => unstable_retry()}
    />
  );
}
