"use client";

import { useLeaderboardControllerGetLeaderboard } from "@/src/services/queries";
import { useMemo } from "react";
import type {
  LeaderboardControllerGetLeaderboardWindow,
  LeaderboardControllerGetLeaderboardMetric,
} from "@/src/services/models";
import type { LeaderboardEntryDto } from "@/src/services/models";
import { truncateAddress } from "@/src/lib/utils";
import { formatUsdCurrencyFixedTwo } from "@/src/utils/formatters";

export type LeaderboardViewEntry = {
  rank: number;
  initials: string;
  username: string;
  volume: string;
  pnl: number;
  isHumanVerified: boolean;
};

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getInitials = (username: string) => {
  const normalized = username.trim().replace(/^@/, "");
  if (!normalized) {
    return "--";
  }

  return normalized.slice(0, 2).toUpperCase();
};

const extractRows = (payload: unknown): LeaderboardEntryDto[] => {
  if (Array.isArray(payload)) {
    return payload as LeaderboardEntryDto[];
  }

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: LeaderboardEntryDto[] }).data;
  }

  return [];
};

export const useLeaderboardData = (
  window: LeaderboardControllerGetLeaderboardWindow,
  metric: LeaderboardControllerGetLeaderboardMetric,
) => {
  const query = useLeaderboardControllerGetLeaderboard({ window, metric, limit: 20 });

  const entries = useMemo<LeaderboardViewEntry[]>(() => {
    const rows = extractRows(query.data);

    return rows.map((row) => ({
      rank: row.rank,
      username: row.miniAppUsername || truncateAddress(row.userId, 4, 2),
      initials: getInitials(row.miniAppUsername || "anonymous"),
      volume: formatUsdCurrencyFixedTwo(toNumber(row.totalVolume)),
      pnl: toNumber(row.pnl),
      isHumanVerified: row.humanVerified,
    }));
  }, [query.data]);

  return {
    entries,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
};
