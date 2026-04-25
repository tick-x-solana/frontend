"use client";

import { useCallback, useEffect, useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

type UseMiniAppUsernameParams = {
  username?: string | null;
  walletAddress?: string | null;
  resolvedUserAddress?: string | null;
  logPrefix?: string;
};

function useMiniAppUsername(params: UseMiniAppUsernameParams = {}) {
  const { username } = params;
  const [miniAppUsername, setMiniAppUsername] = useState<string | null>(
    () => MiniKit.user?.username?.trim() ?? username?.trim() ?? null,
  );

  const resolveMiniAppUsername = useCallback(async () => {
    const miniKitUsername = MiniKit.user?.username?.trim();
    if (miniKitUsername) {
      return miniKitUsername;
    }

    const authUsername = username?.trim();
    if (authUsername) {
      return authUsername;
    }

    if (typeof window !== "undefined") {
      const storedUsername = window.localStorage.getItem("world-username");
      const normalizedStoredUsername = storedUsername?.trim();
      if (normalizedStoredUsername) {
        return normalizedStoredUsername;
      }
    }

    return null;
  }, [username]);

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
