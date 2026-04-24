import Title from "@/src/components/common/Title";
import OverviewCard from "@/src/features/portfolio/components/OverviewCard";
import TradingHistoryTable from "@/src/features/portfolio/components/TradingHistoryTable";
import WalletActionPanel from "@/src/features/portfolio/components/WalletActionPanel";
import Image from "next/image";

const overviewCards = [
  { label: "Total Vol", value: "$4,250" },
  { label: "Win Rate", value: "68.4%", valueClassName: "text-success-medium" },
  {
    label: "+Edge Earned",
    value: "$14.20",
    valueClassName: "text-primary-medium",
  },
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
      <div className="flex flex-col gap-4">
        <Title>Portfolio1</Title>
        <WalletActionPanel />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {overviewCards.map((card) => (
          <OverviewCard key={card.label} {...card} />
        ))}
      </div>

      <TradingHistoryTable />
    </div>
  );
};

export default Portfolio;
