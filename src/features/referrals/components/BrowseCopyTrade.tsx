import { ChevronRight } from "lucide-react";
import { Button } from "@/src/components/shadcn/button";
import CopyTradeProfileCard, {
  type CopyTradeProfile,
} from "@/src/features/referrals/components/CopyTradeProfileCard";

const COPY_TRADE_PROFILES: CopyTradeProfile[] = [
  {
    initials: "AS",
    name: "Paul Laverick",
    slots: "12/24",
    winRate: "68%",
    roi: "+24.5%",
    pnl7d: "+343.5",
  },
  {
    initials: "AS",
    name: "Paul Laverick",
    slots: "12/24",
    winRate: "68%",
    roi: "+24.5%",
    pnl7d: "+343.5",
  },
];

const BrowseCopyTrade = () => {
  return (
    <section className="flex flex-col gap-4 pb-4">
      <header className="flex items-center justify-between">
        <h2 className="text-text-heading text-base font-semibold">Follow Trade</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-hint hover:bg-surface-overlay-subtle hover:text-primary-light size-6 rounded-[5px] p-0"
          aria-label="View all follow trade profiles"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </header>

      {COPY_TRADE_PROFILES.map((profile, index) => (
        <CopyTradeProfileCard key={`${profile.name}-${index}`} profile={profile} />
      ))}
    </section>
  );
};

export default BrowseCopyTrade;
