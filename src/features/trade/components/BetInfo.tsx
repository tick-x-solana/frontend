"use client";

import TradeControlsPanel from "@/src/features/trade/components/TradeControlsPanel";

export default function BetInfo() {
  return (
    <aside className="border-border-main bg-background-main flex w-[300px] shrink-0 flex-col border-r px-5 py-5">
      <TradeControlsPanel />
    </aside>
  );
}
