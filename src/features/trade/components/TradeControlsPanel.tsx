"use client";

import { WalletMinimal, X } from "lucide-react";
import { useAuth } from "@/src/components/providers/AuthProvider";
import TradingOrdersPanel from "@/src/features/trade/components/TradingOrdersPanel";
import { Button } from "@/src/components/shadcn/button";
import { useGameStore } from "@/src/features/trade/store";
import useSolUsdPrice from "@/src/hooks/useSolUsdPrice";
import { cn } from "@/lib/utils";
import { useAuthControllerGetPublicProfile } from "@/src/services/queries";
import {
  formatApproxUsd,
  formatCompactNumber,
  formatWalletAddress,
} from "@/src/utils/formatters";
import Image from "next/image";
import { useMemo } from "react";

const BID_OPTIONS_SOL = [0.01, 0.03, 0.05, 0.1];

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
  const normalizedAddress = rawAddress?.trim().toLowerCase() ?? "";
  const balance = useGameStore((s) => s.balance);
  const betAmount = useGameStore((s) => s.betAmount);
  const setBetAmount = useGameStore((s) => s.setBetAmount);
  const isDesktopOrdersVisible = useGameStore((s) => s.isDesktopOrdersVisible);
  const desktopOrdersQueryAnchorTime = useGameStore(
    (s) => s.desktopOrdersQueryAnchorTime,
  );
  const { data: solUsdPrice } = useSolUsdPrice();
  const { data: publicProfileResponse } = useAuthControllerGetPublicProfile(
    { address: normalizedAddress },
    { query: { enabled: Boolean(normalizedAddress) } },
  );
  const hasVerifiedBadge = useMemo(() => {
    if (!publicProfileResponse || typeof publicProfileResponse !== "object")
      return false;
    const r = publicProfileResponse as {
      data?: { humanVerified?: boolean };
      humanVerified?: boolean;
    };
    return (r.data ?? r)?.humanVerified === true;
  }, [publicProfileResponse]);

  const selectedBid =
    BID_OPTIONS_SOL.find((amount) => Math.abs(amount - betAmount) < 1e-9) ??
    BID_OPTIONS_SOL[0];
  const displayIdentity = username?.trim()
    ? `@${username.trim()}`
    : formatWalletAddress(rawAddress);

  const marketPriceLabel =
    displayPrice === "--" ? displayPrice : `~ ${displayPrice}`;
  const selectedBidApproxUsd = formatApproxUsd(
    selectedBid,
    typeof solUsdPrice === "number" && Number.isFinite(solUsdPrice)
      ? solUsdPrice
      : null,
    { includeApproxPrefix: true },
  );

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

      <div className={cn("flex flex-col gap-4", contentClassName)}>
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
              {hasVerifiedBadge && (
                <Image
                  src="/onboarding/verified-badge.svg"
                  alt="Verified"
                  width={16}
                  height={16}
                  className="size-4 shrink-0"
                />
              )}
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
                {selectedBid} SOL
              </p>
              {selectedBidApproxUsd ? (
                <p className="text-text-sub text-xs font-medium tracking-[-0.01em]">
                  ({selectedBidApproxUsd})
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="flex items-center gap-2">
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
                onClick={() => setBetAmount(amountSol)}
              >
                {amountSol}
              </Button>
            );
          })}
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
