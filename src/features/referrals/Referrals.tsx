"use client";

import { useState } from "react";
import Image from "next/image";
import ActiveTab from "@/src/components/common/ActiveTab";
import ActiveRef from "@/src/features/referrals/components/ActiveRef";
import HowItWork from "@/src/features/referrals/components/HowItWork";
import ReferAFriend from "@/src/features/referrals/components/ReferAFriend";
import ReferralsHeader from "@/src/features/referrals/components/ReferralsHeader";
import UserRefInfo from "@/src/features/referrals/components/UserRefInfo";

const tabs = [
  { value: "referrals", label: "Referrals" },
  { value: "rankings", label: "My Rankings" },
] as const;

type ReferralTab = (typeof tabs)[number]["value"];

const Referrals = () => {
  const [activeTab, setActiveTab] = useState<ReferralTab>("referrals");

  return (
    <div className="bg-background-main relative overflow-hidden px-4 py-5 md:px-6 md:py-6">
      <Image
        src="/line-background.svg"
        alt=""
        width={100}
        height={100}
        className="pointer-events-none absolute top-0 right-0 z-0 h-full w-full object-cover opacity-40"
      />

      <div className="relative z-10 mx-auto flex max-w-[380px] flex-col gap-5 md:max-w-[720px] xl:max-w-[860px]">
        <header className="flex items-center justify-between gap-4 pt-1">
          <h1 className="text-text-heading text-[30px] font-semibold tracking-[-0.03em]">
            Explore
          </h1>
        </header>

        <ActiveTab
          listTabs={tabs}
          activeTab={activeTab}
          onTabChange={(value) => setActiveTab(value as ReferralTab)}
          className="border-border-main bg-surface-overlay-subtle grid w-full grid-cols-2 rounded-[14px] border p-1"
        />

        {activeTab === "referrals" ? (
          <div className="flex flex-col gap-5 pb-4">
            <ReferralsHeader />
            <ReferAFriend />
            <HowItWork />
          </div>
        ) : (
          <div className="flex flex-col gap-5 pb-4">
            <UserRefInfo />
            <ActiveRef />
          </div>
        )}
      </div>
    </div>
  );
};

export default Referrals;
