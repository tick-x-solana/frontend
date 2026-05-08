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
  winRate: number;
  totalTrades: number;
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

// Fake seed data used when the API returns no entries (demo/hackathon mode)
const FAKE_ENTRIES: LeaderboardViewEntry[] = [
  { rank: 1,  initials: "CK", username: "crypto_king",    volume: "$412,840", pnl: 18420,  winRate: 78, totalTrades: 312, isHumanVerified: true  },
  { rank: 2,  initials: "NV", username: "nova_trader",    volume: "$387,550", pnl: 15730,  winRate: 74, totalTrades: 284, isHumanVerified: true  },
  { rank: 3,  initials: "ZA", username: "zenith_alpha",   volume: "$341,200", pnl: 13280,  winRate: 71, totalTrades: 256, isHumanVerified: false },
  { rank: 4,  initials: "DX", username: "delta_x",        volume: "$298,760", pnl: 11640,  winRate: 69, totalTrades: 231, isHumanVerified: true  },
  { rank: 5,  initials: "MQ", username: "market_quant",   volume: "$267,430", pnl: 9850,   winRate: 67, totalTrades: 198, isHumanVerified: false },
  { rank: 6,  initials: "AV", username: "apex_viper",     volume: "$245,180", pnl: 8720,   winRate: 65, totalTrades: 187, isHumanVerified: true  },
  { rank: 7,  initials: "SB", username: "solana_bull",    volume: "$219,340", pnl: 7430,   winRate: 63, totalTrades: 172, isHumanVerified: true  },
  { rank: 8,  initials: "PW", username: "pulse_wave",     volume: "$198,760", pnl: 6180,   winRate: 62, totalTrades: 159, isHumanVerified: false },
  { rank: 9,  initials: "RX", username: "risk_x",         volume: "$176,540", pnl: 5240,   winRate: 60, totalTrades: 143, isHumanVerified: false },
  { rank: 10, initials: "GM", username: "grid_master",    volume: "$162,810", pnl: 4830,   winRate: 59, totalTrades: 136, isHumanVerified: true  },
  { rank: 11, initials: "TC", username: "tick_champion",  volume: "$151,390", pnl: 4210,   winRate: 58, totalTrades: 128, isHumanVerified: false },
  { rank: 12, initials: "WF", username: "wave_force",     volume: "$138,920", pnl: 3790,   winRate: 57, totalTrades: 121, isHumanVerified: true  },
  { rank: 13, initials: "HZ", username: "hyper_zone",     volume: "$124,650", pnl: 3340,   winRate: 56, totalTrades: 114, isHumanVerified: false },
  { rank: 14, initials: "BL", username: "blitz_trader",   volume: "$113,270", pnl: 2970,   winRate: 55, totalTrades: 108, isHumanVerified: false },
  { rank: 15, initials: "QP", username: "quantum_pulse",  volume: "$104,440", pnl: 2680,   winRate: 54, totalTrades: 101, isHumanVerified: true  },
  { rank: 16, initials: "NS", username: "night_scalper",  volume: "$96,870",  pnl: 2310,   winRate: 53, totalTrades: 95,  isHumanVerified: false },
  { rank: 17, initials: "OB", username: "orbit_bull",     volume: "$88,540",  pnl: 1980,   winRate: 52, totalTrades: 89,  isHumanVerified: false },
  { rank: 18, initials: "FX", username: "flux_rider",     volume: "$79,230",  pnl: 1670,   winRate: 51, totalTrades: 83,  isHumanVerified: true  },
  { rank: 19, initials: "VN", username: "venom_net",      volume: "$71,810",  pnl: 1420,   winRate: 50, totalTrades: 78,  isHumanVerified: false },
  { rank: 20, initials: "EW", username: "edge_walker",    volume: "$64,390",  pnl: 1180,   winRate: 49, totalTrades: 72,  isHumanVerified: false },
];

export const useLeaderboardData = (
  window: LeaderboardControllerGetLeaderboardWindow,
  metric: LeaderboardControllerGetLeaderboardMetric,
) => {
  const query = useLeaderboardControllerGetLeaderboard({ window, metric, limit: 20 });

  const entries = useMemo<LeaderboardViewEntry[]>(() => {
    const rows = extractRows(query.data);

    if (rows.length === 0) {
      return FAKE_ENTRIES;
    }

    return rows.map((row) => ({
      rank: row.rank,
      username: row.miniAppUsername || truncateAddress(row.userId, 4, 2),
      initials: getInitials(row.miniAppUsername || "anonymous"),
      volume: formatUsdCurrencyFixedTwo(toNumber(row.totalVolume)),
      pnl: toNumber(row.pnl),
      winRate: 0,
      totalTrades: 0,
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
