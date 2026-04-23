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
  status: "active" | "past" | "hit";
  original: RemoteCell;
}

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
  updatePrice: (price: number, ts?: number) => void;
  updateGrid: (remoteCells: RemoteCell[]) => void;
}

const MODE_INTERVAL_SECONDS = 5;
const MODE_PRICE_STEP = 25;
// Limit chart length
const MAX_HISTORY_POINTS = 1040;
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
  socket: null,
  wssKey: null,
  followedOrderActivities: [],
  betAmount: 10,
  serverTimeOffset: 0,

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

      const nextHistory = [...state.history, { time: safeTs, price }].slice(
        -MAX_HISTORY_POINTS,
      );
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
      let nextServerTimeOffset = state.serverTimeOffset;

      const latestGridTs = remoteCells.reduce<number | null>((latest, cell) => {
        const gridTs = toMsIfFinite(cell.gridTs);
        if (gridTs === null) return latest;
        if (latest === null || gridTs > latest) return gridTs;
        return latest;
      }, null);

      if (latestGridTs !== null) {
        const observedOffset = latestGridTs - Date.now();
        nextServerTimeOffset = blendServerOffset(
          state.serverTimeOffset,
          observedOffset,
        );
      }

      const now = getServerNow(nextServerTimeOffset);
      const chartTime = getLatestChartTime(state.history, now);
      const hideThresholdTime = getCellHideThresholdTime(chartTime);
      const incomingCells = mapRemoteCells(remoteCells, now);
      const incomingIds = new Set(incomingCells.map((cell) => cell.id));
      const retainedCells = state.cells
        .filter((cell) => {
          if (incomingIds.has(cell.id)) return false;

          const hasTrackedState =
            (state.bets[cell.id] || 0) > 0 ||
            (state.pendingBets[cell.id] || 0) > 0 ||
            state.pendingWins[cell.id] !== undefined;

          // Keep cells the server has already rolled off only until the chart
          // reaches that column. This keeps store retention aligned with the
          // canvas hide threshold.
          return cell.timeWindowStart > hideThresholdTime || hasTrackedState;
        })
        .map((cell) => ({
          ...cell,
          status:
            cell.status === "hit"
              ? "hit"
              : statusForWindow(now, cell.timeWindowStart, cell.timeWindowEnd),
        }));

      return {
        cells: [...retainedCells, ...incomingCells].sort(sortGridCells),
        serverTimeOffset: nextServerTimeOffset,
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
      let nextServerBalance = state.serverBalance;
      let changed = false;

      for (const [cellId, pendingAmount] of Object.entries(state.pendingBets)) {
        const cell = state.cells.find((c) => c.id === cellId);
        if (!cell) {
          delete nextPendingBets[cellId];
          changed = true;
          continue;
        }
        if (now > cell.timeWindowStart) {
          nextBets[cellId] = pendingAmount;
          delete nextPendingBets[cellId];
          nextServerBalance -= pendingAmount;
          changed = true;
        }
      }

      const nextCells: CellData[] = state.cells.map((cell) => {
        const hasBet = (nextBets[cell.id] || 0) > 0;
        const isPast = now > cell.timeWindowEnd;
        const nextStatus: CellData["status"] = isPast ? "past" : "active";
        if (!hasBet) {
          return { ...cell, status: nextStatus };
        }

        const inBand =
          state.currentPrice >= cell.priceLevel - state.modePriceStep / 2 &&
          state.currentPrice <= cell.priceLevel + state.modePriceStep / 2;
        if (isPast && inBand) {
          if (nextPendingWins[cell.id] === undefined) {
            nextPendingWins[cell.id] = nextBets[cell.id] * cell.multiplier;
            changed = true;
          }
          return { ...cell, status: "hit" as const };
        }
        return { ...cell, status: nextStatus };
      });

      if (!changed) return state;

      const pendingWinsTotal = Object.values(nextPendingWins).reduce(
        (sum, win) => sum + win,
        0,
      );

      return {
        cells: nextCells,
        pendingBets: nextPendingBets,
        bets: nextBets,
        pendingWins: nextPendingWins,
        serverBalance: nextServerBalance,
        balance: nextServerBalance - pendingWinsTotal,
      };
    }),
}));
