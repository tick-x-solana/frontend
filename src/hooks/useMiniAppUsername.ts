"use client";

import { useCallback, useEffect, useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

type UseMiniAppUsernameParams = {
  username?: string | null;
  walletAddress?: string | null;
  resolvedUserAddress?: string | null;
  logPrefix?: string;
};

function useMiniAppUsername({
  username,
  walletAddress,
  resolvedUserAddress,
  logPrefix = "[useMiniAppUsername]",
}: UseMiniAppUsernameParams = {}) {
  const [miniAppUsername, setMiniAppUsername] = useState<string | null>(
    () => MiniKit.user?.username?.trim() ?? username?.trim() ?? null,
  );

  const resolveMiniAppUsername = useCallback(async () => {
    const authUsername = username?.trim();
    if (authUsername) {
      return authUsername;
    }

    const directUsername = MiniKit.user?.username?.trim();
    if (directUsername) {
      return directUsername;
    }

    const resolvedAddress =
      MiniKit.user?.walletAddress ?? walletAddress ?? resolvedUserAddress;
    if (!resolvedAddress) {
      return null;
    }

    try {
      return (
        (await MiniKit.getUserByAddress(resolvedAddress)).username?.trim() ||
        null
      );
    } catch (error) {
      console.warn(`${logPrefix} Failed to resolve username`, { error });
      return null;
    }
  }, [logPrefix, resolvedUserAddress, username, walletAddress]);

  const refreshMiniAppUsername = useCallback(async () => {
    const resolvedUsername = await resolveMiniAppUsername();
    setMiniAppUsername(resolvedUsername ?? null);
    return resolvedUsername ?? null;
  }, [resolveMiniAppUsername]);

  useEffect(() => {
    let cancelled = false;

    const syncMiniAppUsername = async () => {
      const resolvedUsername = await resolveMiniAppUsername();
      if (!cancelled) {
        setMiniAppUsername(resolvedUsername ?? null);
      }
    };

    void syncMiniAppUsername();

    return () => {
      cancelled = true;
    };
  }, [resolveMiniAppUsername]);

  return {
    miniAppUsername,
    refreshMiniAppUsername,
  };
}

export default useMiniAppUsername;
