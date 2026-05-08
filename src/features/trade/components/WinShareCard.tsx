"use client";

import React from "react";
import Image from "next/image";
import {
  formatFixedTwoDecimal,
  formatCompactNumber,
  formatUpToOneDecimalNumber,
} from "@/src/utils/formatters";

type WinShareCardProps = {
  marketSymbol: string;
  multiplier: number;
  amount: number;
  openedAt: string;
  profit: number;
  currencySymbol?: string;
};

function toFiniteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export const WinShareCard = React.forwardRef<HTMLDivElement, WinShareCardProps>(
  function WinShareCard(
    {
      marketSymbol,
      multiplier,
      amount,
      openedAt,
      profit,
      currencySymbol = "$",
    },
    ref,
  ) {
    const safeMultiplier = toFiniteNumber(multiplier);
    const safeAmount = toFiniteNumber(amount);
    const safeProfit = toFiniteNumber(profit);
    const pnlPercent = Math.max((safeMultiplier - 1) * 100, 0);
    const receivedAmount = safeAmount * Math.max(safeMultiplier, 0);
    const fadedRates = [
      { value: "1.1x", col: 2, row: 0 },
      { value: "2.42x", col: 3, row: 0 },
      { value: "4.42x", col: 4, row: 0 },
      { value: "0.5x", col: 3, row: 1 },
      { value: "1.42x", col: 4, row: 1 },
      { value: "1.5x", col: 2, row: 2 },
      { value: "1.6x", col: 3, row: 2 },
      { value: "1.1x", col: 4, row: 2 },
    ] as const;

    return (
      <div
        ref={ref}
        className="bg-background-main border-border-main w-full border-t px-5 pt-8 pb-5 font-mono"
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-2">
              <div className="bg-surface-overlay-strong inline-flex items-center rounded-[8px] px-1 py-1">
                <span className="bg-surface-overlay-medium text-text-heading rounded-[6px] px-2 py-0.5 text-sm font-semibold tracking-[-0.01em]">
                  {marketSymbol}
                </span>
              </div>
              <p className="text-text-sub text-sm tracking-[-0.01em]">
                {openedAt}
              </p>
            </div>
            <div className="text-right">
              <p className="text-text-sub text-sm tracking-[-0.01em] uppercase">
                Profit
              </p>
              <p className="text-success-medium text-[24px] font-semibold tracking-[-0.01em]">
                +{currencySymbol}
                {formatFixedTwoDecimal(safeProfit)}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <div className="min-w-0 flex-1 text-center">
              <p className="text-primary-light text-[20px] font-semibold tracking-[-0.01em]">
                {currencySymbol}
                {formatFixedTwoDecimal(safeAmount)}
              </p>
              <p className="text-text-sub text-sm tracking-[-0.01em]">Amount</p>
            </div>

            <div className="bg-grid-line mx-3 h-12 w-px" aria-hidden />

            <div className="min-w-0 flex-1 text-center">
              <p className="text-primary-light text-[20px] font-semibold tracking-[-0.01em]">
                {safeMultiplier.toFixed(2)}x
              </p>
              <p className="text-text-sub text-sm tracking-[-0.01em]">
                Multiplier
              </p>
            </div>

            <div className="bg-grid-line mx-3 h-12 w-px" aria-hidden />

            <div className="min-w-0 flex-1 text-center">
              <p className="text-primary-light text-[20px] font-semibold tracking-[-0.01em]">
                +{formatUpToOneDecimalNumber(pnlPercent)}%
              </p>
              <p className="text-text-sub text-sm tracking-[-0.01em]">PNL</p>
            </div>
          </div>

          <div className="border-border-main bg-background-grid relative h-[207px] overflow-hidden rounded-[16px] border">
            <div className="absolute inset-0 bg-[radial-gradient(90%_120%_at_50%_45%,rgb(18_221_255_/_0.14)_0%,transparent_58%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-grid-line)_1px,transparent_1px)] bg-[size:25%_100%,100%_33.333%] opacity-45" />
            <div className="absolute inset-0 shadow-[inset_-8px_-8px_16px_#040b18,inset_8px_8px_16px_#040b18]" />

            <div className="absolute top-[54px] left-[124px] h-[104px] w-[106px] rounded-[20px] bg-[rgb(17_211_68_/_0.20)] blur-[4.7px]" />
            <div className="absolute top-[64px] left-[135px] h-[84px] w-[86px] rounded-[16px] bg-[rgb(17_211_68_/_0.20)]" />
            {fadedRates.map((rate) => (
              <p
                key={`${rate.value}-${rate.col}-${rate.row}`}
                aria-hidden
                className="text-grid-axis pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[12px] font-medium tracking-[-0.01em] opacity-30"
                style={{
                  left: `calc((100% / 4) * ${rate.col - 0.5})`,
                  top: `calc((100% / 3) * ${rate.row + 0.5})`,
                }}
              >
                {rate.value}
              </p>
            ))}

            <div className="border-success-medium absolute top-[70px] left-[140px] flex h-[68px] w-[71px] flex-col items-center justify-center rounded-[8px] border bg-[#0a151a] shadow-[0_0_16.5px_rgb(0_229_255_/_0.25),0_0_24.8px_rgb(0_229_255_/_0.25),inset_0_0_16.8px_rgb(0_229_255_/_0.25)]">
              <p className="text-success-medium text-[16px] font-extrabold tracking-[-0.01em]">
                +{currencySymbol}
                {formatCompactNumber(receivedAmount)}
              </p>
              <p className="text-text-disabled text-[11px] tracking-[-0.01em]">
                {safeMultiplier.toFixed(2)}x
              </p>
            </div>

            <Image
              src="/penguin-moscot.png"
              alt="TickX penguin mascot"
              width={150}
              height={150}
              className="pointer-events-none absolute bottom-1 left-[-12px] h-[150px] w-[150px] object-contain opacity-95 drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>
      </div>
    );
  },
);
