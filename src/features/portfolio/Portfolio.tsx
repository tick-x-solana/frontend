"use client";

import Title from "@/src/components/common/Title";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Button } from "@/src/components/shadcn/button";
import OverviewCard from "@/src/features/portfolio/components/OverviewCard";
import TradingHistoryTable from "@/src/features/portfolio/components/TradingHistoryTable";
import WalletActionPanel from "@/src/features/portfolio/components/WalletActionPanel";
import {
  getAccountControllerGetBalanceQueryKey,
  paymentControllerDebugDeposit,
  useLeaderboardControllerGetMyStats,
} from "@/src/services/queries";
import type { LeaderboardStatsDto } from "@/src/services/models";
import {
  formatOneDecimalNumber,
  formatUsdCurrency,
  formatUsdCurrencyFixedTwo,
} from "@/src/utils/formatters";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const FAUCET_AMOUNT_WLD = "50";
const FAUCET_COOLDOWN_MS = 30 * 60 * 1000;

function toFiniteNumber(value: string | null | undefined): number {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function extractLeaderboardStats(
  value: unknown,
): Partial<LeaderboardStatsDto> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.totalVolume === "string" ||
    typeof record.winRate === "string" ||
    typeof record.pnl === "string"
  ) {
    return record as Partial<LeaderboardStatsDto>;
  }

  if (record.data && typeof record.data === "object") {
    const nestedRecord = record.data as Record<string, unknown>;

    if (
      typeof nestedRecord.totalVolume === "string" ||
      typeof nestedRecord.winRate === "string" ||
      typeof nestedRecord.pnl === "string"
    ) {
      return nestedRecord as Partial<LeaderboardStatsDto>;
    }
  }

  return null;
}

function getFaucetStorageKey(walletAddress: string | null): string | null {
  if (!walletAddress) {
    return null;
  }

  return `portfolio:last-faucet-at:${walletAddress.toLowerCase()}`;
}

function formatCooldown(remainingMs: number): string {
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const Portfolio = () => {
  const queryClient = useQueryClient();
  const { walletAddress } = useAuth();
  const { data: myStatsResponse } = useLeaderboardControllerGetMyStats({
    query: {
      enabled: Boolean(walletAddress),
    },
  });
  console.log("myStatsResponse: ", myStatsResponse);
  const [isFauceting, setIsFauceting] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const faucetStorageKey = useMemo(
    () => getFaucetStorageKey(walletAddress),
    [walletAddress],
  );

  const lastFaucetAt = (() => {
    if (typeof window === "undefined" || !faucetStorageKey) {
      return null;
    }

    const storedValue = window.localStorage.getItem(faucetStorageKey);
    if (!storedValue) {
      return null;
    }

    const parsedValue = Number(storedValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  })();

  const remainingCooldownMs = useMemo(() => {
    if (!lastFaucetAt) {
      return 0;
    }

    return Math.max(0, lastFaucetAt + FAUCET_COOLDOWN_MS - currentTime);
  }, [currentTime, lastFaucetAt]);

  useEffect(() => {
    if (remainingCooldownMs <= 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [remainingCooldownMs]);

  const canFaucet = Boolean(walletAddress) && remainingCooldownMs === 0;

  const faucetButtonLabel = useMemo(() => {
    if (!walletAddress) {
      return "Connect wallet to faucet";
    }

    if (isFauceting) {
      return "Fauceting...";
    }

    if (remainingCooldownMs > 0) {
      return `Faucet in ${formatCooldown(remainingCooldownMs)}`;
    }

    return "Faucet";
  }, [isFauceting, remainingCooldownMs, walletAddress]);

  const overviewCards = useMemo(() => {
    const stats = extractLeaderboardStats(myStatsResponse);
    const totalVolume = toFiniteNumber(stats?.totalVolume);
    const winRate = toFiniteNumber(stats?.winRate);
    const pnl = toFiniteNumber(stats?.pnl);

    return [
      { label: "Total Vol", value: formatUsdCurrency(totalVolume) },
      {
        label: "Win Rate",
        value: `${formatOneDecimalNumber(winRate)}%`,
        valueClassName: "text-success-medium",
      },
      {
        label: "+Edge Earned",
        value: formatUsdCurrencyFixedTwo(pnl),
        valueClassName: pnl < 0 ? "text-destructive" : "text-primary-medium",
      },
    ];
  }, [myStatsResponse]);

  const handleFaucet = useCallback(async () => {
    if (!walletAddress) {
      toast.error("Please connect wallet first");
      return;
    }

    if (remainingCooldownMs > 0) {
      toast.error(
        `You can faucet again in ${formatCooldown(remainingCooldownMs)}`,
      );
      return;
    }

    setIsFauceting(true);

    try {
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1e6)
        .toString(16)
        .padStart(5, "0");

      await paymentControllerDebugDeposit({
        amount: FAUCET_AMOUNT_WLD,
        txHash: `0x${timestamp.toString(16)}${randomSuffix}`,
        logIndex: 0,
      });

      setCurrentTime(timestamp);

      if (faucetStorageKey) {
        window.localStorage.setItem(faucetStorageKey, String(timestamp));
      }

      await queryClient.invalidateQueries({
        queryKey: getAccountControllerGetBalanceQueryKey(),
      });

      toast.success("Faucet successfully!");
    } catch (error) {
      console.error("Faucet failed", error);
      toast.error("Faucet failed");
    } finally {
      setIsFauceting(false);
    }
  }, [faucetStorageKey, queryClient, remainingCooldownMs, walletAddress]);

  return (
    <div className="bg-background-main relative flex-col gap-4 overflow-hidden px-4 py-4 md:gap-6 md:px-10 xl:gap-8 xl:px-20">
      <Image
        src="/line-background.svg"
        alt="tickx"
        width={100}
        height={100}
        className="pointer-events-none absolute top-[100px] z-0 h-full w-full object-cover opacity-50"
      />
      <div className="flex flex-col gap-4">
        <Title>Portfolio</Title>
        <WalletActionPanel />
        <Button
          type="button"
          variant="outline"
          className="border-primary-light text-primary-light hover:bg-surface-overlay-subtle hover:text-primary-light h-11 rounded-[8px] bg-transparent text-sm font-medium"
          disabled={isFauceting || !canFaucet}
          onClick={handleFaucet}
        >
          {faucetButtonLabel}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {overviewCards.map((card) => (
          <OverviewCard key={card.label} {...card} />
        ))}
      </div>

      <TradingHistoryTable />
    </div>
  );
};

export default Portfolio;
