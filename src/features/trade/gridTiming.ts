"use client";

import type { PricePoint } from "@/src/features/trade/store";

export function getLatestChartTime(history: PricePoint[], fallbackNow: number) {
  if (history.length === 0) return fallbackNow;
  return history[history.length - 1].time;
}

export function getCellHideThresholdTime(chartTime: number) {
  return chartTime;
}
