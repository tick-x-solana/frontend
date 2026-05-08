"use client";

import { Button } from "@/src/components/shadcn/button";

const ReferralsHeader = () => {
  return (
    <header className="flex flex-col gap-4">
      <div className="space-y-1">
        <h2 className="text-text-heading text-[27px] font-semibold tracking-[-0.03em]">
          Social &amp; Referrals
        </h2>
        <p className="text-text-sub text-sm tracking-[-0.01em]">
          Refer users to earn rewards.{" "}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="text-primary-medium h-auto p-0 font-semibold no-underline hover:no-underline"
            aria-label="Learn more about referrals"
          >
            Learn more
          </Button>
        </p>
      </div>
    </header>
  );
};

export default ReferralsHeader;
