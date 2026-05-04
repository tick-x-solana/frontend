"use client";

import { create } from "zustand";
import {
  getCellHideThresholdTime,
  getLatestChartTime,
} from "@/src/features/trade/gridTiming";
import type { FollowedOrderActivity } from "@/src/features/trade/orderFollow";

export interface PricePoint {
  time: number;
  price: number;
}

export interface RemoteCell {
  gridTs: number;
  startTs: number;
  endTs: number;
  lowerPrice: string;
  upperPrice: string;
  rewardRate: string;
  gridSignature: string;
}

export interface CellData {
  id: string;
  timeWindowStart: number;
  timeWindowEnd: number;
  priceLevel: number;
  multiplier: number;
  status: "active" | "past" | "hit" | "lose";
  original: RemoteCell;
}

export type SettledOutcome = {
  isWin: boolean;
  revealed: boolean;
  payout: number | null;
  basePayout: number | null;
  bonusPayout: number | null;
  isHumanVerified: boolean;
};

interface GameState {
  balance: number;
  serverBalance: number;
  currentPrice: number;
  history: PricePoint[];
  cells: CellData[];
  basePrice: number;
  modeIntervalSeconds: number;
  modePriceStep: number;
  bets: Record<string, number>;
  pendingBets: Record<string, number>;
  pendingWins: Record<string, number>;
  settledOutcomes: Record<string, SettledOutcome>;
  socket: unknown | null;
  wssKey: string | null;
  followedOrderActivities: FollowedOrderActivity[];
  betAmount: number;
  serverTimeOffset: number;
  setBetAmount: (amount: number) => void;
  placeBet: (cellId: string, amount: number) => void;
  checkWinEffects: (now: number) => void;
  setConnection: (socket: unknown | null, wssKey?: string | null) => void;
  setWssKey: (wssKey: string | null) => void;
  upsertFollowedOrderActivity: (activity: FollowedOrderActivity) => void;
  hydrateHistory: (points: PricePoint[]) => void;
  updatePrice: (price: number, ts?: number) => void;
  updateGrid: (remoteCells: RemoteCell[]) => void;
  updateOrder: (payload: unknown) => void;
  resetGridData: () => void;
}

const MODE_INTERVAL_SECONDS = 5;
const MODE_PRICE_STEP = 25;
const DEFAULT_BET_AMOUNT_WLD = 1;
const MAX_FOLLOWED_ORDER_ACTIVITIES = 200;
// Very slow smoothing (2%) so each price tick moves serverTimeOffset by at most
// ~120ms — shift of ~0.8px at typical zoom. Faster convergence would cause
// nowRef to jump each tick, shifting the entire viewport.
const SERVER_OFFSET_SMOOTHING = 0.02;

const toCellId = (
  startTs: number,
  endTs: number,
  lowerPrice: string,
  upperPrice: string,
) => `${startTs}:${endTs}:${lowerPrice}:${upperPrice}`;

function statusForWindow(
  now: number,
  startTs: number,
  endTs: number,
): CellData["status"] {
  if (now > endTs) return "past";
  if (now >= startTs && now <= endTs) return "active";
  return "active";
}

