"use client";

import { useQuery } from "@tanstack/react-query";

export const DEXSCREENER_WLD_PRICE_URL =
  "https://api.dexscreener.com/latest/dex/tokens/0x2cFc85d8E48F8EAB294be644d9E25C3030863003";

type DexScreenerPair = {
  chainId?: string;
  priceUsd?: string;
  liquidity?: {
    usd?: number;
  };
  baseToken?: {
    symbol?: string;
  };
  quoteToken?: {
    symbol?: string;
  };
};

type DexScreenerTokenResponse = {
  pairs?: DexScreenerPair[];
};

export async function fetchWldUsdPrice(): Promise<number> {
  const response = await fetch(DEXSCREENER_WLD_PRICE_URL, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch WLD/USD price from DexScreener");
  }

  const json = (await response.json()) as DexScreenerTokenResponse;
  const pairs = Array.isArray(json.pairs) ? json.pairs : [];
  const wldUsdcPairs = pairs.filter((pair) => {
    return (
      pair.chainId?.toLowerCase() === "worldchain" &&
      pair.baseToken?.symbol?.toUpperCase() === "WLD" &&
      pair.quoteToken?.symbol?.toUpperCase() === "USDC"
    );
  });

  const sortedPairs = [...wldUsdcPairs].sort((a, b) => {
    const liquidityA = a.liquidity?.usd ?? 0;
    const liquidityB = b.liquidity?.usd ?? 0;
    return liquidityB - liquidityA;
  });
  const rawPrice = sortedPairs[0]?.priceUsd;
  const price = typeof rawPrice === "string" ? Number(rawPrice) : NaN;

  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error("Invalid WLD/USD price from DexScreener");
  }

  return price;
}

function useWldUsdPrice(enabled = true) {
  return useQuery({
    queryKey: ["wld-usd-price"],
    queryFn: fetchWldUsdPrice,
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export default useWldUsdPrice;
