"use client";

import { useQuery } from "@tanstack/react-query";

export const COINGECKO_SOL_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

type CoinGeckoSolPriceResponse = {
  solana?: {
    usd?: number;
  };
};

export async function fetchSolUsdPrice(): Promise<number> {
  const response = await fetch(COINGECKO_SOL_PRICE_URL, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch SOL/USD price from CoinGecko");
  }

  const json = (await response.json()) as CoinGeckoSolPriceResponse;
  const price = json.solana?.usd;

  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error("Invalid SOL/USD price from CoinGecko");
  }

  return price;
}

function useSolUsdPrice(enabled = true) {
  return useQuery({
    queryKey: ["sol-usd-price"],
    queryFn: fetchSolUsdPrice,
    enabled,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
}

export default useSolUsdPrice;
