"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MiniKit } from "@worldcoin/minikit-js";
import type {
  MiniKitWalletAuthOptions,
  WalletAuthResult,
} from "@worldcoin/minikit-js/commands";
import { useAccount, useSignMessage } from "wagmi";
import { useGameStore } from "@/src/features/trade/store";
import {
  accountControllerGetBalance,
  authControllerLogin,
  authControllerGetChallenge,
  authControllerMiniAppLogin,
  getAccountControllerGetBalanceQueryKey,
  useAuthControllerGetMiniAppNonce,
} from "@/src/services/queries";
import type { MiniAppLoginDto } from "@/src/services/models";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoggingIn: boolean;
  isMiniApp: boolean;
  login: () => Promise<void>;
  logout: () => void;
  token: string | null;
  username: string | null;
  walletAddress: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type ChallengeResponse = {
  challenge?: string;
};

type LoginResponse = {
  accessToken?: string;
};

const WORLD_USERNAME_KEY = "world-username";
const WORLD_USERNAME_WALLET_KEY = "world-username-wallet-address";

function normalizeWorldUsername(value?: string | null) {
  const normalized = value?.trim().replace(/^@/, "");
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeWalletAddress(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

async function getUsernameByAddress(address?: string | null) {
  const normalizedAddress = normalizeWalletAddress(address);
  if (!normalizedAddress) {
    return null;
  }

  try {
    const user = await MiniKit.getUserByAddress(normalizedAddress);
    return normalizeWorldUsername(user?.username);
  } catch {
    return null;
  }
}

function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

function getStoredWalletAddress() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("wallet-address");
}

function getStoredUsername() {
  if (typeof window === "undefined") return null;

  const username = normalizeWorldUsername(
    window.localStorage.getItem(WORLD_USERNAME_KEY),
  );
  if (!username) {
    return null;
  }

  const storedWalletAddress = normalizeWalletAddress(
    window.localStorage.getItem("wallet-address"),
  );
  const usernameWalletAddress = normalizeWalletAddress(
    window.localStorage.getItem(WORLD_USERNAME_WALLET_KEY),
  );
  if (
    storedWalletAddress &&
    usernameWalletAddress &&
    storedWalletAddress !== usernameWalletAddress
  ) {
    return null;
  }

  return username;
}

function getStoredWssKey() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("wss-key");
}

function extractAccessToken(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;

  const record = response as Record<string, unknown>;
  const directToken = record.accessToken ?? record.token;

  if (typeof directToken === "string" && directToken.trim().length > 0) {
    return directToken;
  }

  if (record.data && typeof record.data === "object") {
    return extractAccessToken(record.data);
  }

  return null;
}

function extractWssKey(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;

  const record = response as Record<string, unknown>;
  const directWssKey = record.wssKey ?? record.key ?? record.signature;

  if (typeof directWssKey === "string" && directWssKey.trim().length > 0) {
    return directWssKey;
  }

  if (record.data && typeof record.data === "object") {
    return extractWssKey(record.data);
  }

  return null;
}

