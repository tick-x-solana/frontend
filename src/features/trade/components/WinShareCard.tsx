"use client";

import React from "react";
import { ShieldCheck, Star, Users } from "lucide-react";

type WinShareCardProps = {
  marketSymbol: string;
  multiplier: number;
  amount: number;
  userName?: string;
};

const metricValueFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const WinShareCard = React.forwardRef<HTMLDivElement, WinShareCardProps>(
  function WinShareCard(
    { marketSymbol, multiplier, amount, userName = "TickX Trader" },
    ref,
  ) {
    const pnl = amount * Math.max(multiplier - 1, 0);

    return (
      <div
        ref={ref}
        className="bg-background-main border-border-main w-full max-w-[360px] rounded-[8px] border p-4 font-mono"
      >
        <div className="flex items-start gap-3">
          <div className="bg-primary-light relative flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white">
            {userName.slice(0, 2).toUpperCase()}
            <span className="bg-grid-accent absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full text-[#042130]">
              <ShieldCheck className="size-3" strokeWidth={2.6} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-white">
              {userName}
            </p>
            <div className="bg-surface-overlay-subtle text-text-sub mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium">
              <Users className="size-3.5" strokeWidth={2.2} />
              12/24
            </div>
          </div>
          <button
            type="button"
            className="text-text-sub flex size-6 items-center justify-center rounded-[5px]"
            aria-label="Favorite"
          >
            <Star className="size-4.5" strokeWidth={2} />
          </button>
        </div>

        <div className="bg-border-main/70 my-3 h-px w-full" />

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-text-sub">Win rate</p>
            <p className="text-sm font-semibold text-[#11D344]">68%</p>
          </div>
          <div>
            <p className="text-text-sub">ROI</p>
            <p className="text-sm font-semibold text-white">
              +{metricValueFormatter.format((multiplier - 1) * 100)}%
            </p>
          </div>
          <div>
            <p className="text-text-sub">7D PnL</p>
            <p className="text-sm font-semibold text-white">
              +{metricValueFormatter.format(pnl)}
            </p>
          </div>
        </div>

        <div className="bg-primary-light mt-3 rounded-[8px] px-3 py-2 text-center text-sm font-medium text-[#05240e]">
          {marketSymbol} • {multiplier.toFixed(2)}x • $
          {amount.toFixed(2)}
        </div>
      </div>
    );
  },
);
