"use client";

import Title from "@/src/components/common/Title";
import OverviewCard from "@/src/features/portfolio/components/OverviewCard";
import TradingHistoryTable from "@/src/features/portfolio/components/TradingHistoryTable";
import WalletActionPanel from "@/src/features/portfolio/components/WalletActionPanel";
import { usePortfolioStatsCards } from "@/src/features/portfolio/hooks/usePortfolioStats";
import Image from "next/image";

const Portfolio = () => {
  const overviewCards = usePortfolioStatsCards();

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
