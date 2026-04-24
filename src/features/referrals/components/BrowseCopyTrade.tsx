import { ChevronRight, Star, UsersRound } from "lucide-react";
import { Button } from "@/src/components/shadcn/button";

type CopyTradeProfile = {
  initials: string;
  name: string;
  slots: string;
  winRate: string;
  roi: string;
  pnl7d: string;
};

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

const CopyTradeCard = ({ profile }: { profile: CopyTradeProfile }) => {
  return (
    <article className="border-border-main bg-surface-card flex flex-col gap-3 rounded-[8px] border p-4">
      <div className="flex items-start gap-3">
        <div className="relative">
          <div className="bg-primary-light text-text-inverse flex size-8 items-center justify-center rounded-full text-sm font-medium">
            {profile.initials}
          </div>
          <span className="bg-accent-blue absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border border-background-main text-[11px] font-semibold text-white">
            +
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-text-heading truncate text-base font-semibold">
            {profile.name}
          </p>
          <div className="bg-surface-overlay-subtle mt-1 flex w-max items-center gap-1 rounded-[4px] px-1 py-0.5">
            <UsersRound className="text-hint size-3.5" aria-hidden="true" />
            <span className="text-text-sub text-sm font-medium">
              {profile.slots}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-hint hover:bg-surface-overlay-subtle hover:text-primary-light size-6 rounded-[5px] p-0"
          aria-label={`Favorite ${profile.name}`}
        >
          <Star className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="bg-border-main h-px w-full" />

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-text-sub text-sm font-medium">Win rate</p>
          <p className="text-success-medium text-sm font-semibold">
            {profile.winRate}
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-text-sub text-sm font-medium">ROI</p>
          <p className="text-text-heading text-sm font-semibold">
            {profile.roi}
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-text-sub text-sm font-medium">7D PnL</p>
          <p className="text-text-heading text-sm font-semibold">
            {profile.pnl7d}
          </p>
        </div>
      </div>

      <Button
        type="button"
        className="bg-primary-light text-text-inverse hover:bg-primary-light/90 h-11 w-full rounded-[8px] text-sm font-medium"
      >
        Copy Trade
      </Button>
    </article>
  );
};

const BrowseCopyTrade = () => {
  return (
    <section className="flex flex-col gap-4 pb-4">
      <header className="flex items-center justify-between">
        <h2 className="text-text-heading text-base font-semibold">Copy Trade</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-hint hover:bg-surface-overlay-subtle hover:text-primary-light size-6 rounded-[5px] p-0"
          aria-label="View all copy trade profiles"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </header>

      {COPY_TRADE_PROFILES.map((profile, index) => (
        <CopyTradeCard
          key={`${profile.name}-${index}`}
          profile={profile}
        />
      ))}
    </section>
  );
};

export default BrowseCopyTrade;
