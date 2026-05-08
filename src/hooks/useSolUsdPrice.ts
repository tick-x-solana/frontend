"use client";

import { useQuery } from "@tanstack/react-query";

export const BINANCE_SOL_PRICE_URL =
  "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT";

type BinancePriceResponse = {
  symbol?: string;
  price?: string;
};

export async function fetchSolUsdPrice(): Promise<number> {
  const response = await fetch(BINANCE_SOL_PRICE_URL, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch SOL/USDT price from Binance");
  }

  const json = (await response.json()) as BinancePriceResponse;
  const price = parseFloat(json.price ?? "");

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Invalid SOL/USDT price from Binance");
  }

  return price;
}

function useSolUsdPrice(enabled = true) {
  return useQuery({
    queryKey: ["sol-usd-price"],
    queryFn: fetchSolUsdPrice,
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Do not retry on rate limit errors
      if (error instanceof Error && error.message.includes("Rate limited")) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export default useSolUsdPrice;