function normalizeTs(ts?: number): number {
  if (!ts || !Number.isFinite(ts)) return Date.now();
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

function toMsIfFinite(ts: number | null | undefined): number | null {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toNonNegativeFiniteNumber(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  return parsed >= 0 ? parsed : null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOrderIdCellParts(orderId: unknown) {
  if (typeof orderId !== "string") return null;
  const parts = orderId.split(":");
  if (parts.length < 5) return null;
  const start = parts[parts.length - 4];
  const end = parts[parts.length - 3];
  const lower = parts[parts.length - 2];
  const upper = parts[parts.length - 1];
  return { start, end, lower, upper };
}

function resolveOrderCellId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const cell =
    record.cell && typeof record.cell === "object" && !Array.isArray(record.cell)
      ? (record.cell as Record<string, unknown>)
      : null;
  const orderIdParts = parseOrderIdCellParts(record.orderId);

  const startRaw =
    record.cellTimeStart ??
    record.startTs ??
    cell?.startTs ??
    orderIdParts?.start;
  const endRaw =
    record.cellTimeEnd ??
    record.endTs ??
    cell?.endTs ??
    orderIdParts?.end;
  const lowerRaw = record.lowerPrice ?? cell?.lowerPrice ?? orderIdParts?.lower;
  const upperRaw = record.upperPrice ?? cell?.upperPrice ?? orderIdParts?.upper;

  const startMs = toMsIfFinite(toFiniteNumber(startRaw));
  const endMs = toMsIfFinite(toFiniteNumber(endRaw));
  const lower = toNonEmptyString(lowerRaw);
  const upper = toNonEmptyString(upperRaw);

  if (startMs === null || endMs === null || !lower || !upper) return null;
  return toCellId(startMs, endMs, lower, upper);
}

function resolveRewardRate(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const cell =
    record.cell && typeof record.cell === "object" && !Array.isArray(record.cell)
      ? (record.cell as Record<string, unknown>)
      : null;
  return toNonEmptyString(record.rewardRate) ?? toNonEmptyString(cell?.rewardRate);
}

function getServerNow(serverTimeOffset: number): number {
  return Date.now() + serverTimeOffset;
}

function blendServerOffset(
  previousOffset: number,
  nextObservedOffset: number,
): number {
  if (!Number.isFinite(nextObservedOffset)) return previousOffset;
  if (!Number.isFinite(previousOffset)) return nextObservedOffset;

  const delta = nextObservedOffset - previousOffset;
  // Only snap on very large divergence (>30s) — e.g. first tick after reconnect.
  // Smaller deltas use the slow EMA so serverTimeOffset drifts gradually.
  if (Math.abs(delta) > 30000) return nextObservedOffset;

  return previousOffset + delta * SERVER_OFFSET_SMOOTHING;
}

function mapRemoteCells(remoteCells: RemoteCell[], now: number): CellData[] {
  return remoteCells
    .map((remote) => {
      const lower = Number(remote.lowerPrice);
      const upper = Number(remote.upperPrice);
      if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;

      const startTs = toMsIfFinite(remote.startTs);
      const endTs = toMsIfFinite(remote.endTs);
      if (startTs === null || endTs === null) return null;
      const priceLevel = (lower + upper) / 2;
      const multiplier = Number(remote.rewardRate);
      const id = toCellId(startTs, endTs, remote.lowerPrice, remote.upperPrice);

      return {
        id,
        timeWindowStart: startTs,
        timeWindowEnd: endTs,
        priceLevel,
        multiplier: Number.isFinite(multiplier) ? multiplier : 0,
        status: statusForWindow(now, startTs, endTs),
        original: remote,
      };
    })
    .filter((cell): cell is CellData => cell !== null);
}

/**
 * Some backend bursts may include cells from multiple grid snapshots in one payload.
 * Keep only the newest snapshot to avoid mixing old/new windows and distorting
 * the visible grid shape after fast price moves.
 */
function keepLatestGridSnapshot(remoteCells: RemoteCell[]): RemoteCell[] {
  if (remoteCells.length <= 1) return remoteCells;

  let latestGridTs: number | null = null;
  for (const cell of remoteCells) {
    const gridTsMs = toMsIfFinite(cell.gridTs);
    if (gridTsMs === null) continue;
    if (latestGridTs === null || gridTsMs > latestGridTs) {
      latestGridTs = gridTsMs;
    }
  }

  if (latestGridTs === null) return remoteCells;
  return remoteCells.filter((cell) => toMsIfFinite(cell.gridTs) === latestGridTs);
}

function sortGridCells(a: CellData, b: CellData): number {
  if (a.timeWindowStart !== b.timeWindowStart) {
    return a.timeWindowStart - b.timeWindowStart;
  }
  return b.priceLevel - a.priceLevel;
}

export const useGameStore = create<GameState>((set) => ({
  balance: 0,
  serverBalance: 0,
  currentPrice: 0,
  history: [],
  cells: [],
  basePrice: 0,
  modeIntervalSeconds: MODE_INTERVAL_SECONDS,
  modePriceStep: MODE_PRICE_STEP,
  bets: {},
  pendingBets: {},
  pendingWins: {},
  settledOutcomes: {},
  socket: null,
  wssKey: null,
  followedOrderActivities: [],
  betAmount: DEFAULT_BET_AMOUNT_WLD,
  serverTimeOffset: 0,

  resetGridData: () => set({ cells: [], history: [], currentPrice: 0, basePrice: 0 }),

  setBetAmount: (amount) => set({ betAmount: amount }),

  setConnection: (socket, wssKey = null) => set({ socket, wssKey }),

  setWssKey: (wssKey) => set({ wssKey }),

  upsertFollowedOrderActivity: (activity) =>
    set((state) => {
      const nextActivities = state.followedOrderActivities.filter(
        (item) =>
          !(
            item.targetUserId === activity.targetUserId &&
            item.cellId === activity.cellId
          ),
      );

      nextActivities.push(activity);
      nextActivities.sort((a, b) => b.observedAt - a.observedAt);

      return {
        followedOrderActivities: nextActivities.slice(
          0,
          MAX_FOLLOWED_ORDER_ACTIVITIES,
        ),
      };
    }),

  hydrateHistory: (points) =>
    set((state) => {
      if (!Array.isArray(points) || points.length === 0) return state;

      const historyByTime = new Map<number, number>();
      for (const point of state.history) {
        if (
          Number.isFinite(point?.time) &&
          Number.isFinite(point?.price) &&
          point.time > 0
        ) {
          historyByTime.set(point.time, point.price);
        }
      }

      for (const point of points) {
        if (
          Number.isFinite(point?.time) &&
          Number.isFinite(point?.price) &&
          point.time > 0
        ) {
          historyByTime.set(point.time, point.price);
        }
      }

      if (historyByTime.size === 0) return state;

      const mergedHistory = Array.from(historyByTime.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([time, price]) => ({ time, price }));

      if (mergedHistory.length === 0) return state;

      const latestPoint = mergedHistory[mergedHistory.length - 1];
      const observedOffset = latestPoint.time - Date.now();
      const nextServerTimeOffset = blendServerOffset(
        state.serverTimeOffset,
        observedOffset,
      );

      return {
        history: mergedHistory,
        currentPrice: latestPoint.price,
        basePrice: state.basePrice > 0 ? state.basePrice : mergedHistory[0].price,
        serverTimeOffset: nextServerTimeOffset,
      };
    }),

  updatePrice: (price, ts) =>
    set((state) => {
      if (!Number.isFinite(price)) return state;
      const normalizedTs = normalizeTs(ts);

      // Never append a history point that goes backwards in time — this would
      // cause the price-line dot to jump left each time a tick arrives without
      // a valid timestamp (normalizeTs falls back to Date.now() which can be
      // several seconds behind the last server-timestamped point).
      const lastHistoryTime =
        state.history.length > 0
          ? state.history[state.history.length - 1].time
          : 0;
      const safeTs = Math.max(normalizedTs, lastHistoryTime);

      const nextHistory = [...state.history, { time: safeTs, price }];
      const observedOffset = normalizedTs - Date.now();
      const nextServerTimeOffset = blendServerOffset(
        state.serverTimeOffset,
        observedOffset,
      );
      return {
        currentPrice: price,
        history: nextHistory,
        basePrice: state.basePrice > 0 ? state.basePrice : price,
        serverTimeOffset: nextServerTimeOffset,
      };
    }),

  updateGrid: (remoteCells) =>
    set((state) => {
      if (!Array.isArray(remoteCells)) return {};
      // gridTs can represent grid window anchors (often in the future), not
      // authoritative server "now". Sync clock only from price timestamps.
      const now = getServerNow(state.serverTimeOffset);
      const chartTime = getLatestChartTime(state.history, now);
      const hideThresholdTime = getCellHideThresholdTime(chartTime);
      const latestSnapshotCells = keepLatestGridSnapshot(remoteCells);
      const existingCellById = new Map(state.cells.map((cell) => [cell.id, cell]));
      const incomingCells = mapRemoteCells(latestSnapshotCells, now).map((incomingCell) => {
        const existingCell = existingCellById.get(incomingCell.id);
        if (!existingCell) return incomingCell;

        const shouldFreezeMultiplier =
          (state.bets[incomingCell.id] || 0) > 0 ||
          (state.pendingBets[incomingCell.id] || 0) > 0 ||
          state.pendingWins[incomingCell.id] !== undefined ||
          state.settledOutcomes[incomingCell.id] !== undefined;

        if (!shouldFreezeMultiplier) return incomingCell;

        return {
          ...incomingCell,
          multiplier: existingCell.multiplier,
          status:
            existingCell.status === "hit" || existingCell.status === "lose"
              ? existingCell.status
              : incomingCell.status,
          original: {
            ...incomingCell.original,
            rewardRate: existingCell.original.rewardRate,
          },
        };
      });
      const incomingIds = new Set(incomingCells.map((cell) => cell.id));
      const retainedCells = state.cells
        .filter((cell) => {
          if (incomingIds.has(cell.id)) return false;

          const hasTrackedState =
            (state.bets[cell.id] || 0) > 0 ||
            (state.pendingBets[cell.id] || 0) > 0 ||
            state.pendingWins[cell.id] !== undefined ||
            state.settledOutcomes[cell.id] !== undefined;
          const settledOutcome = state.settledOutcomes[cell.id];
          const shouldKeepSettledWin =
            settledOutcome?.isWin === true || cell.status === "hit";

          // For plain cells, trust the newest server snapshot immediately.
          // Only preserve cells that have local tracked state (bet/outcome),
          // so user feedback remains visible while avoiding mixed-grid artifacts.
          if (shouldKeepSettledWin) return true;
          return hasTrackedState && cell.timeWindowEnd > hideThresholdTime;
        })
        .map((cell) => ({
          ...cell,
          status:
            cell.status === "hit" || cell.status === "lose"
              ? cell.status
              : statusForWindow(now, cell.timeWindowStart, cell.timeWindowEnd),
        }));

      return {
        cells: [...retainedCells, ...incomingCells].sort(sortGridCells),
      };
    }),

  placeBet: (cellId, amount) =>
    set((state) => {
      if (amount <= 0 || amount > state.balance) return state;
      if (
        (state.bets[cellId] || 0) > 0 ||
        (state.pendingBets[cellId] || 0) > 0
      ) {
        return state;
      }
      return {
        pendingBets: { ...state.pendingBets, [cellId]: amount },
      };
    }),

  checkWinEffects: (now) =>
    set((state) => {
      const nextPendingBets = { ...state.pendingBets };
      const nextBets = { ...state.bets };
      const nextPendingWins = { ...state.pendingWins };
      const nextSettledOutcomes = { ...state.settledOutcomes };
      let changed = false;

      const nextCells: CellData[] = state.cells.map((cell) => {
        const hasBet =
          (nextBets[cell.id] || 0) > 0 || (nextPendingBets[cell.id] || 0) > 0;
        const hasSettledOutcome = nextSettledOutcomes[cell.id] !== undefined;
        const isPast = now >= cell.timeWindowEnd;
        const chartPassedCellEnd = now >= cell.timeWindowEnd;
        let nextStatus: CellData["status"] = isPast ? "past" : "active";
        const settledOutcome = nextSettledOutcomes[cell.id];

        if (!hasBet && !hasSettledOutcome) {
          if (cell.status !== nextStatus) {
            changed = true;
            return { ...cell, status: nextStatus };
          }
          return cell;
        }

        if (settledOutcome) {
          if (settledOutcome.isWin) {
            nextStatus = "hit";
            if (!settledOutcome.revealed) {
              if (nextPendingWins[cell.id] !== undefined) {
                delete nextPendingWins[cell.id];
              }
              nextSettledOutcomes[cell.id] = {
                ...settledOutcome,
                revealed: true,
              };
              changed = true;
            }
          } else {
            // Keep losing cells neutral until the chart actually reaches them.
            // This avoids painting other same-row bets red too early when the
            // backend settles outcomes ahead of the visual chart head.
            nextStatus = chartPassedCellEnd ? "lose" : isPast ? "past" : "active";
            if (!settledOutcome.revealed) {
              nextSettledOutcomes[cell.id] = {
                ...settledOutcome,
                revealed: true,
              };
              changed = true;
            }
          }
        } else if (chartPassedCellEnd) {
          // Show immediate loss feedback when chart passes the bet cell end but
          // no settled outcome has arrived yet; a later WIN update can still
          // override this to "hit".
          nextStatus = "lose";
        } else if (cell.status === "hit" || cell.status === "lose") {
          nextStatus = cell.status;
        }

        if (cell.status !== nextStatus) {
          changed = true;
          return { ...cell, status: nextStatus };
        }

        return cell;
      });

      if (!changed) return state;

      return {
        cells: nextCells,
        pendingBets: nextPendingBets,
        bets: nextBets,
        pendingWins: nextPendingWins,
        settledOutcomes: nextSettledOutcomes,
        balance: state.serverBalance,
      };
    }),

  updateOrder: (payload) =>
    set((state) => {
      const cellId = resolveOrderCellId(payload);
      if (!cellId) return state;

      const record =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : null;
      if (!record) return state;

      const status = toNonEmptyString(record.status)?.toUpperCase();
      const amount = toFiniteNumber(record.amount);
      const rewardRate = resolveRewardRate(payload);
      const rewardRateNum = toFiniteNumber(rewardRate);
      const statusIsWin = status === "WIN" || status === "WON";
      const statusIsLose =
        status === "LOSE" ||
        status === "LOST" ||
        status === "FAIL" ||
        status === "FAILED";
      const isSettled = status === "SETTLED" || statusIsWin || statusIsLose;

      const nextPendingBets = { ...state.pendingBets };
      const nextBets = { ...state.bets };
      const nextPendingWins = { ...state.pendingWins };
      const nextSettledOutcomes = { ...state.settledOutcomes };
      const now = getServerNow(state.serverTimeOffset);
      let changed = false;

      if (status === "OPEN") {
        const confirmedAmount = amount ?? nextPendingBets[cellId] ?? 0;
        delete nextPendingBets[cellId];
        if (confirmedAmount > 0) {
          nextBets[cellId] = confirmedAmount;
        }
        changed = true;
      }

      if (isSettled) {
        const settledWinRaw = record.settledWin ?? record.outcome;
        const settledWinText = toNonEmptyString(settledWinRaw)?.toUpperCase();
        const hasExplicitOutcome =
          settledWinRaw !== undefined && settledWinRaw !== null;
        const outcomeIsWin =
          settledWinRaw === true ||
          settledWinText === "TRUE" ||
          settledWinText === "WIN";
        const outcomeIsLose =
          settledWinRaw === false ||
          settledWinText === "FALSE" ||
          settledWinText === "LOSE" ||
          settledWinText === "LOST" ||
          settledWinText === "FAIL" ||
          settledWinText === "FAILED";

        const hasOutcomeSignal = hasExplicitOutcome || statusIsWin || statusIsLose;
        const isWin = statusIsWin || (outcomeIsWin && !statusIsLose);
        const isLose = statusIsLose || (outcomeIsLose && !statusIsWin);
        const resolvedIsWin = hasOutcomeSignal ? isWin && !isLose : false;

        nextSettledOutcomes[cellId] = {
          isWin: resolvedIsWin,
          revealed: nextSettledOutcomes[cellId]?.revealed ?? false,
          payout: nextSettledOutcomes[cellId]?.payout ?? null,
          basePayout: nextSettledOutcomes[cellId]?.basePayout ?? null,
          bonusPayout: nextSettledOutcomes[cellId]?.bonusPayout ?? null,
          isHumanVerified: nextSettledOutcomes[cellId]?.isHumanVerified ?? false,
        };

        if (resolvedIsWin) {
          const baseAmount = amount ?? nextBets[cellId] ?? nextPendingBets[cellId] ?? 0;
          const settledBasePayout = toNonNegativeFiniteNumber(
            record.settledBasePayout,
          );
          const settledBonusPayout = toNonNegativeFiniteNumber(
            record.settledBonusPayout,
          );
          const settledPayout = toNonNegativeFiniteNumber(record.settledPayout);
          const hasSettledPayoutParts =
            settledBasePayout !== null || settledBonusPayout !== null;
          const resolvedPayoutFromParts = hasSettledPayoutParts
            ? (settledBasePayout ?? 0) + (settledBonusPayout ?? 0)
            : null;
          const resolvedPayout =
            resolvedPayoutFromParts ?? settledPayout ?? null;
          const isHumanVerified = (settledBonusPayout ?? 0) > 0;

          nextSettledOutcomes[cellId] = {
            ...nextSettledOutcomes[cellId],
            payout: resolvedPayout,
            basePayout:
              settledBasePayout ??
              (resolvedPayout !== null
                ? Math.max(resolvedPayout - (settledBonusPayout ?? 0), 0)
                : null),
            bonusPayout: settledBonusPayout ?? 0,
            isHumanVerified,
          };

          if (resolvedPayout !== null && resolvedPayout > 0) {
            nextPendingWins[cellId] = resolvedPayout;
          } else if (baseAmount > 0) {
            const mult =
              rewardRateNum ??
              state.cells.find((c) => c.id === cellId)?.multiplier ??
              0;
            nextPendingWins[cellId] = baseAmount * Math.max(mult, 0);
          }
        } else {
          delete nextPendingWins[cellId];
        }

        const resolvedStakeAmount =
          amount ?? nextBets[cellId] ?? nextPendingBets[cellId] ?? 0;
        if (resolvedStakeAmount > 0 && !nextBets[cellId]) {
          nextBets[cellId] = resolvedStakeAmount;
        }
        delete nextPendingBets[cellId];
        changed = true;
      }

      if (status === "REJECTED") {
        delete nextPendingBets[cellId];
        delete nextBets[cellId];
        delete nextPendingWins[cellId];
        delete nextSettledOutcomes[cellId];
        changed = true;
      }

      const nextCells = state.cells.map((cell) => {
        if (cell.id !== cellId) return cell;

        const nextCell: CellData = { ...cell };
        const chartPassedCellEnd = now >= cell.timeWindowEnd;
        if (rewardRate) {
          const resolvedMultiplier =
            rewardRateNum !== null ? rewardRateNum : cell.multiplier;
          nextCell.multiplier = resolvedMultiplier;
          nextCell.original = {
            ...cell.original,
            rewardRate,
          };
        }

        if (isSettled) {
          const settled = nextSettledOutcomes[cellId];
          if (settled?.isWin) {
            nextCell.status = "hit";
          } else if (chartPassedCellEnd) {
            nextCell.status = "lose";
          }
        }

        changed = true;
        return nextCell;
      });

      if (!changed) return state;

      return {
        cells: nextCells,
        pendingBets: nextPendingBets,
        bets: nextBets,
        pendingWins: nextPendingWins,
        settledOutcomes: nextSettledOutcomes,
        balance: state.serverBalance,
      };
    }),
}));
