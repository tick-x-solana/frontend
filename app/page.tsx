import BetInfo from "@/src/features/trade/components/BetInfo";
import { TradingGrid } from "@/src/features/trade/components/TradingGrid";

export default function Home() {
  return (
    <div className="bg-background-main flex h-full flex-1 flex-col">
      <div className="flex max-h-[calc(100vh-64px-72px)] min-h-[calc(100vh-64px-72px)] flex-1">
        <div className="hidden md:block">
          <BetInfo />
        </div>

        <TradingGrid />
      </div>
    </div>
  );
}
