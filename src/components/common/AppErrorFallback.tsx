"use client";

import { Button } from "@/src/components/shadcn/button";

type AppErrorFallbackProps = {
  error?: unknown;
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unexpected application error";
}

export default function AppErrorFallback({
  error,
  title = "Something went wrong",
  description = "The app hit an unexpected error while rendering this screen.",
  retryLabel = "Try again",
  onRetry,
}: AppErrorFallbackProps) {
  const errorMessage = getErrorMessage(error);
  const showErrorDetails = false;
  return (
    <div className="bg-background-main text-text-main flex min-h-[60vh] flex-1 items-center justify-center px-5 py-8">
      <div className="border-border-main bg-surface-card w-full max-w-md rounded-[20px] border p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="bg-warning-surface text-warning-medium inline-flex rounded-full px-3 py-1 text-xs font-semibold">
          Error boundary
        </div>

        <div className="mt-4 space-y-2">
          <h1 className="text-text-heading text-xl font-semibold">{title}</h1>
          <p className="text-text-sub text-sm">{description}</p>
        </div>

        {showErrorDetails && (
          <div className="border-border-subtle bg-background-surface text-text-sub mt-5 rounded-xl border px-3 py-2 text-xs break-words">
            {errorMessage}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          {onRetry ? (
            <Button
              type="button"
              className="bg-primary-medium text-text-inverse hover:bg-primary-light"
              onClick={onRetry}
            >
              {retryLabel}
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="border-border-main bg-background-surface text-text-main hover:bg-surface-overlay hover:text-text-main"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}
