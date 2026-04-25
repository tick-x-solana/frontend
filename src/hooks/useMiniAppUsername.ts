"use client";

import { useCallback, useEffect, useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

type UseMiniAppUsernameParams = {
  username?: string | null;
  walletAddress?: string | null;
  resolvedUserAddress?: string | null;
  logPrefix?: string;
};

function normalizeUsername(value?: string | null) {
  const normalized = value?.trim().replace(/^@/, "");
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeAddress(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

async function getUsernameByAddress(address?: string | null) {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) {
    return null;
  }

  try {
    const user = await MiniKit.getUserByAddress(normalizedAddress);
    return normalizeUsername(user?.username);
  } catch {
    return null;
  }
}

function useMiniAppUsername(params: UseMiniAppUsernameParams = {}) {
  const { username, walletAddress, resolvedUserAddress } = params;
  const [miniAppUsername, setMiniAppUsername] = useState<string | null>(
    () =>
      normalizeUsername(MiniKit.user?.username) ?? normalizeUsername(username),
  );

  const resolveMiniAppUsername = useCallback(async () => {
    const activeAddress =
      normalizeAddress(resolvedUserAddress) ??
      normalizeAddress(walletAddress) ??
      normalizeAddress(MiniKit.user?.walletAddress);

    const usernameByAddress = await getUsernameByAddress(activeAddress);
    if (usernameByAddress) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("world-username", usernameByAddress);
        if (activeAddress) {
          window.localStorage.setItem(
            "world-username-wallet-address",
            activeAddress,
          );
        }
      }

      return usernameByAddress;
    }

    const miniKitUsername = normalizeUsername(MiniKit.user?.username);
    if (miniKitUsername) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("world-username", miniKitUsername);
        if (activeAddress) {
          window.localStorage.setItem(
            "world-username-wallet-address",
            activeAddress,
          );
        }
      }
      return miniKitUsername;
    }

    const authUsername = normalizeUsername(username);
    if (authUsername) {
      return authUsername;
    }

    if (typeof window !== "undefined") {
      const storedUsername = normalizeUsername(
        window.localStorage.getItem("world-username"),
      );
      const storedWalletAddress = normalizeAddress(
        window.localStorage.getItem("wallet-address"),
      );
      const storedUsernameWalletAddress = normalizeAddress(
        window.localStorage.getItem("world-username-wallet-address"),
      );

      if (storedUsername) {
        if (!activeAddress) {
          return storedUsername;
        }

        const isWalletMatched =
          activeAddress === storedWalletAddress ||
          activeAddress === storedUsernameWalletAddress;

        if (isWalletMatched) {
          return storedUsername;
        }
      }
    }

    return null;
  }, [resolvedUserAddress, username, walletAddress]);

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

    const timers = [
      window.setTimeout(() => {
        void syncMiniAppUsername();
      }, 300),
      window.setTimeout(() => {
        void syncMiniAppUsername();
      }, 1500),
    ];

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [resolveMiniAppUsername]);

  return {
    miniAppUsername,
    refreshMiniAppUsername,
  };
}

export default useMiniAppUsername;
