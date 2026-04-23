import { TradingGrid } from "@/src/features/trade/components/TradingGrid";

export default function Home() {
  return (
    <div className="bg-background-main flex h-full flex-1 flex-col">
      <div className="flex max-h-[calc(100vh-120px)] min-h-[calc(100vh-120px)] flex-1">
        {/* <BetInfo /> */}
        <TradingGrid />
      </div>
    </div>
  );
}
