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
import { useAccount, useSignMessage } from "wagmi";
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
  walletAddress: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type ChallengeResponse = {
  challenge?: string;
};

type LoginResponse = {
  accessToken?: string;
};

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
    extractBalance(record.balance) ??
    extractBalance(record.amount) ??
    extractBalance(record.availableBalance) ??
    extractBalance(record.data)
  );
}

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isLoggingInRef = useRef(false);

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

  const logout = useCallback(() => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem("token");
    window.localStorage.removeItem("wallet-address");
    setToken(null);
    useGameStore.setState({
      balance: 0,
      serverBalance: 0,
    });
  }, []);

  const login = useCallback(async () => {
    if (!isConnected || !address || isLoggingInRef.current) return;
    if (typeof window === "undefined") return;

    const storedToken = window.localStorage.getItem("token");
    const storedAddress = window.localStorage.getItem("wallet-address");

    if (
      storedToken &&
      storedAddress &&
      storedAddress.toLowerCase() === address.toLowerCase()
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      })) as unknown as LoginResponse;
      const accessToken = loginResponse.accessToken;

      if (!accessToken) {
        throw new Error("Missing access token");
      }

      window.localStorage.setItem("token", accessToken);
      window.localStorage.setItem("wallet-address", address);
      setToken(accessToken);
      await syncBalance();
    } catch (error) {
      console.error("Login failed:", error);
      window.localStorage.removeItem("token");
      setToken(null);
    } finally {
      isLoggingInRef.current = false;
      setIsLoggingIn(false);
    }
  }, [address, isConnected, signMessageAsync, syncBalance]);

  useEffect(() => {
    if (!isConnected || !address) {
      const frame = window.requestAnimationFrame(() => {
        logout();
      });

      return () => window.cancelAnimationFrame(frame);
    }

    const frame = window.requestAnimationFrame(() => {
      void login();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [address, isConnected, login, logout]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleLogout = () => {
      setToken(null);
      void login();
    };

    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [login]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token && address),
      isLoggingIn,
      login,
      logout,
      token,
      walletAddress: address ?? null,
    }),
    [address, isLoggingIn, login, logout, token],
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
