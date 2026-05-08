"use client";

import Title from "@/src/components/common/Title";
import { useAuth } from "@/src/components/providers/AuthProvider";
import OverviewCard from "@/src/features/portfolio/components/OverviewCard";
import TradingHistoryTable from "@/src/features/portfolio/components/TradingHistoryTable";
import WalletActionPanel from "@/src/features/portfolio/components/WalletActionPanel";
import { useLeaderboardControllerGetMyStats } from "@/src/services/queries";
import type { LeaderboardStatsDto } from "@/src/services/models";
import {
  formatOneDecimalNumber,
  formatUsdCurrency,
  formatUsdCurrencyFixedTwo,
} from "@/src/utils/formatters";
import Image from "next/image";
import { useMemo } from "react";

function toFiniteNumber(value: string | null | undefined): number {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function extractLeaderboardStats(
  value: unknown,
): Partial<LeaderboardStatsDto> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.totalVolume === "string" ||
    typeof record.winRate === "string" ||
    typeof record.pnl === "string"
  ) {
    return record as Partial<LeaderboardStatsDto>;
  }

  if (record.data && typeof record.data === "object") {
    const nestedRecord = record.data as Record<string, unknown>;

    if (
      typeof nestedRecord.totalVolume === "string" ||
      typeof nestedRecord.winRate === "string" ||
      typeof nestedRecord.pnl === "string"
    ) {
      return nestedRecord as Partial<LeaderboardStatsDto>;
    }
  }

  return null;
}

const Portfolio = () => {
  const { walletAddress } = useAuth();
  const { data: myStatsResponse } = useLeaderboardControllerGetMyStats({
    query: {
      enabled: Boolean(walletAddress),
    },
  });

  const overviewCards = useMemo(() => {
    const stats = extractLeaderboardStats(myStatsResponse);
    const totalVolume = toFiniteNumber(stats?.totalVolume);
    const winRate = toFiniteNumber(stats?.winRate);
    const pnl = toFiniteNumber(stats?.pnl);

    return [
      { label: "Total Vol", value: formatUsdCurrency(totalVolume) },
      {
        label: "Win Rate",
        value: `${formatOneDecimalNumber(winRate)}%`,
        valueClassName: "text-success-medium",
      },
      {
        label: "+Edge Earned",
        value: formatUsdCurrencyFixedTwo(pnl),
        valueClassName: pnl < 0 ? "text-destructive" : "text-primary-medium",
      },
    ];
  }, [myStatsResponse]);

  return (
    <div className="bg-background-main relative min-h-screen overflow-hidden px-4 py-4 md:px-10 xl:px-20">
      <Image
        src="/line-background.svg"
        alt="tickx"
        width={100}
        height={100}
        className="pointer-events-none absolute top-[100px] z-0 h-full w-full object-cover opacity-50"
      />

      <div className="relative z-10 flex flex-col gap-4 md:gap-6">
        <Title>Portfolio</Title>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          {/* Left sidebar: wallet + stats */}
          <div className="flex flex-col gap-3 lg:w-[380px] lg:shrink-0">
            <WalletActionPanel />

            {/* Stats overview */}
            <div className="border-border-main bg-background-surface rounded-[10px] border p-3">
              <p className="text-hint mb-2.5 text-[11px] font-medium tracking-[0.03em] uppercase">
                My Stats
              </p>
              <div className="grid grid-cols-3 gap-2">
                {overviewCards.map((card) => (
                  <OverviewCard key={card.label} {...card} />
                ))}
              </div>
            </div>
          </div>

          {/* Right main: trading history */}
          <div className="min-w-0 flex-1">
            <TradingHistoryTable />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
