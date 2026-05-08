import { getAddress } from "viem";
import { extractFollowedOrderActivities } from "@/src/features/trade/orderFollow";
import type { CellData } from "@/src/features/trade/store";
import type { StoreSnapshot } from "@/src/utils/gridLayout";
import {
  formatApproxUsd as formatApproxUsdValue,
  formatWalletAddress,
} from "@/src/utils/formatters";
import { percentageFormatter } from "./tradingGrid.constants";

export type ShareOverlayTarget = {
  cellId: string;
  left: number;
  top: number;
  centerLeft: number;
  centerTop: number;
  cellEdge: number;
  buttonSize: number;
  isHumanVerified: boolean;
  totalPayout: number;
  basePayout: number;
  bonusPayout: number;
};

export type ActiveWinEffectState = {
  startedAt: number;
  showTotal: boolean;
};

export type WinBetBannerData = {
  username: string;
  amount: number;
  humanVerified: boolean;
};

export type FollowOverlayActivity = ReturnType<
  typeof extractFollowedOrderActivities
>[number];

export type SuggestedStrategyMessage = {
  cells: Array<{
    startTs: number;
    endTs: number;
    lowerPrice: string;
    upperPrice: string;
    rewardRate: string;
  }>;
  volatilityRegime: "low" | "medium" | "high";
  sigma: number | null;
  atrMean: number | null;
  timestamp: number;
};

export function normalizeMarketSocketSegment(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized.length > 0 ? normalized : null;
}

export function toMarketSocketSegment(marketSymbol: string): string {
  const compact = marketSymbol.trim().replace(/\s+/g, "");
  const [baseRaw, quoteRaw] = compact.split("/");
  const base = normalizeMarketSocketSegment(baseRaw) ?? "btc";
  const normalizedQuote = normalizeMarketSocketSegment(quoteRaw);
  const quote = normalizedQuote === "usd" ? "usdt" : (normalizedQuote ?? "usdt");
  return `${base}${quote}`;
}

export function toMarketId(marketSymbol: string): string {
  return toMarketSocketSegment(marketSymbol).toUpperCase();
}

export function toFiniteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function formatPercent(value: number) {
  return `${percentageFormatter.format(value)}%`;
}

export function easeOutCubic(progress: number): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return 1 - (1 - clampedProgress) ** 3;
}

export function extractChallenge(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;

  const record = response as Record<string, unknown>;
  const challenge =
    record.challenge ??
    (record.data &&
    typeof record.data === "object" &&
    !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>).challenge
      : null);

  return typeof challenge === "string" && challenge.trim().length > 0
    ? challenge
    : null;
}

export function extractBalanceAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  return (
    extractBalanceAmount(record.balance) ??
    extractBalanceAmount(record.free) ??
    extractBalanceAmount(record.amount) ??
    extractBalanceAmount(record.availableBalance) ??
    extractBalanceAmount(record.data)
  );
}

export function extractBalanceUserId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const directUserId = record.userId ?? record.userAddress ?? record.address;

  if (typeof directUserId === "string" && directUserId.trim().length > 0) {
    return directUserId.trim();
  }

  return extractBalanceUserId(record.data);
}

export function parseAddress(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  try {
    return getAddress(trimmed);
  } catch {
    return null;
  }
}

export function formatWalletShort(address: string): string {
  return formatWalletAddress(address, {
    emptyLabel: "",
    start: 6,
    end: 4,
    minLength: 13,
  });
}

export function normalizeReferralCode(
  value: string | null | undefined,
): string | null {
  if (!value || typeof value !== "string") return null;
  let decoded = value.trim();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  const trimmed = decoded.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeTimestampToMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
  }

  return null;
}

export function normalizePriceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizePriceString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return value.toString();
  return null;
}

export function extractSuggestedStrategyCellIds(
  payload: unknown,
  currentCells: CellData[],
): string[] | null {
  const payloadRecord =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  const rawCells = Array.isArray(payloadRecord?.cells)
    ? payloadRecord.cells
    : Array.isArray(payload)
      ? payload
      : [];

  const cellIds = new Set<string>();
  let parseFailureCount = 0;
  rawCells.forEach((rawCell) => {
    if (!rawCell || typeof rawCell !== "object" || Array.isArray(rawCell)) return;

    const cell = rawCell as Record<string, unknown>;
    const startTs = normalizeTimestampToMs(cell.startTs);
    const endTs = normalizeTimestampToMs(cell.endTs);
    const lowerPrice = normalizePriceString(cell.lowerPrice);
    const upperPrice = normalizePriceString(cell.upperPrice);
    const lowerPriceNumber = normalizePriceNumber(cell.lowerPrice);
    const upperPriceNumber = normalizePriceNumber(cell.upperPrice);

    if (
      startTs === null ||
      endTs === null ||
      lowerPrice === null ||
      upperPrice === null ||
      lowerPriceNumber === null ||
      upperPriceNumber === null
    ) {
      parseFailureCount += 1;
      return;
    }

    const matchedGridCell = currentCells.find((gridCell) => {
      if (gridCell.timeWindowStart !== startTs || gridCell.timeWindowEnd !== endTs) {
        return false;
      }

      const gridLower = normalizePriceNumber(gridCell.original.lowerPrice);
      const gridUpper = normalizePriceNumber(gridCell.original.upperPrice);
      if (gridLower === null || gridUpper === null) return false;

      return (
        Math.abs(gridLower - lowerPriceNumber) < 1e-8 &&
        Math.abs(gridUpper - upperPriceNumber) < 1e-8
      );
    });

    if (matchedGridCell) {
      cellIds.add(matchedGridCell.id);
      return;
    }

    cellIds.add(`${startTs}:${endTs}:${lowerPrice}:${upperPrice}`);
  });

  if (rawCells.length > 0 && cellIds.size === 0 && parseFailureCount > 0) {
    return null;
  }

  return [...cellIds];
}

