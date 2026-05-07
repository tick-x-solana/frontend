/**
 * useShareSheetData — derives all data needed to populate the share sheet for a
 * selected winning cell: amounts, profit, ROI, time, win-rate, and USD conversions.
 */

import { useState, useMemo, useCallback } from "react";
import type { CellData, SettledOutcome } from "@/src/features/trade/store";
import { shareTimeFormatter } from "../components/tradingGrid.constants";
import {
  formatPercent,
  toFiniteNumber,
} from "../components/tradingGrid.utils";

type SettledOutcomes = Record<string, SettledOutcome>;

export function useShareSheetData({
  cells,
  bets,
  pendingBets,
  betAmount,
  settledOutcomes,
  wldUsdPrice,
}: {
  cells: CellData[];
  bets: Record<string, number>;
  pendingBets: Record<string, number>;
  betAmount: number;
  settledOutcomes: SettledOutcomes;
  wldUsdPrice: number | null | undefined;
}) {
  const [shareCellId, setShareCellId] = useState<string | null>(null);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);

  const handleOpenShareSheet = useCallback((cellId: string) => {
    setShareCellId(cellId);
    setIsShareSheetOpen(true);
  }, []);

  const selectedShareCell = useMemo(
    () => cells.find((cell) => cell.id === shareCellId) ?? null,
    [cells, shareCellId],
  );

  const selectedShareAmountWld = selectedShareCell
    ? bets[selectedShareCell.id] ||
      pendingBets[selectedShareCell.id] ||
      betAmount
    : betAmount;
  const selectedShareAmount = toFiniteNumber(selectedShareAmountWld);

  const selectedShareProfit = useMemo(() => {
    if (!selectedShareCell) return 0;
    const settledPayout = settledOutcomes[selectedShareCell.id]?.payout;
    if (typeof settledPayout === "number" && Number.isFinite(settledPayout)) {
      return Math.max(settledPayout, 0);
    }
    return toFiniteNumber(
      selectedShareAmount *
        Math.max((selectedShareCell.multiplier ?? 0) - 1, 0),
    );
  }, [selectedShareAmount, selectedShareCell, settledOutcomes]);

  const shareWinRate = useMemo(() => {
    const settled = Object.values(settledOutcomes);
    if (settled.length === 0) return null;
    const wins = settled.filter((item) => item.isWin).length;
    return formatPercent((wins / settled.length) * 100);
  }, [settledOutcomes]);

  const selectedShareRoi = useMemo(() => {
    if (!selectedShareCell || selectedShareAmount <= 0) return null;
    return formatPercent((selectedShareProfit / selectedShareAmount) * 100);
  }, [selectedShareAmount, selectedShareCell, selectedShareProfit]);

  const selectedShareTime = useMemo(() => {
    if (!selectedShareCell) return "--:--:--";
    return shareTimeFormatter.format(
      new Date(selectedShareCell.timeWindowStart),
    );
  }, [selectedShareCell]);

  const selectedShareProfitApproxUsd = useMemo(() => {
    if (typeof wldUsdPrice !== "number" || !Number.isFinite(wldUsdPrice))
      return null;
    return selectedShareProfit * wldUsdPrice;
  }, [selectedShareProfit, wldUsdPrice]);

  const selectedShareAmountUsd = useMemo(() => {
    if (typeof wldUsdPrice !== "number" || !Number.isFinite(wldUsdPrice))
      return 0;
    return toFiniteNumber(selectedShareAmount * wldUsdPrice);
  }, [selectedShareAmount, wldUsdPrice]);

  const selectedShareProfitUsd = useMemo(() => {
    if (selectedShareProfitApproxUsd === null) return 0;
    return toFiniteNumber(selectedShareProfitApproxUsd);
  }, [selectedShareProfitApproxUsd]);

  return {
    shareCellId,
    setShareCellId,
    isShareSheetOpen,
    setIsShareSheetOpen,
    handleOpenShareSheet,
    selectedShareCell,
    selectedShareAmount,
    selectedShareAmountUsd,
    selectedShareProfit,
    selectedShareProfitUsd,
    selectedShareTime,
    selectedShareRoi,
    shareWinRate,
    selectedShareProfitApproxUsd,
  };
}
