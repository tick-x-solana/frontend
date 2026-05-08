"use client";

import { useMemo } from "react";
import type {
  LeaderboardControllerGetLeaderboardWindow,
  LeaderboardControllerGetLeaderboardMetric,
} from "@/src/services/models";

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

// PnL decreases from rank 1→20 ($5k–$10k). Volume decreases too. Win rate is random 45–75%.
// Usernames are truncated Solana wallet addresses (base58, first 4 + last 4 chars).
const FAKE_ENTRIES: LeaderboardViewEntry[] = [
  { rank: 1,  initials: "7X", username: "7Xkr...mP9q", volume: "$412,840", pnl: 9840,  winRate: 73, totalTrades: 312, isHumanVerified: true  },
  { rank: 2,  initials: "Bz", username: "BzQf...4nWe", volume: "$387,550", pnl: 9310,  winRate: 68, totalTrades: 284, isHumanVerified: true  },
  { rank: 3,  initials: "Ht", username: "HtcV...8Rrj", volume: "$341,200", pnl: 8870,  winRate: 61, totalTrades: 256, isHumanVerified: false },
  { rank: 4,  initials: "3K", username: "3KmJ...uY2s", volume: "$298,760", pnl: 8530,  winRate: 75, totalTrades: 231, isHumanVerified: true  },
  { rank: 5,  initials: "Gw", username: "GwNb...xD6p", volume: "$267,430", pnl: 8190,  winRate: 57, totalTrades: 198, isHumanVerified: false },
  { rank: 6,  initials: "Fp", username: "FpAe...kL3m", volume: "$245,180", pnl: 7860,  winRate: 64, totalTrades: 187, isHumanVerified: true  },
  { rank: 7,  initials: "9R", username: "9RvT...zH5c", volume: "$219,340", pnl: 7540,  winRate: 70, totalTrades: 172, isHumanVerified: true  },
  { rank: 8,  initials: "Ej", username: "EjMd...bF7n", volume: "$198,760", pnl: 7230,  winRate: 52, totalTrades: 159, isHumanVerified: false },
  { rank: 9,  initials: "Qs", username: "QsUo...gA4t", volume: "$176,540", pnl: 6920,  winRate: 48, totalTrades: 143, isHumanVerified: false },
  { rank: 10, initials: "Lw", username: "LwCx...hK8v", volume: "$162,810", pnl: 6650,  winRate: 66, totalTrades: 136, isHumanVerified: true  },
  { rank: 11, initials: "Yp", username: "YpBr...eJ1u", volume: "$151,390", pnl: 6380,  winRate: 59, totalTrades: 128, isHumanVerified: false },
  { rank: 12, initials: "2N", username: "2Nzk...rM9d", volume: "$138,920", pnl: 6110,  winRate: 45, totalTrades: 121, isHumanVerified: true  },
  { rank: 13, initials: "Dh", username: "DhWq...cP2f", volume: "$124,650", pnl: 5870,  winRate: 72, totalTrades: 114, isHumanVerified: false },
  { rank: 14, initials: "Tv", username: "TvSn...oX6b", volume: "$113,270", pnl: 5630,  winRate: 54, totalTrades: 108, isHumanVerified: false },
  { rank: 15, initials: "8J", username: "8JeL...wQ3a", volume: "$104,440", pnl: 5450,  winRate: 63, totalTrades: 101, isHumanVerified: true  },
  { rank: 16, initials: "Mx", username: "MxRu...tN7i", volume: "$96,870",  pnl: 5290,  winRate: 47, totalTrades: 95,  isHumanVerified: false },
  { rank: 17, initials: "Pk", username: "PkHo...yC5g", volume: "$88,540",  pnl: 5170,  winRate: 69, totalTrades: 89,  isHumanVerified: false },
  { rank: 18, initials: "Vf", username: "VfZa...qD8e", volume: "$79,230",  pnl: 5080,  winRate: 55, totalTrades: 83,  isHumanVerified: true  },
  { rank: 19, initials: "Ag", username: "AgKy...nB4w", volume: "$71,810",  pnl: 5030,  winRate: 46, totalTrades: 78,  isHumanVerified: false },
  { rank: 20, initials: "Xc", username: "XcTm...jR2o", volume: "$64,390",  pnl: 5010,  winRate: 50, totalTrades: 72,  isHumanVerified: false },
];

export const useLeaderboardData = (
  _window: LeaderboardControllerGetLeaderboardWindow,
  _metric: LeaderboardControllerGetLeaderboardMetric,
) => {
  const entries = useMemo(() => FAKE_ENTRIES, []);

  return { entries, isLoading: false, isFetching: false, isError: false };
};
