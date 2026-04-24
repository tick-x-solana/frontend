"use client";

import { useCallback, useMemo, useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { buildMiniAppReferralLink } from "@/src/features/referrals/constants";
import { appToast } from "@/src/features/trade/toast";
import useMiniAppUsername from "@/src/hooks/useMiniAppUsername";

type UseWinShareActionsParams = {
  username?: string | null;
  walletAddress?: string | null;
  resolvedUserAddress?: string | null;
};

function useWinShareActions({
  username,
  walletAddress,
  resolvedUserAddress,
}: UseWinShareActionsParams = {}) {
  const [isSharing, setIsSharing] = useState(false);
  const { miniAppUsername, refreshMiniAppUsername } = useMiniAppUsername({
    username,
    walletAddress,
    resolvedUserAddress,
    logPrefix: "[useWinShareActions]",
  });

  const shareUrl = useMemo(
    () => buildMiniAppReferralLink(miniAppUsername ?? username),
    [miniAppUsername, username],
  );

  const copyShareLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      appToast.success("Copied share link", { icon: "🔗" });
    } catch (error) {
      console.error("Failed to copy share link", error);
      appToast.error("Failed to copy share link", { icon: "⚠️" });
    }
  }, [shareUrl]);

  const share = useCallback(async () => {
    try {
      setIsSharing(true);
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({
          title: "Join TickX",
          text: "Use my referral link to join TickX on World App.",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        appToast.success("Copied share link", { icon: "🔗" });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to share", error);
        appToast.error("Failed to share", { icon: "⚠️" });
      }
    } finally {
      setIsSharing(false);
    }
  }, [shareUrl]);

  const shareToWorldChat = useCallback(async () => {
    try {
      if (!MiniKit.isInWorldApp()) {
        appToast.error("WorldChat share is only available in World App", {
          icon: "⚠️",
        });
        return;
      }

      const resolvedMiniAppUsername = await refreshMiniAppUsername();

      if (!resolvedMiniAppUsername) {
        appToast.error("Missing World username", { icon: "⚠️" });
        return;
      }

      const referralLink = buildMiniAppReferralLink(resolvedMiniAppUsername);
      const message = [
        "Use my referral to follow trade on TickX.",
        `Referral code: ${resolvedMiniAppUsername}`,
        `Link: ${referralLink}`,
      ].join("\n");

      await MiniKit.chat({ message });
    } catch (error) {
      console.error("Failed to share to WorldChat", error);
      appToast.error("Failed to share to WorldChat", { icon: "⚠️" });
    }
  }, [refreshMiniAppUsername]);

  return {
    isSharing,
    shareUrl,
    copyShareLink,
    share,
    shareToWorldChat,
  };
}

export default useWinShareActions;
