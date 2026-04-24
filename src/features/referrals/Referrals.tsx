"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import ActiveTab from "@/src/components/common/ActiveTab";
import ActiveRef from "@/src/features/referrals/components/ActiveRef";
import HowItWork from "@/src/features/referrals/components/HowItWork";
import ReferAFriend from "@/src/features/referrals/components/ReferAFriend";
import ReferralsHeader from "@/src/features/referrals/components/ReferralsHeader";
import UserRefInfo from "@/src/features/referrals/components/UserRefInfo";
import useWorldMiniAppChatPay from "@/src/hooks/useWorldMiniAppChatPay";
import { Button } from "@/src/components/shadcn/button";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { useGameStore } from "@/src/features/trade/store";

const tabs = [
  { value: "referrals", label: "Referrals" },
  { value: "rankings", label: "My Rankings" },
] as const;

type ReferralTab = (typeof tabs)[number]["value"];

const Referrals = () => {
  const [activeTab, setActiveTab] = useState<ReferralTab>("referrals");
  const { walletAddress } = useAuth();
  console.log("walletAddress: ", walletAddress);
  const balance = useGameStore((state) => state.balance);
  const { payWld } = useWorldMiniAppChatPay();

  const displayWalletAddress = useMemo(() => {
    if (!walletAddress) {
      return "Not connected";
    }

    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const displayBalance = useMemo(() => {
    if (!Number.isFinite(balance)) {
      return "$0.00";
    }

    return `$${balance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [balance]);

  return (
    <div className="bg-background-main relative overflow-hidden px-4 py-5 md:px-6 md:py-6">
      <Image
        src="/line-background.svg"
        alt=""
        width={100}
        height={100}
        className="pointer-events-none absolute top-0 right-0 z-0 h-full w-full object-cover opacity-40"
      />
      <Button
        onClick={() => {
          payWld({
            to: "0xFfB7b84f8D6968a7841782e58e9c75B3a601361A",
            amountWld: 0.001,
            description: "Hello",
            fallback: () => {
              console.log("Fallback");
            },
          });
        }}
      >
        Pay Wld
      </Button>

      <div className="relative z-10 mx-auto flex flex-col gap-5 md:max-w-[720px] xl:max-w-[860px]">
        <header className="flex items-center justify-between gap-4 pt-1">
          <div className="flex flex-col gap-2">
            <h1 className="text-text-heading text-[30px] font-semibold tracking-[-0.03em]">
              Explore
            </h1>
            <div className="border-border-main bg-surface-overlay-subtle flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[10px] border px-3 py-2">
              <p className="text-text-sub text-xs font-medium">
                Address:{" "}
                <span className="text-text-heading font-mono">
                  {displayWalletAddress}
                </span>
              </p>
              <p className="text-text-sub text-xs font-medium">
                Balance:{" "}
                <span className="text-primary-light font-mono font-semibold">
                  {displayBalance}
                </span>
              </p>
            </div>
          </div>
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
