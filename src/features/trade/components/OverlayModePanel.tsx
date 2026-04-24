"use client";

import { useState } from "react";
import { Button } from "@/src/components/shadcn/button";
import { ArrowRightCircle, ChevronDown } from "lucide-react";

type FollowTradeTarget = {
  id: string;
  label: string;
  subtitle?: string;
  enabled: boolean;
};

type OverlayModePanelProps = {
  suggestedStrategyEnabled: boolean;
  followTradeEnabled: boolean;
  followTradeTargets: FollowTradeTarget[];
  isFollowTradeLoading: boolean;
  onSuggestedStrategyEnabledChange: (nextValue: boolean) => void;
  onFollowTradeEnabledChange: (nextValue: boolean) => void;
  onFollowTradeTargetEnabledChange: (
    targetUserId: string,
    nextValue: boolean,
  ) => void;
  onApply: () => void;
};

type OverlayFilterRowProps = {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

function OverlayFilterRow({
  label,
  checked,
  onToggle,
  disabled = false,
}: OverlayFilterRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`Toggle ${label}`}
      onClick={onToggle}
      disabled={disabled}
      className="bg-background-surface flex items-center justify-between rounded-[8px] px-2 py-3 disabled:cursor-not-allowed disabled:opacity-60"
    >
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

      <span
        aria-hidden
        className="bg-surface-control data-[checked=true]:bg-primary-medium relative h-5 w-9 shrink-0 rounded-full transition-colors"
        data-checked={checked}
      >
        <span
          className="bg-background-main absolute top-1/2 h-3 w-4 -translate-y-1/2 rounded-full transition-all"
          style={{ left: checked ? "calc(100% - 19px)" : "3px" }}
        />
      </span>
    </button>
  );
}

export default function OverlayModePanel({
  suggestedStrategyEnabled,
  followTradeEnabled,
  followTradeTargets,
  isFollowTradeLoading,
  onSuggestedStrategyEnabledChange,
  onFollowTradeEnabledChange,
  onFollowTradeTargetEnabledChange,
  onApply,
}: OverlayModePanelProps) {
  console.log("followTradeTargets: ", followTradeTargets);
  const [isFollowTradeConfigOpen, setIsFollowTradeConfigOpen] = useState(false);
  const hasFollowTradeTargets = followTradeTargets.length > 0;
  const isFollowTradeConfigExpanded =
    followTradeEnabled && isFollowTradeConfigOpen;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <span className="bg-grid-axis/70 h-1 w-20 rounded-full" aria-hidden />
      </div>

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-text-heading text-base font-semibold tracking-[-0.01em]">
            Overlay settings
          </p>
          <p className="text-text-sub mt-0.5 text-sm tracking-[-0.01em]">
            Lets you view where others placed their bids and win prices
            real-time.
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled
        className="text-text-disabled w-fit text-sm font-medium tracking-[-0.01em] disabled:pointer-events-none"
      >
        Reset filters
      </button>

      <div className="flex flex-col gap-1.5">
        <OverlayFilterRow
          label="Strategy"
          checked={suggestedStrategyEnabled}
          onToggle={() =>
            onSuggestedStrategyEnabledChange(!suggestedStrategyEnabled)
          }
        />

        <div className="bg-background-surface rounded-[8px] px-2 py-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setIsFollowTradeConfigOpen((currentValue) => !currentValue)
              }
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[6px] py-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowRightCircle
                aria-hidden
                className="text-text-sub size-5 shrink-0"
                strokeWidth={1.75}
              />
              <span className="text-text-heading truncate text-sm font-semibold tracking-[-0.01em]">
                Follow Trade
              </span>
              <ChevronDown
                aria-hidden
                className="text-text-sub ml-auto size-4 shrink-0 transition-transform"
                strokeWidth={1.75}
                style={{
                  transform: isFollowTradeConfigExpanded
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                }}
              />
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={followTradeEnabled}
              aria-label="Toggle Follow Trade"
              onClick={() => {
                const nextValue = !followTradeEnabled;
                onFollowTradeEnabledChange(nextValue);
                if (nextValue) {
                  setIsFollowTradeConfigOpen(true);
                }
              }}
              className="bg-surface-control data-[checked=true]:bg-primary-medium relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              data-checked={followTradeEnabled}
            >
              <span
                aria-hidden
                className="bg-background-main absolute top-1/2 h-3 w-4 -translate-y-1/2 rounded-full transition-all"
                style={{
                  left: followTradeEnabled ? "calc(100% - 19px)" : "3px",
                }}
              />
            </button>
          </div>

          {isFollowTradeConfigExpanded && (
            <div className="mt-2 space-y-2 pl-6">
              <p className="text-text-sub text-xs tracking-[-0.01em]">
                KOLs you follow. Toggle each one to include or exclude their
                follow trades on grid.
              </p>

              {isFollowTradeLoading ? (
                <p className="text-text-sub text-xs tracking-[-0.01em]">
                  Loading followed KOLs...
                </p>
              ) : hasFollowTradeTargets ? (
                <div className="space-y-1.5">
                  {followTradeTargets.map((target) => (
                    <div
                      key={target.id}
                      className="bg-background-main/40 border-border-main flex items-center justify-between gap-2 rounded-[6px] border px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="text-text-heading truncate text-xs font-semibold tracking-[-0.01em]">
                          {target.label}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={target.enabled}
                        aria-label={`Toggle ${target.label}`}
                        disabled={!followTradeEnabled}
                        onClick={() =>
                          onFollowTradeTargetEnabledChange(
                            target.id,
                            !target.enabled,
                          )
                        }
                        className="bg-surface-control data-[checked=true]:bg-primary-medium relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        data-checked={target.enabled}
                      >
                        <span
                          aria-hidden
                          className="bg-background-main absolute top-1/2 h-3 w-4 -translate-y-1/2 rounded-full transition-all"
                          style={{
                            left: target.enabled ? "calc(100% - 19px)" : "3px",
                          }}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-sub text-xs tracking-[-0.01em]">
                  You are not following any KOL yet.
                </p>
              )}
            </div>
          )}
        </div>
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
