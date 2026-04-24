"use client";

import React from "react";
import Image from "next/image";

type WinShareCardProps = {
  marketSymbol: string;
  multiplier: number;
  amount: number;
  openedAt: string;
  profit: number;
};

const amountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export const WinShareCard = React.forwardRef<HTMLDivElement, WinShareCardProps>(
  function WinShareCard({ marketSymbol, multiplier, amount, openedAt, profit }, ref) {
    const pnlPercent = Math.max((multiplier - 1) * 100, 0);

    return (
      <div
        ref={ref}
        className="bg-background-main border-border-main w-full rounded-t-[16px] border-t px-5 pt-8 pb-5 font-mono"
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
                +${amountFormatter.format(profit)}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <div className="min-w-0 flex-1 text-center">
              <p className="text-primary-light text-[20px] font-semibold tracking-[-0.01em]">
                ${amountFormatter.format(amount)}
              </p>
              <p className="text-text-sub text-sm tracking-[-0.01em]">Amount</p>
            </div>

            <div className="bg-grid-line mx-3 h-12 w-px" aria-hidden />

            <div className="min-w-0 flex-1 text-center">
              <p className="text-primary-light text-[20px] font-semibold tracking-[-0.01em]">
                {multiplier.toFixed(2)}x
              </p>
              <p className="text-text-sub text-sm tracking-[-0.01em]">
                Multiplier
              </p>
            </div>

            <div className="bg-grid-line mx-3 h-12 w-px" aria-hidden />

            <div className="min-w-0 flex-1 text-center">
              <p className="text-primary-light text-[20px] font-semibold tracking-[-0.01em]">
                +{percentFormatter.format(pnlPercent)}%
              </p>
              <p className="text-text-sub text-sm tracking-[-0.01em]">PNL</p>
            </div>
          </div>

          <div className="relative h-[207px] overflow-hidden rounded-[12px] border border-border-main bg-background-grid">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_54%_42%,rgb(17_211_68_/_0.22)_0%,transparent_52%)]" />
            <div className="bg-grid-line/40 absolute inset-0 bg-[linear-gradient(to_right,transparent_0,transparent_24.5%,var(--color-grid-line)_25%,transparent_25.5%,transparent_49.5%,var(--color-grid-line)_50%,transparent_50.5%,transparent_74.5%,var(--color-grid-line)_75%,transparent_75.5%),linear-gradient(to_bottom,transparent_0,transparent_32.5%,var(--color-grid-line)_33%,transparent_33.5%,transparent_66.5%,var(--color-grid-line)_67%,transparent_67.5%)] opacity-50" />

            <svg
              viewBox="0 0 360 207"
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <filter id="share-curve-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d="M6 160 C16 200,48 200,70 150 C90 102,120 96,152 122"
                stroke="var(--color-success-light)"
                strokeWidth="3.2"
                fill="none"
                filter="url(#share-curve-glow)"
                strokeLinecap="round"
              />
              <circle cx="152" cy="122" r="5.5" fill="var(--color-success-light)" />
            </svg>

            <div className="absolute top-1/2 left-1/2 flex h-[74px] w-[78px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[9px] border border-success-medium bg-background-main shadow-[0_0_20px_rgb(17_211_68_/_0.36),0_0_28px_rgb(18_221_255_/_0.28),inset_0_0_18px_rgb(18_221_255_/_0.22)]">
              <p className="text-success-medium text-[16px] font-extrabold tracking-[-0.01em]">
                ${amountFormatter.format(amount)}
              </p>
              <p className="text-text-sub text-xs tracking-[-0.01em]">
                {multiplier.toFixed(2)}x
              </p>
            </div>

            <Image
              src="/penguin.png"
              alt="Penguin mascot"
              width={80}
              height={80}
              className="absolute bottom-2 left-2 h-20 w-20 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>
      </div>
    );
  },
);
