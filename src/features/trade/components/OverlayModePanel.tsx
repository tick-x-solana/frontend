"use client";

import { Button } from "@/src/components/shadcn/button";
import { ArrowRightCircle, ChevronRight } from "lucide-react";

const OVERLAY_FILTER_LABELS = ["Strategy", "Username"] as const;

type OverlayModePanelProps = {
  overlayMode: boolean;
  onOverlayModeChange: (nextValue: boolean) => void;
  onApply: () => void;
};

function OverlayFilterRow({ label }: { label: string }) {
  return (
    <div className="bg-background-surface flex items-center justify-between rounded-[8px] px-2 py-3">
      <div className="flex items-center gap-1.5">
        <ArrowRightCircle
          aria-hidden
          className="text-text-sub size-5"
          strokeWidth={1.75}
        />
        <span className="text-text-heading text-sm font-semibold tracking-[-0.01em]">
          {label}
        </span>
      </div>
      <ChevronRight
        aria-hidden
        className="text-text-sub size-5"
        strokeWidth={1.75}
      />
    </div>
  );
}

export default function OverlayModePanel({
  overlayMode,
  onOverlayModeChange,
  onApply,
}: OverlayModePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <span className="bg-grid-axis/70 h-1 w-20 rounded-full" aria-hidden />
      </div>

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-text-heading text-base font-semibold tracking-[-0.01em]">
            Overlay mode
          </p>
          <p className="text-text-sub mt-0.5 text-sm tracking-[-0.01em]">
            Lets you view where others placed their bids and win prices
            real-time.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={overlayMode}
          aria-label="Toggle overlay mode"
          onClick={() => onOverlayModeChange(!overlayMode)}
          className="bg-surface-control data-[checked=true]:bg-primary-medium relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors"
          data-checked={overlayMode}
        >
          <span
            aria-hidden
            className="bg-background-main absolute top-1/2 h-[14px] w-[18px] -translate-y-1/2 rounded-full shadow-[0_2px_4px_rgba(24,25,26,0.04)] transition-all"
            style={{
              left: overlayMode ? "calc(100% - 23px)" : "5px",
            }}
          />
        </button>
      </div>

      <button
        type="button"
        disabled
        className="text-text-disabled w-fit text-sm font-medium tracking-[-0.01em] disabled:pointer-events-none"
      >
        Reset filters
      </button>

      <div className="flex flex-col gap-1.5">
        {OVERLAY_FILTER_LABELS.map((label) => (
          <OverlayFilterRow key={label} label={label} />
        ))}
      </div>

      <Button
        type="button"
        onClick={onApply}
        className="bg-primary-medium text-text-inverse hover:bg-primary-light h-11 w-full rounded-[8px] px-4 text-sm font-medium tracking-[-0.01em] shadow-none"
      >
        Apply
      </Button>
    </div>
  );
}
