"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { MiniKit } from "@worldcoin/minikit-js";
import type { MiniKitChatOptions } from "@worldcoin/minikit-js/commands";
import ActiveTab from "@/src/components/common/ActiveTab";
import BrowseCopyTrade from "@/src/features/referrals/components/BrowseCopyTrade";
import CREProofView from "@/src/features/referrals/components/CREProofView";
import HowItWork from "@/src/features/referrals/components/HowItWork";
import ReferAFriend from "@/src/features/referrals/components/ReferAFriend";
import ReferralsHeader from "@/src/features/referrals/components/ReferralsHeader";
import { buildMiniAppReferralLink } from "@/src/features/referrals/constants";
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

  const resolveMiniAppUsername = useCallback(async () => {
    const directUsername = MiniKit.user?.username?.trim();
    if (directUsername) {
      return directUsername;
    }

    const resolvedAddress =
      MiniKit.user?.walletAddress ?? walletAddress ?? undefined;
    if (!resolvedAddress) {
      return null;
    }

    try {
      return (
        (await MiniKit.getUserByAddress(resolvedAddress)).username?.trim() ||
        null
      );
    } catch (error) {
      console.warn("[Referrals] Failed to resolve username", { error });
      return null;
    }
  }, [walletAddress]);

  const [worldId, setWorldId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const syncWorldId = async () => {
      const username = await resolveMiniAppUsername();
      if (!cancelled) {
        setWorldId(username);
      }
    };

    void syncWorldId();

    return () => {
      cancelled = true;
    };
  }, [resolveMiniAppUsername]);

  const referralLink = buildMiniAppReferralLink(worldId);

  const shareToChat = async () => {
    try {
      if (!MiniKit.isInWorldApp()) {
        console.warn("[Referrals] MiniKit.chat is only available in World App");
        return;
      }

      const miniAppUsername = await resolveMiniAppUsername();

      if (!miniAppUsername) {
        toast.error("Missing World username. Please set your username first.");
        return;
      }

      if (miniAppUsername !== worldId) {
        setWorldId(miniAppUsername);
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
          <CREProofView />
        )}
      </div>
    </div>
  );
};

export default Referrals;
