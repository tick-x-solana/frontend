import { useQuery } from "@tanstack/react-query";
import { customClient } from "@/src/services/custom-client";
import type { LeaderboardStatsDto } from "@/src/services/models";
import useSolUsdPrice from "@/src/hooks/useSolUsdPrice";
import { formatUsdCurrency } from "@/src/utils/formatters";

type StatsEnvelope = {
  data?: LeaderboardStatsDto;
};

type PortfolioStatCard = {
  label: string;
  value: string;
  valueClassName?: string;
};

function formatWinRate(value: string | undefined): string {
  if (!value) return "--";

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "--";

  return `${numericValue.toFixed(1)}%`;
}

function formatPnl(value: string | undefined): string {
  if (!value) return "--";

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "--";

  const formatted = formatUsdCurrency(numericValue);
  return numericValue > 0 ? `+${formatted}` : formatted;
}

function formatVolume(totalVolumeSol: string | undefined, solUsdPrice: number | undefined): string {
  if (!totalVolumeSol) return "--";

  const numericVolumeSol = Number(totalVolumeSol);
  if (!Number.isFinite(numericVolumeSol) || numericVolumeSol < 0) return "--";

  if (typeof solUsdPrice !== "number" || !Number.isFinite(solUsdPrice) || solUsdPrice <= 0) {
    return "--";
  }

  return formatUsdCurrency(numericVolumeSol * solUsdPrice);
}

async function fetchPortfolioStats(): Promise<LeaderboardStatsDto | null> {
  const response = await customClient<StatsEnvelope | LeaderboardStatsDto>(
    "/api/stats/me",
    { method: "GET" },
  );

  if ("data" in response && response.data) {
    return response.data;
  }

  if ("pnl" in response && "totalVolume" in response && "winRate" in response) {
    return response;
  }

  return null;
}

export function usePortfolioStatsCards(): PortfolioStatCard[] {
  const { data: solUsdPrice } = useSolUsdPrice();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/stats/me"],
    queryFn: fetchPortfolioStats,
    staleTime: 10_000,
  });

  if (isLoading) {
    return [
      { label: "Total Vol", value: "..." },
      { label: "Win Rate", value: "..." },
      { label: "+Edge Earned", value: "..." },
    ];
  }

  if (isError || !data) {
    return [
      { label: "Total Vol", value: "--" },
      { label: "Win Rate", value: "--" },
      { label: "+Edge Earned", value: "--" },
    ];
  }

  return [
    { label: "Total Vol", value: formatVolume(data.totalVolume, solUsdPrice) },
    {
      label: "Win Rate",
      value: formatWinRate(data.winRate),
      valueClassName: "text-success-medium",
    },
    {
      label: "+Edge Earned",
      value: formatPnl(data.pnl),
      valueClassName: Number(data.pnl) >= 0 ? "text-primary-medium" : undefined,
    },
  ];
}
