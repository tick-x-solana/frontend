"use client";

import { WalletMinimal, X } from "lucide-react";
import WldMarketIcon from "@/src/assets/icons/wld-market.svg";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Button } from "@/src/components/shadcn/button";
import { useGameStore } from "@/src/features/trade/store";
import { cn } from "@/lib/utils";

const USD_PER_WLD = 0.26;
const BID_OPTIONS = [0.26, 0.52, 0.78, 1.04];

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatCompactNumber = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatWalletAddress = (address: string | null) => {
  if (!address) return "Not connected";
  if (!address.startsWith("0x") || address.length < 14) return address;
  return `${address.slice(0, 7)}...${address.slice(-7)}`;
};

type TradeControlsPanelProps = {
  className?: string;
  contentClassName?: string;
  marketSymbol?: string;
  displayPrice?: string;
  showMarketHeader?: boolean;
  showHandle?: boolean;
  closeLabel?: string;
  onClose?: () => void;
  onAddFunds?: () => void;
};

export default function TradeControlsPanel({
  className,
  contentClassName,
  marketSymbol = "BTC/USD",
  displayPrice = "--",
  showMarketHeader = false,
  showHandle = false,
  closeLabel = "Close trade controls",
  onClose,
  onAddFunds,
}: TradeControlsPanelProps) {
  const { walletAddress: rawAddress } = useAuth();
  const balance = useGameStore((s) => s.balance);
  const betAmount = useGameStore((s) => s.betAmount);
  const setBetAmount = useGameStore((s) => s.setBetAmount);

  const selectedBid = BID_OPTIONS.includes(betAmount)
    ? betAmount
    : BID_OPTIONS[0];
  const walletAddress = formatWalletAddress(rawAddress);
  const balanceInWld = balance / USD_PER_WLD;
  const bidSizeInWld = selectedBid / USD_PER_WLD;
  const marketPriceLabel =
    displayPrice === "--" ? displayPrice : `~ ${displayPrice}`;

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
            <span className="truncate text-sm font-medium tracking-[-0.01em] text-text-sub">
              {marketPriceLabel}
            </span>
          </div>
          {onClose ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="text-text-sub hover:bg-surface-control hover:text-white size-8 rounded-full border border-transparent bg-transparent p-0 shadow-none"
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
            <WalletMinimal className="text-primary-light size-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-[-0.01em] text-text-main">
              {walletAddress}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="text-hint text-xs font-semibold tracking-[-0.01em]">
                Balance:
              </p>
              <p className="text-primary-light font-mono text-sm font-bold tracking-[-0.01em]">
                {formatMoney(balance)} ({formatCompactNumber(balanceInWld)} WLD)
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-between gap-3">
          <p className="text-hint text-xs font-semibold tracking-[-0.01em]">
            BID SIZE
          </p>
          <div className="flex items-center gap-2">
            <WldMarketIcon aria-hidden className="size-4" />
            <p className="text-text-main text-sm font-medium tracking-[-0.01em]">
              {bidSizeInWld.toFixed(0)} WLD ~ {formatMoney(selectedBid)}
            </p>
          </div>
        </section>

        <section className="flex items-center gap-2">
          {BID_OPTIONS.map((amount) => {
            const isSelected = selectedBid === amount;
            return (
              <Button
                key={amount}
                type="button"
                variant="outline"
                className={cn(
                  "h-9 flex-1 rounded-[8px] border px-0 text-sm font-medium tracking-[-0.01em] shadow-none",
                  isSelected
                    ? "border-border-primary bg-surface-selected text-text-link-main hover:bg-surface-selected"
                    : "border-border-main bg-background-main text-text-main hover:bg-surface-overlay-subtle",
                )}
                onClick={() => setBetAmount(amount)}
              >
                {formatMoney(amount)}
              </Button>
            );
          })}
        </section>

        <section>
          <Button
            type="button"
            onClick={onAddFunds}
            className="bg-primary-light text-text-inverse hover:bg-primary-medium h-11 w-full rounded-[8px] px-4 text-sm font-medium tracking-[-0.01em] shadow-none"
          >
            Add Funds
          </Button>
        </section>
      </div>
    </div>
  );
}
