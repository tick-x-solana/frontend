"use client";

import { useEffect } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/shadcn/button";
import CopyTradeProfileCard, {
  type CopyTradeProfile,
} from "@/src/features/referrals/components/CopyTradeProfileCard";

const REFERRAL_CODE_STORAGE_KEY = "tickx-referral-code";

const COPY_TRADE_PROFILES: CopyTradeProfile[] = [
  {
    initials: "AS",
    name: "Paul Laverick",
    slots: "12/24",
    winRate: "68%",
    roi: "+24.5%",
    pnl7d: "+343.5",
  },
];

type ReferralCopyTradingPageProps = {
  refCode: string;
};

const ReferralCopyTradingPage = ({ refCode }: ReferralCopyTradingPageProps) => {
  const router = useRouter();

  useEffect(() => {
    window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, refCode);
  }, [refCode]);

  return (
    <section className="bg-background-main mx-auto flex min-h-[100dvh] w-full max-w-[393px] flex-col">
      <div className="flex flex-col gap-2 px-4 pt-5 pb-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="bg-surface-overlay-subtle hover:bg-surface-overlay-medium text-text-heading size-10 rounded-[8px] border border-transparent p-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Button>

        <h1 className="text-text-heading text-2xl font-semibold tracking-[-0.01em]">
          Copy Trading
        </h1>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex flex-col gap-4">
          {COPY_TRADE_PROFILES.map((profile, index) => (
            <CopyTradeProfileCard
              key={`${profile.name}-${index}`}
              profile={profile}
              isFavorite={index === 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ReferralCopyTradingPage;
export { REFERRAL_CODE_STORAGE_KEY };
