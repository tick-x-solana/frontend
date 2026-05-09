"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, WalletMinimal, X } from "lucide-react";
import { useAuth } from "@/src/components/providers/AuthProvider";
import TradingOrdersPanel from "@/src/features/trade/components/TradingOrdersPanel";
import { Button } from "@/src/components/shadcn/button";
import { useGameStore } from "@/src/features/trade/store";
import useSolUsdPrice from "@/src/hooks/useSolUsdPrice";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  formatApproxUsd,
  formatCompactNumber,
  formatWalletAddress,
} from "@/src/utils/formatters";
import Image from "next/image";
import {
  BID_OPTIONS_SOL,
  MAX_CUSTOM_BID_SIZE_SOL,
  MIN_CUSTOM_BID_SIZE_SOL,
} from "@/src/features/trade/storeConstants";

type TradeControlsPanelProps = {
  className?: string;
  contentClassName?: string;
  marketSymbol?: string;
  displayPrice?: string;
  showMarketHeader?: boolean;
  showHandle?: boolean;
  showCloseButton?: boolean;
  showInlineOrders?: boolean;
  closeLabel?: string;
  onClose?: () => void;
  onAddFunds?: () => void;
};

export default function TradeControlsPanel({
  className,
  contentClassName,
  marketSymbol = "SOL/USDT",
  displayPrice = "--",
  showMarketHeader = false,
  showHandle = false,
  showCloseButton = true,
  showInlineOrders = true,
  closeLabel = "Close trade controls",
  onClose,
}: TradeControlsPanelProps) {
  const { walletAddress: rawAddress, username } = useAuth();
  const balance = useGameStore((s) => s.balance);
  const betAmount = useGameStore((s) => s.betAmount);
  const setBetAmount = useGameStore((s) => s.setBetAmount);
  const [customBidInput, setCustomBidInput] = useState(() => String(betAmount));
  const [isCustomBidEditorOpen, setIsCustomBidEditorOpen] = useState(false);
  const customBidEditorRef = useRef<HTMLDivElement | null>(null);
  const isDesktopOrdersVisible = useGameStore((s) => s.isDesktopOrdersVisible);
  const desktopOrdersQueryAnchorTime = useGameStore(
    (s) => s.desktopOrdersQueryAnchorTime,
  );
  const { data: solUsdPrice } = useSolUsdPrice();
  const selectedBid = BID_OPTIONS_SOL.find(
    (amount) => Math.abs(amount - betAmount) < 1e-9,
  );
  const currentBid = selectedBid ?? betAmount;
  const isUsingCustomBid = selectedBid === undefined;
  const displayIdentity = username?.trim()
    ? `@${username.trim()}`
    : formatWalletAddress(rawAddress);

  const marketPriceLabel =
    displayPrice === "--" ? displayPrice : `~ ${displayPrice}`;
  const selectedBidApproxUsd = formatApproxUsd(
    currentBid,
    typeof solUsdPrice === "number" && Number.isFinite(solUsdPrice)
      ? solUsdPrice
      : null,
    { includeApproxPrefix: true },
  );
  const applyCustomBid = useCallback(() => {
    const parsedBid = Number(customBidInput.trim());
    if (!Number.isFinite(parsedBid)) {
      toast.error("Enter a valid bid size.");
      return;
    }
    if (parsedBid < MIN_CUSTOM_BID_SIZE_SOL || parsedBid > MAX_CUSTOM_BID_SIZE_SOL) {
      toast.error(
        `Custom bid size must be between ${MIN_CUSTOM_BID_SIZE_SOL} and ${MAX_CUSTOM_BID_SIZE_SOL} SOL.`,
      );
      return;
    }
    setBetAmount(parsedBid);
    setCustomBidInput(String(parsedBid));
    setIsCustomBidEditorOpen(false);
  }, [customBidInput, setBetAmount]);

  const updateCustomBidByStep = useCallback(
    (direction: "up" | "down") => {
      const currentValue = Number(customBidInput.trim());
      const fallbackValue = Number.isFinite(currentValue) ? currentValue : betAmount;
      const delta = 0.01;
      const nextValue =
        direction === "up" ? fallbackValue + delta : fallbackValue - delta;
      const boundedValue = Math.max(
        MIN_CUSTOM_BID_SIZE_SOL,
        Math.min(MAX_CUSTOM_BID_SIZE_SOL, Number(nextValue.toFixed(3))),
      );
      setCustomBidInput(String(boundedValue));
    },
    [betAmount, customBidInput],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCustomBidInput(String(betAmount));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [betAmount]);

  useEffect(() => {
    if (!isCustomBidEditorOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        customBidEditorRef.current &&
        !customBidEditorRef.current.contains(event.target as Node)
      ) {
        setIsCustomBidEditorOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isCustomBidEditorOpen]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {showHandle ? (
        <div className="flex justify-center">
          <span className="bg-grid-axis/70 h-1 w-20 rounded-full" aria-hidden />
        </div>
      ) : null}

      {showMarketHeader ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1">
            <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://www.figma.com/api/mcp/asset/8288bcec-4cf7-4aac-9bc8-8171c8d588b7"
                alt=""
                className="h-full w-full object-contain"
              />
            </span>
            <span className="truncate text-base font-semibold tracking-[-0.01em] text-white">
              {marketSymbol}
            </span>
            <span className="text-text-sub truncate text-sm font-medium tracking-[-0.01em]">
              {marketPriceLabel}
            </span>
          </div>
          {onClose && showCloseButton ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="text-text-sub hover:bg-surface-control size-8 rounded-full border border-transparent bg-transparent p-0 shadow-none hover:text-white"
              aria-label={closeLabel}
            >
              <X className="size-4" strokeWidth={1.75} />
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className={cn("flex min-h-0 flex-col gap-4", contentClassName)}>
        <section className="bg-background-surface flex items-center gap-3 rounded-[8px] p-2">
          <div className="bg-background-subtle flex size-10 shrink-0 items-center justify-center rounded-[8px]">
            <WalletMinimal
              className="text-primary-light size-5"
              strokeWidth={1.8}
            />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <p className="text-text-main truncate text-sm font-medium tracking-[-0.01em]">
                {displayIdentity}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="text-hint text-xs font-semibold tracking-[-0.01em]">
                Balance:
              </p>
              <p className="text-primary-light flex items-center gap-1 font-mono text-sm font-bold tracking-[-0.01em]">
                {formatCompactNumber(balance)} SOL
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-between gap-3">
          <p className="text-hint text-xs font-semibold tracking-[-0.01em]">
            BID SIZE
          </p>
          <div className="flex items-center gap-2">
            <Image src="/sol.png" alt="SOL" width={16} height={16} />
            <div className="flex items-center gap-1">
              <p className="text-text-main text-sm font-medium tracking-[-0.01em]">
                {currentBid} SOL
              </p>
              {selectedBidApproxUsd ? (
                <p className="text-text-sub text-xs font-medium tracking-[-0.01em]">
                  ({selectedBidApproxUsd})
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section ref={customBidEditorRef} className="relative">
          <div className="flex items-center gap-2">
            {BID_OPTIONS_SOL.map((amountSol) => {
              const isSelected = selectedBid === amountSol;
              return (
                <Button
                  key={amountSol}
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-9 flex-1 rounded-[8px] border px-0 text-sm font-medium tracking-[-0.01em] shadow-none transition-colors",
                    isSelected
                      ? "border-border-primary bg-surface-selected text-text-link-main hover:bg-surface-control-active hover:text-primary-light"
                      : "border-border-main bg-background-main text-text-main hover:bg-surface-overlay-medium hover:text-text-heading",
                  )}
                  onClick={() => {
                    setBetAmount(amountSol);
                    setCustomBidInput(String(amountSol));
                  }}
                >
                  {amountSol}
                </Button>
              );
            })}
          </div>

          {!isCustomBidEditorOpen ? (
            <div className="mt-2">
              <Button
                type="button"
                className="text-primary-light border-border-primary h-10 w-full rounded-[10px] border bg-[linear-gradient(120deg,rgba(208,247,220,0.16),rgba(127,216,154,0.08))] text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 hover:bg-[linear-gradient(120deg,rgba(208,247,220,0.24),rgba(127,216,154,0.14))] hover:text-text-heading"
                onClick={() => setIsCustomBidEditorOpen(true)}
              >
                Custom bid
              </Button>
            </div>
          ) : null}

          <div
            className={cn(
              "bg-surface-card w-full overflow-hidden rounded-[12px] border border-border-main p-4 shadow-[20px_0_40px_rgba(0,0,0,0.4)] transition-all duration-300 ease-out",
              isCustomBidEditorOpen
                ? "pointer-events-auto mt-2 max-h-[420px] translate-x-0 translate-y-0 opacity-100 blur-0"
                : "pointer-events-none mt-0 max-h-0 -translate-x-1 -translate-y-1 opacity-0 blur-[2px]",
            )}
            aria-hidden={!isCustomBidEditorOpen}
          >
            <p className="text-text-heading text-base font-semibold tracking-[-0.01em]">
              Custom bid
            </p>
            <p className="text-text-sub mt-1 text-sm tracking-[-0.01em]">
              Set your manual SOL amount.
            </p>

            <div className="mt-4 rounded-[10px] border border-border-main bg-background-surface p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-text-sub text-xs font-semibold tracking-[-0.01em]">
                  BID SIZE
                </p>
                {isUsingCustomBid ? (
                  <span className="text-primary-light inline-flex items-center gap-1 rounded-[999px] bg-primary-light/12 px-2 py-0.5 text-[11px] font-semibold tracking-[-0.01em]">
                    <Check className="size-3" />
                    Active
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-border-main bg-background-main text-text-main hover:bg-surface-overlay-medium h-9 w-9 rounded-[8px] shadow-none"
                  onClick={() => updateCustomBidByStep("down")}
                >
                  <Minus className="size-4" />
                </Button>

                <div className="border-border-main bg-background-main flex h-9 min-w-0 flex-1 items-center rounded-[8px] border px-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={MIN_CUSTOM_BID_SIZE_SOL}
                    max={MAX_CUSTOM_BID_SIZE_SOL}
                    step="0.001"
                    value={customBidInput}
                    onChange={(event) => setCustomBidInput(event.target.value)}
                    placeholder="Enter SOL amount"
                    className="text-text-main placeholder:text-hint w-full bg-transparent text-sm font-medium outline-none"
                  />
                  <span className="text-text-sub ml-2 text-xs font-semibold">SOL</span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-border-main bg-background-main text-text-main hover:bg-surface-overlay-medium h-9 w-9 rounded-[8px] shadow-none"
                  onClick={() => updateCustomBidByStep("up")}
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <p className="text-hint mt-2 text-[11px] tracking-[-0.01em]">
                Range {MIN_CUSTOM_BID_SIZE_SOL} - {MAX_CUSTOM_BID_SIZE_SOL}
              </p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-[8px] px-3"
                onClick={() => setIsCustomBidEditorOpen(false)}
              >
                Close
              </Button>
              <Button type="button" className="h-9 rounded-[8px] px-3" onClick={applyCustomBid}>
                Apply
              </Button>
            </div>
          </div>
        </section>

        {showInlineOrders && isDesktopOrdersVisible ? (
          <TradingOrdersPanel
            fallbackMarketLabel={marketSymbol}
            inline
            queryAnchorTime={desktopOrdersQueryAnchorTime}
          />
        ) : null}
      </div>
    </div>
  );
}
