"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { MiniKit } from "@worldcoin/minikit-js";
import type { MiniKitChatOptions } from "@worldcoin/minikit-js/commands";
import ActiveTab from "@/src/components/common/ActiveTab";
import ActiveRef from "@/src/features/referrals/components/ActiveRef";
import BrowseCopyTrade from "@/src/features/referrals/components/BrowseCopyTrade";
import HowItWork from "@/src/features/referrals/components/HowItWork";
import ReferAFriend from "@/src/features/referrals/components/ReferAFriend";
import ReferralsHeader from "@/src/features/referrals/components/ReferralsHeader";
import UserRefInfo from "@/src/features/referrals/components/UserRefInfo";
import { buildMiniAppReferralLink } from "@/src/features/referrals/constants";
import useWorldMiniAppChatPay from "@/src/hooks/useWorldMiniAppChatPay";
import { Button } from "@/src/components/shadcn/button";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { useGameStore } from "@/src/features/trade/store";
import { toast } from "sonner";

const tabs = [
  { value: "browse", label: "Browse" },
  { value: "referrals", label: "Referrals" },
  { value: "rankings", label: "Rankings" },
] as const;

type ReferralTab = (typeof tabs)[number]["value"];

const Referrals = () => {
  const [activeTab, setActiveTab] = useState<ReferralTab>("browse");
  const { walletAddress, logout } = useAuth();
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

  const referralLink = buildMiniAppReferralLink(MiniKit.user?.username);
  const worldId = MiniKit.user?.username?.trim() || null;

  const shareToChat = async () => {
    try {
      if (!MiniKit.isInWorldApp()) {
        console.warn("[Referrals] MiniKit.chat is only available in World App");
        return;
      }

      const resolvedAddress =
        MiniKit.user?.walletAddress ?? walletAddress ?? undefined;
      const miniAppUsername =
        MiniKit.user?.username?.trim() ??
        (resolvedAddress
          ? (await MiniKit.getUserByAddress(resolvedAddress)).username?.trim()
          : undefined);

      if (!miniAppUsername) {
        toast.error("Missing World username. Please set your username first.");
        return;
      }

      const miniAppReferralLink = buildMiniAppReferralLink(miniAppUsername);
      console.log("miniAppReferralLink: ", miniAppReferralLink);

      // World Chat can unfurl URLs and hide them in the text bubble, so include a
      // plain referral code line that always remains visible.
      const message = [
        "Use my referral to follow trade on TickX.",
        `Referral code: ${miniAppUsername}`,
        `Link: ${miniAppReferralLink}`,
      ].join("\n");

      const input = {
        message,
        to: ["andy"],
      } satisfies MiniKitChatOptions;

      console.log("send chat");
      const result = await MiniKit.chat(input);
      console.log("[Referrals] MiniKit.chat result", { result });
    } catch (error) {
      console.log("error: ", error);
    }
  };

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
          console.log("[Referrals] Pay button clicked");
          void payWld({
            to: "0x0cb3e84e2c4bf88032e2279e7dd11b4e75ba7303",
            amountWld: 0.001,
            description: "Hello",
            fallback: () => {
              console.log("[Referrals] MiniKit fallback callback triggered");
            },
          })
            .then((result) => {
              console.log("[Referrals] payWld resolved", { result });
            })
            .catch((error: unknown) => {
              console.error("[Referrals] payWld failed", { error });
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
          <Button type="button" variant="outline" onClick={logout}>
            Logout
          </Button>
        </header>

        <ActiveTab
          listTabs={tabs}
          activeTab={activeTab}
          onTabChange={(value) => setActiveTab(value as ReferralTab)}
          className="grid w-full grid-cols-3"
        />

        {activeTab === "browse" ? (
          <BrowseCopyTrade />
        ) : activeTab === "referrals" ? (
          <div className="flex flex-col gap-5 pb-4">
            <ReferralsHeader
              onShareToChat={() => void shareToChat()}
              worldId={worldId}
            />
            <ReferAFriend referralLink={referralLink} />
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
