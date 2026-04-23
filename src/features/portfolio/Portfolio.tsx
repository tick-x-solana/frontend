import ActiveTab from "@/src/components/common/ActiveTab";
import Title from "@/src/components/common/Title";
import ActivePredictionCard from "@/src/features/portfolio/components/ActivePredictionCard";
import OverviewCard from "@/src/features/portfolio/components/OverviewCard";
import Image from "next/image";
import { Suspense } from "react";

const portfolioTabs = [
  { label: "Active Predictions", value: "active" },
  { label: "Trading History", value: "signals" },
];

const overviewCards = [
  { label: "Total Vol", value: "$4,250" },
  { label: "Win Rate", value: "68.4%", valueColor: "#11d344" },
  { label: "+Edge Earned", value: "$14.20", valueColor: "#a8e8bb" },
];

const Portfolio = () => {
  return (
    <div className="bg-background-main relative flex-col gap-4 overflow-hidden px-4 py-4 md:gap-6 md:px-10 xl:gap-8 xl:px-20">
      <Image
        src="/line-background.svg"
        alt="tickx"
        width={100}
        height={100}
        className="pointer-events-none absolute top-[100px] z-0 h-full w-full object-cover opacity-50"
      />
      <div className="flex flex-col gap-4 md:flex-row md:items-center xl:gap-10">
        <Title>Portfolio</Title>
        <Suspense
          fallback={
            <div className="h-10 w-[280px] rounded-xl bg-[rgba(255,255,255,0.04)]" />
          }
        >
          <ActiveTab listTabs={portfolioTabs} />
        </Suspense>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {overviewCards.map((card) => (
          <OverviewCard key={card.label} {...card} />
        ))}
      </div>

      {/* Active Predictions */}
      <div className="flex items-center gap-3">
        <Title>Active Predictions</Title>
        <p className="text-hint text-xl font-semibold">3</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {Array.from(new Array(3)).map((_, index) => (
          <ActivePredictionCard
            key={index}
            pair="BTC/USD"
            placedAt="10:06:00 AM"
            expectedIn="15:00"
            multiplier="2.5x"
            status="In Progress"
            currentPrice="$3,008.40"
            targetPrice="$3,020"
            progress={0.56}
          />
        ))}
      </div>
    </div>
  );
};

export default Portfolio;
