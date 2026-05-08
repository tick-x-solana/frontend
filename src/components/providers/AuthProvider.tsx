"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { useGameStore } from "@/src/features/trade/store";
import {
  accountControllerGetBalance,
  authControllerGetChallenge,
  authControllerLogin,
  getAccountControllerGetBalanceQueryKey,
} from "@/src/services/queries";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoggingIn: boolean;
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

function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

function getStoredWalletAddress() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("wallet-address");
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
    if (Number.isFinite(parsed)) return parsed;
  }
  if (record.data && typeof record.data === "object") {
    return extractWssKeyExpiresAt(record.data);
  }
  return null;
}

function extractBalance(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return (
    extractBalance(record.free) ??
    extractBalance(record.amount) ??
    extractBalance(record.availableBalance) ??
    extractBalance(record.data)
  );
}

const ONBOARDING_COMPLETE_KEY = "tickx-onboarding-complete";

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { publicKey, signMessage, connected, disconnecting } = useWallet();
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [authWalletAddress, setAuthWalletAddress] = useState<string | null>(
    () => getStoredWalletAddress(),
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isLoggingInRef = useRef(false);
  const previousConnectedRef = useRef(false);
  const loginRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const walletAddress = publicKey?.toBase58() ?? authWalletAddress;

  const syncBalance = useCallback(async () => {
    const balanceResponse = await accountControllerGetBalance();
    const nextBalance = extractBalance(balanceResponse);
    if (nextBalance !== null) {
      useGameStore.setState({ balance: nextBalance, serverBalance: nextBalance });
    }
    await queryClient.invalidateQueries({
      queryKey: getAccountControllerGetBalanceQueryKey(),
    });
  }, [queryClient]);

  const clearBalance = useCallback(() => {
    useGameStore.setState({ balance: 0, serverBalance: 0 });
  }, []);

  const clearSession = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("wallet-address");
    window.localStorage.removeItem("wss-key");
    window.localStorage.removeItem("wss-key-expires-at");
    window.localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    setToken(null);
    setAuthWalletAddress(null);
    useGameStore.setState({ wssKey: null });
    clearBalance();
  }, [clearBalance]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const storeAuthSession = useCallback(
    async (
      accessToken: string,
      address: string,
      session?: {
        wssKey?: string | null;
        wssKeyExpiresAt?: number | null;
      },
    ) => {
      if (typeof window === "undefined") return;

      window.localStorage.setItem("token", accessToken);
      window.localStorage.setItem("wallet-address", address);

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
      setAuthWalletAddress(address);
      await syncBalance();
    },
    [syncBalance],
  );

  const login = useCallback(async () => {
    if (!connected || !publicKey || !signMessage || isLoggingInRef.current) return;
    if (typeof window === "undefined") return;

    const address = publicKey.toBase58();
    const storedToken = window.localStorage.getItem("token");
    const storedAddress = window.localStorage.getItem("wallet-address");

    if (storedToken && storedAddress && storedAddress === address) {
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

      if (!challenge) throw new Error("Missing auth challenge");

      // Sign the challenge message with Solana wallet
      const messageBytes = new TextEncoder().encode(challenge);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      const loginResponse = (await authControllerLogin({
        address,
        signature,
      })) as unknown as LoginResponse;

      const accessToken =
        loginResponse.accessToken ?? extractAccessToken(loginResponse);

      if (!accessToken) throw new Error("Missing access token");

      const wssKey = extractWssKey(loginResponse);
      const wssKeyExpiresAt = extractWssKeyExpiresAt(loginResponse);

      await storeAuthSession(accessToken, address, { wssKey, wssKeyExpiresAt });
    } catch (error) {
      console.error("Solana login failed:", error);
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("wss-key");
      window.localStorage.removeItem("wss-key-expires-at");
      useGameStore.setState({ wssKey: null });
      setToken(null);
    } finally {
      isLoggingInRef.current = false;
      setIsLoggingIn(false);
    }
  }, [connected, publicKey, signMessage, storeAuthSession, syncBalance]);

  // Keep loginRef pointing at the latest login without making it an effect dep
  loginRef.current = login;

  // Auto-login when wallet connects — depends only on connection state, not
  // the login callback, so it won't re-fire on every render caused by
  // queryClient/syncBalance identity changes.
  useEffect(() => {
    if (!connected || !publicKey) return;
    const frame = window.requestAnimationFrame(() => {
      void loginRef.current();
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey]);

  // Clear session when wallet disconnects
  useEffect(() => {
    const wasConnected = previousConnectedRef.current;
    previousConnectedRef.current = connected;

    if (wasConnected && !connected && !disconnecting) {
      clearSession();
    }
  }, [connected, disconnecting, clearSession]);

  // Rehydrate wss key from storage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedWssKey = getStoredWssKey();
    useGameStore.setState({ wssKey: storedWssKey });
  }, []);

  // Listen for forced logout events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleLogout = () => {
      clearSession();
      void loginRef.current();
    };

    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token && walletAddress),
      isLoggingIn,
      login,
      logout,
      token,
      username: null,
      walletAddress: walletAddress ?? null,
    }),
    [isLoggingIn, login, logout, token, walletAddress],
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