function extractWssKeyExpiresAt(response: unknown): number | null {
  if (!response || typeof response !== "object") return null;

  const record = response as Record<string, unknown>;
  const directExpiry = record.wssKeyExpiresAt;

  if (typeof directExpiry === "number" && Number.isFinite(directExpiry)) {
    return directExpiry;
  }

  if (typeof directExpiry === "string") {
    const parsed = Number(directExpiry);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (record.data && typeof record.data === "object") {
    return extractWssKeyExpiresAt(record.data);
  }

  return null;
}

const ONBOARDING_COMPLETE_KEY = "tickx-onboarding-complete";

const walletAuthInput = (nonce: string): MiniKitWalletAuthOptions => ({
  nonce,
  requestId: "0",
  expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
  statement:
    "This is my statement and here is a link https://worldcoin.com/apps",
});

function extractBalance(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  return (
    extractBalance(record.free) ??
    extractBalance(record.amount) ??
    extractBalance(record.availableBalance) ??
    extractBalance(record.data)
  );
}

function extractMiniAppNonce(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const directNonce = record.nonce;
  if (typeof directNonce === "string" && directNonce.trim().length > 0) {
    return directNonce;
  }

  const data = record.data;
  if (data && typeof data === "object") {
    const nestedData = data as Record<string, unknown>;
    const nestedNonce = nestedData.nonce;

    if (typeof nestedNonce === "string" && nestedNonce.trim().length > 0) {
      return nestedNonce;
    }
  }

  return null;
}

const subscribeMiniAppStatus = () => () => {};

const getMiniAppStatusSnapshot = () => {
  if (typeof window === "undefined") return false;
  return MiniKit.isInWorldApp();
};

const getMiniAppStatusServerSnapshot = () => false;

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { refetch: refetchMiniAppNonce } = useAuthControllerGetMiniAppNonce({
    query: {
      enabled: false,
      retry: false,
    },
  });
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [authWalletAddress, setAuthWalletAddress] = useState<string | null>(
    () => getStoredWalletAddress(),
  );
  const [authUsername, setAuthUsername] = useState<string | null>(
    () => getStoredUsername(),
  );
  const isMiniApp = useSyncExternalStore(
    subscribeMiniAppStatus,
    getMiniAppStatusSnapshot,
    getMiniAppStatusServerSnapshot,
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isLoggingInRef = useRef(false);
  const previousConnectionRef = useRef<{
    address: string | null;
    isConnected: boolean;
  }>({
    address: null,
    isConnected: false,
  });

  const syncBalance = useCallback(async () => {
    const balanceResponse = await accountControllerGetBalance();
    const nextBalance = extractBalance(balanceResponse);

    if (nextBalance !== null) {
      useGameStore.setState({
        balance: nextBalance,
        serverBalance: nextBalance,
      });
    }

    await queryClient.invalidateQueries({
      queryKey: getAccountControllerGetBalanceQueryKey(),
    });
  }, [queryClient]);

  const clearBalance = useCallback(() => {
    useGameStore.setState({
      balance: 0,
      serverBalance: 0,
    });
  }, []);

  const logout = useCallback(() => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem("token");
    window.localStorage.removeItem("wallet-address");
    window.localStorage.removeItem(WORLD_USERNAME_KEY);
    window.localStorage.removeItem(WORLD_USERNAME_WALLET_KEY);
    window.localStorage.removeItem("wss-key");
    window.localStorage.removeItem("wss-key-expires-at");
    window.localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    setToken(null);
    setAuthWalletAddress(null);
    setAuthUsername(null);
    useGameStore.setState({ wssKey: null });
    clearBalance();
  }, [clearBalance]);

  const handleWalletDisconnect = useCallback(() => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem("token");
    window.localStorage.removeItem("wallet-address");
    window.localStorage.removeItem(WORLD_USERNAME_KEY);
    window.localStorage.removeItem(WORLD_USERNAME_WALLET_KEY);
    window.localStorage.removeItem("wss-key");
    window.localStorage.removeItem("wss-key-expires-at");
    window.localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    setToken(null);
    setAuthWalletAddress(null);
    setAuthUsername(null);
    useGameStore.setState({ wssKey: null });
    clearBalance();
  }, [clearBalance]);

  const storeAuthSession = useCallback(
    async (
      accessToken: string,
      walletAddress: string,
      session?: {
        username?: string | null;
        wssKey?: string | null;
        wssKeyExpiresAt?: number | null;
      },
    ) => {
      if (typeof window === "undefined") return;

      window.localStorage.setItem("token", accessToken);
      window.localStorage.setItem("wallet-address", walletAddress);
      const normalizedSessionUsername = normalizeWorldUsername(session?.username);
      const normalizedWalletAddress = normalizeWalletAddress(walletAddress);

      if (normalizedSessionUsername) {
        window.localStorage.setItem(WORLD_USERNAME_KEY, normalizedSessionUsername);
        if (normalizedWalletAddress) {
          window.localStorage.setItem(
            WORLD_USERNAME_WALLET_KEY,
            normalizedWalletAddress,
          );
        }
      } else {
        window.localStorage.removeItem(WORLD_USERNAME_KEY);
        window.localStorage.removeItem(WORLD_USERNAME_WALLET_KEY);
      }
      if (session?.wssKey) {
        window.localStorage.setItem("wss-key", session.wssKey);
        useGameStore.setState({ wssKey: session.wssKey });
      } else {
        window.localStorage.removeItem("wss-key");
        useGameStore.setState({ wssKey: null });
      }

      if (typeof session?.wssKeyExpiresAt === "number") {
        window.localStorage.setItem(
          "wss-key-expires-at",
          String(session.wssKeyExpiresAt),
        );
      } else {
        window.localStorage.removeItem("wss-key-expires-at");
      }
      setToken(accessToken);
      setAuthWalletAddress(walletAddress);
      setAuthUsername(normalizedSessionUsername);
      await syncBalance();
    },
    [syncBalance],
  );

  const loginWithMiniApp = useCallback(async () => {
    if (isLoggingInRef.current) return;
    if (typeof window === "undefined") return;

    const storedToken = window.localStorage.getItem("token");
    const storedAddress = window.localStorage.getItem("wallet-address");
    const storedUsername = normalizeWorldUsername(
      window.localStorage.getItem(WORLD_USERNAME_KEY),
    );
    const miniKitAddress = MiniKit.user?.walletAddress;

    if (
      storedToken &&
      storedAddress &&
      (!miniKitAddress ||
        miniKitAddress.toLowerCase() === storedAddress.toLowerCase())
    ) {
      const usernameByAddress = await getUsernameByAddress(
        miniKitAddress ?? storedAddress,
      );

      setToken(storedToken);
      setAuthWalletAddress(storedAddress);
      setAuthUsername(
        usernameByAddress ??
          normalizeWorldUsername(MiniKit.user?.username) ??
          storedUsername,
      );

      if (usernameByAddress) {
        window.localStorage.setItem(WORLD_USERNAME_KEY, usernameByAddress);
        window.localStorage.setItem(
          WORLD_USERNAME_WALLET_KEY,
          normalizeWalletAddress(storedAddress) ?? storedAddress.toLowerCase(),
        );
      }

      await syncBalance();
      return;
    }

    isLoggingInRef.current = true;
    setIsLoggingIn(true);

    try {
      const nonceResponse = await refetchMiniAppNonce();
      const nonce = extractMiniAppNonce(nonceResponse.data);
      if (!nonce) {
        throw new Error("Missing mini-app nonce");
      }

      const result = await MiniKit.walletAuth<WalletAuthResult>(
        walletAuthInput(nonce),
      );

      if (result.executedWith === "fallback") {
        throw new Error("Mini App wallet authentication is unavailable");
      }

      const usernameByAddress = await getUsernameByAddress(result.data.address);
      const resolvedUsername =
        usernameByAddress ?? normalizeWorldUsername(MiniKit.user?.username);

      const miniAppLoginDto: MiniAppLoginDto = {
        nonce,
        miniAppUserId:
          MiniKit.user?.walletAddress ??
          MiniKit.user?.username ??
          result.data.address,
        miniAppUsername: resolvedUsername ?? undefined,
        payload: {
          status: "success",
          message: result.data.message,
          signature: result.data.signature,
          address: result.data.address,
          version: result.data.version ?? 1,
        },
      };

      const loginResponse = await authControllerMiniAppLogin(miniAppLoginDto);
      const accessToken = extractAccessToken(loginResponse);
      const wssKey = extractWssKey(loginResponse);
      const wssKeyExpiresAt = extractWssKeyExpiresAt(loginResponse);

      if (!accessToken) {
        throw new Error("Missing access token");
      }

      await storeAuthSession(accessToken, result.data.address, {
        username: resolvedUsername,
        wssKey,
        wssKeyExpiresAt,
      });
    } catch (error) {
      console.error("Mini App login failed:", error);
      window.localStorage.removeItem("token");
      window.localStorage.removeItem(WORLD_USERNAME_KEY);
      window.localStorage.removeItem(WORLD_USERNAME_WALLET_KEY);
      window.localStorage.removeItem("wss-key");
      window.localStorage.removeItem("wss-key-expires-at");
      useGameStore.setState({ wssKey: null });
      setToken(null);
      setAuthUsername(null);
    } finally {
      isLoggingInRef.current = false;
      setIsLoggingIn(false);
    }
  }, [refetchMiniAppNonce, storeAuthSession, syncBalance]);

  const login = useCallback(async () => {
    if (isMiniApp) {
      await loginWithMiniApp();
      return;
    }

    if (!isConnected || !address || isLoggingInRef.current) return;
    if (typeof window === "undefined") return;

    const normalizedAddress = address.toLowerCase();
    const storedToken = window.localStorage.getItem("token");
    const storedAddress = window.localStorage.getItem("wallet-address");

    if (
      storedToken &&
      storedAddress &&
      storedAddress.toLowerCase() === normalizedAddress
    ) {
      setToken(storedToken);
      await syncBalance();
      return;
    }

    isLoggingInRef.current = true;
    setIsLoggingIn(true);

    try {
      const challengeResponse = (await authControllerGetChallenge({
        address,
      })) as unknown as ChallengeResponse;
      const challenge = challengeResponse.challenge;

      if (!challenge) {
        throw new Error("Missing auth challenge");
      }

      const signature = await signMessageAsync({
        message: challenge,
      });

      const loginResponse = (await authControllerLogin({
        address,
        signature,
      })) as unknown as LoginResponse;
      const accessToken =
        loginResponse.accessToken ?? extractAccessToken(loginResponse);

      if (!accessToken) {
        throw new Error("Missing access token");
      }

      await storeAuthSession(accessToken, address);
    } catch (error) {
      console.error("Login failed:", error);
      window.localStorage.removeItem("token");
      window.localStorage.removeItem(WORLD_USERNAME_KEY);
      window.localStorage.removeItem(WORLD_USERNAME_WALLET_KEY);
      window.localStorage.removeItem("wss-key");
      window.localStorage.removeItem("wss-key-expires-at");
      useGameStore.setState({ wssKey: null });
      setToken(null);
      setAuthUsername(null);
    } finally {
      isLoggingInRef.current = false;
      setIsLoggingIn(false);
    }
  }, [
    address,
    isConnected,
    isMiniApp,
    loginWithMiniApp,
    signMessageAsync,
    storeAuthSession,
    syncBalance,
  ]);

  useEffect(() => {
    if (isMiniApp) return;
    if (!isConnected || !address) return;

    const frame = window.requestAnimationFrame(() => {
      void login();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [address, isConnected, isMiniApp, login]);

  useEffect(() => {
    if (isMiniApp) return;

    const previousConnection = previousConnectionRef.current;
    const didDisconnect =
      previousConnection.isConnected &&
      !isConnected &&
      !isConnecting &&
      !isReconnecting;

    if (didDisconnect) {
      handleWalletDisconnect();
    }

    previousConnectionRef.current = {
      address: address ?? null,
      isConnected,
    };
  }, [
    address,
    handleWalletDisconnect,
    isMiniApp,
    isConnected,
    isConnecting,
    isReconnecting,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedWssKey = getStoredWssKey();
    useGameStore.setState({ wssKey: storedWssKey });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleLogout = () => {
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("wallet-address");
      window.localStorage.removeItem(WORLD_USERNAME_KEY);
      window.localStorage.removeItem(WORLD_USERNAME_WALLET_KEY);
      window.localStorage.removeItem("wss-key");
      window.localStorage.removeItem("wss-key-expires-at");
      window.localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      setToken(null);
      setAuthWalletAddress(null);
      setAuthUsername(null);
      useGameStore.setState({ wssKey: null });

      if (!isMiniApp) {
        void login();
      }
    };

    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [isMiniApp, login]);

  const resolvedWalletAddress = isMiniApp
    ? authWalletAddress
    : (address ?? null);
  const resolvedUsername = isMiniApp
    ? (authUsername ?? normalizeWorldUsername(MiniKit.user?.username) ?? null)
    : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token && resolvedWalletAddress),
      isLoggingIn,
      isMiniApp,
      login,
      logout,
      token,
      username: resolvedUsername,
      walletAddress: resolvedWalletAddress,
    }),
    [
      isLoggingIn,
      isMiniApp,
      login,
      logout,
      resolvedUsername,
      resolvedWalletAddress,
      token,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};

export default AuthProvider;