export function extractCellTimeRangeFromCellId(cellId: string): { startTs: number; endTs: number } | null {
  const [rawStartTs, rawEndTs] = cellId.split(":");
  const startTs = Number(rawStartTs);
  const endTs = Number(rawEndTs);
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return null;
  return { startTs, endTs };
}

export function extractCellIdentityFromCellId(cellId: string): {
  startTs: number;
  endTs: number;
  lowerPrice: number;
  upperPrice: number;
} | null {
  const parts = cellId.split(":");
  if (parts.length < 4) return null;

  const startTs = normalizeTimestampToMs(parts[parts.length - 4]);
  const endTs = normalizeTimestampToMs(parts[parts.length - 3]);
  const lowerPrice = normalizePriceNumber(parts[parts.length - 2]);
  const upperPrice = normalizePriceNumber(parts[parts.length - 1]);

  if (startTs === null || endTs === null || lowerPrice === null || upperPrice === null) {
    return null;
  }

  return { startTs, endTs, lowerPrice, upperPrice };
}

export function resolveGridCellIdFromActivityCellId(
  rawCellId: string | null,
  currentCells: CellData[],
): string | null {
  if (!rawCellId) return null;
  const trimmedCellId = rawCellId.trim();
  if (!trimmedCellId) return null;

  const exactMatch = currentCells.find((cell) => cell.id === trimmedCellId);
  if (exactMatch) return exactMatch.id;

  const identity = extractCellIdentityFromCellId(trimmedCellId);
  if (!identity) return null;

  const fuzzyMatch = currentCells.find((cell) => {
    if (cell.timeWindowStart !== identity.startTs || cell.timeWindowEnd !== identity.endTs) {
      return false;
    }

    const gridLower = normalizePriceNumber(cell.original.lowerPrice);
    const gridUpper = normalizePriceNumber(cell.original.upperPrice);
    if (gridLower === null || gridUpper === null) return false;

    return (
      Math.abs(gridLower - identity.lowerPrice) < 1e-8 &&
      Math.abs(gridUpper - identity.upperPrice) < 1e-8
    );
  });

  return fuzzyMatch?.id ?? null;
}

export function isCellIdStillAheadOfChart(cellId: string, chartTime: number): boolean {
  const range = extractCellTimeRangeFromCellId(cellId);
  if (!range) return true;
  return range.endTs > chartTime;
}

export function extractUserOrders(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.orders)) return record.orders;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;

  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    const nested = record.data as Record<string, unknown>;
    if (Array.isArray(nested.orders)) return nested.orders;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.results)) return nested.results;
  }

  return [];
}

export function buildDisplayHistory(
  history: StoreSnapshot["history"],
  now: number,
  displayPrice: number,
  lockLatestPriceToDisplay = false,
): StoreSnapshot["history"] {
  if (history.length === 0 || !Number.isFinite(displayPrice)) return history;

  const lastPoint = history[history.length - 1];
  const baseHistory =
    lockLatestPriceToDisplay && history.length > 0
      ? [
          ...history.slice(0, -1),
          {
            time: lastPoint.time,
            price: displayPrice,
          },
        ]
      : history;
  const latestPoint = baseHistory[baseHistory.length - 1];
  const displayTime = Math.max(now, lastPoint.time);

  if (
    displayTime === latestPoint.time &&
    Math.abs(displayPrice - latestPoint.price) < 1e-6
  ) {
    return baseHistory;
  }

  return [...baseHistory, { time: displayTime, price: displayPrice }];
}

export function extractBinanceKlineHistory(value: unknown): StoreSnapshot["history"] {
  if (!Array.isArray(value)) return [];

  const points: StoreSnapshot["history"] = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length < 5) continue;

    const openTimeRaw = row[0];
    const closePriceRaw = row[4];
    const time =
      typeof openTimeRaw === "number"
        ? openTimeRaw
        : Number.parseInt(String(openTimeRaw), 10);
    const price = Number(closePriceRaw);

    if (!Number.isFinite(time) || !Number.isFinite(price) || time <= 0) continue;
    points.push({ time, price });
  }

  if (points.length < 2) return points;
  points.sort((a, b) => a.time - b.time);
  return points;
}

export function formatApproxUsd(amountWld: number, wldUsdPrice: number | null) {
  return formatApproxUsdValue(amountWld, wldUsdPrice);
}

export function areBooleanMapsEqual(
  left: Record<string, boolean>,
  right: Record<string, boolean>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}
