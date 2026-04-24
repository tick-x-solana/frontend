"use client";

import { useQuery } from "@tanstack/react-query";

export const COINGECKO_WLD_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=worldcoin&vs_currencies=usd";

type CoinGeckoSimplePriceResponse = {
  worldcoin?: {
    usd?: number;
  };
};

export async function fetchWldUsdPrice(): Promise<number> {
  const response = await fetch(COINGECKO_WLD_PRICE_URL, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch WLD/USD price from CoinGecko");
  }

  const json = (await response.json()) as CoinGeckoSimplePriceResponse;
  const price = json.worldcoin?.usd;

  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error("Invalid WLD/USD price from CoinGecko");
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
