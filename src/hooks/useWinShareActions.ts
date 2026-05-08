"use client";

import { useCallback, useMemo, useState } from "react";
import { buildMiniAppReferralLink } from "@/src/features/referrals/constants";
import { appToast } from "@/src/features/trade/toast";

type UseWinShareActionsParams = {
  username?: string | null;
  walletAddress?: string | null;
  resolvedUserAddress?: string | null;
};

function useWinShareActions({
  username,
  walletAddress,
  resolvedUserAddress: _resolvedUserAddress,
}: UseWinShareActionsParams = {}) {
  const [isSharing, setIsSharing] = useState(false);

  const shareUrl = useMemo(
    () => buildMiniAppReferralLink(username ?? walletAddress),
    [username, walletAddress],
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
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "Hey! I just won big! Follow my trades on TickX",
          text: "Hey! I just won big! Follow my trades on TickX",
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

  return {
    isSharing,
    shareUrl,
    copyShareLink,
    share,
  };
}

export default useWinShareActions;
