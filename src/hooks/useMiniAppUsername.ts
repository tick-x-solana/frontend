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
    // TODO: remove mock — hardcoded for demo
    return "kyan13";
  }, []);

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
