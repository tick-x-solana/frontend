"use client";

import { useCallback, useMemo, useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { buildMiniAppReferralLink } from "@/src/features/referrals/constants";
import {
  buildWorldChatShareMessage,
  type WorldChatShareMetrics,
} from "@/src/features/referrals/worldChatShare";
import { appToast } from "@/src/features/trade/toast";
import useMiniAppUsername from "@/src/hooks/useMiniAppUsername";

type UseWinShareActionsParams = {
  username?: string | null;
  walletAddress?: string | null;
  resolvedUserAddress?: string | null;
};

type ShareToWorldChatOptions = {
  introLine?: string;
  metrics?: WorldChatShareMetrics;
};

function isWorldChatUserRejectedError(
  error: unknown,
): error is Error & { error_code: string } {
  if (!(error instanceof Error)) return false;
  const chatError = error as Error & { error_code?: string };
  return chatError.name === "ChatError" && chatError.error_code === "user_rejected";
}

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

  const shareToWorldChat = useCallback(
    async (options?: ShareToWorldChatOptions) => {
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
        const message = buildWorldChatShareMessage({
          referralCode: resolvedMiniAppUsername,
          referralLink,
          introLine: options?.introLine,
          metrics: options?.metrics,
        });

        await MiniKit.chat({ message });
      } catch (error) {
        if (isWorldChatUserRejectedError(error)) {
          appToast.info("User cancelled share to WorldChat", { icon: "ℹ️" });
          return;
        }
        console.error("Failed to share to WorldChat", error);
        appToast.error("Failed to share to WorldChat", { icon: "⚠️" });
      }
    },
    [refreshMiniAppUsername],
  );

  return {
    isSharing,
    shareUrl,
    copyShareLink,
    share,
    shareToWorldChat,
  };
}

export default useWinShareActions;
