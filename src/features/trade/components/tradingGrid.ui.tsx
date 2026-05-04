import React from "react";
import Image from "next/image";
import { Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { WalletIcon } from "@/src/assets/icons";
import WldMarketIcon from "@/src/assets/icons/wld-market.svg";
import { Button } from "@/src/components/shadcn/button";
import { balanceFormatter, winAmountFormatter } from "./tradingGrid.constants";
import type { FakeWinToastData } from "./tradingGrid.utils";

type GridActionButtonProps = React.ComponentProps<typeof Button> & {
  active?: boolean;
};

export function GridActionButton({
  active = false,
  className,
  children,
  ...props
}: GridActionButtonProps) {
  return (
    <Button
      type="button"
      size="icon-lg"
      variant="ghost"
      className={cn(
        "border-border-main bg-background-surface text-text-sub hover:bg-surface-control pointer-events-auto h-9 w-9 rounded-[4px] border p-0 shadow-none hover:text-white",
        active &&
          "border-grid-accent bg-surface-control-active text-grid-accent hover:bg-surface-control-active hover:text-grid-accent",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

export function BalanceChip({ balance }: { balance: number }) {
  const safeBalance = Number.isFinite(balance) ? balance : 0;

  return (
    <div className="bg-surface-overlay-subtle border-border-main inline-flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5 backdrop-blur-[4px]">
      <span className="text-primary-light flex size-5 items-center justify-center">
        <WalletIcon className="size-3.5" aria-hidden="true" />
      </span>
      <p className="text-primary-light flex items-center gap-1 text-center text-xs font-bold tracking-[-0.01em] whitespace-nowrap">
        {balanceFormatter.format(safeBalance)} <WldMarketIcon aria-hidden className="size-3" />
      </p>
    </div>
  );
}

export function WinBetBanner({ data }: { data: FakeWinToastData }) {
  return (
    <div className="pumpfun-jitter bg-background-main/95 border-success-border flex max-w-[min(88vw,360px)] items-center gap-2 rounded-[12px] border px-2 py-1.5 shadow-[0_0_0_1px_rgb(17_211_68_/_0.12)_inset,0_8px_20px_rgb(3_9_16_/_0.42)]">
      <div className="bg-surface-overlay-medium border-border-main flex size-8 shrink-0 items-center justify-center rounded-[9px] border">
        <Rocket aria-hidden className="text-grid-accent size-4" />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <span className="text-text-heading truncate text-[14px] font-semibold tracking-[-0.01em]">
            {data.username}
          </span>
          <Image
            src="/onboarding/verified-badge.svg"
            alt="Verified human"
            width={16}
            height={16}
            className="h-4 w-4 shrink-0"
          />
        </div>
        <span className="bg-success-background text-success-light border-success-border rounded-[9px] border px-1.5 py-0.5 text-xs font-bold tracking-[-0.01em]">
          WIN
        </span>
      </div>

      <span className="pumpfun-flicker text-success-medium text-[14px] font-semibold tracking-[-0.02em] whitespace-nowrap">
        +${winAmountFormatter.format(data.amount)}
      </span>
    </div>
  );
}
