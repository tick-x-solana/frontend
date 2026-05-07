"use client";

import { create } from "zustand";
import {
  getCellHideThresholdTime,
  getLatestChartTime,
} from "@/src/features/trade/gridTiming";
import type { FollowedOrderActivity } from "@/src/features/trade/orderFollow";
import {
  MODE_INTERVAL_SECONDS,
  MODE_PRICE_STEP,
  DEFAULT_BET_AMOUNT_WLD,
  MAX_FOLLOWED_ORDER_ACTIVITIES,
} from "./storeConstants";
import {
  normalizeTs,
  toFiniteNumber,
  toNonNegativeFiniteNumber,
  toNonEmptyString,
  getServerNow,
  blendServerOffset,
  computeOffsetWithLatency,
  statusForWindow,
  mapRemoteCells,
  keepLatestGridSnapshot,
  sortGridCells,
  extractPriceStepFromCells,
  resolveOrderCellId,
  resolveRemoteCellFromOrderPayload,
  resolveRewardRate,
} from "./storeUtils";

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  wssKeyExpiresAt: number | null;
  followedOrderActivities: FollowedOrderActivity[];
  betAmount: number;
  serverTimeOffset: number;
  serverTimeOffsetReady: boolean;
  priceStepChangedAt: number | null;

  setBetAmount: (amount: number) => void;
  placeBet: (cellId: string, amount: number) => void;
  cancelPendingBet: (cellId: string) => void;
  checkWinEffects: (now: number) => void;
  setConnection: (socket: unknown | null, wssKey?: string | null) => void;
  setWssKey: (wssKey: string | null, expiresAt?: number | null) => void;
  upsertFollowedOrderActivity: (activity: FollowedOrderActivity) => void;
  hydrateHistory: (points: PricePoint[]) => void;
  updatePrice: (price: number, ts?: number, receivedAt?: number) => void;
  updateGrid: (remoteCells: RemoteCell[]) => void;
  updateOrder: (payload: unknown) => void;
  resetGridData: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

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
  wssKeyExpiresAt: null,
  followedOrderActivities: [],
  betAmount: DEFAULT_BET_AMOUNT_WLD,
  serverTimeOffset: 0,
  serverTimeOffsetReady: false,
  priceStepChangedAt: null,

  resetGridData: () =>
    set({ cells: [], history: [], currentPrice: 0, basePrice: 0 }),

  setBetAmount: (amount) => set({ betAmount: amount }),

  setConnection: (socket, wssKey = null) => set({ socket, wssKey }),

  setWssKey: (wssKey, expiresAt = null) => set({ wssKey, wssKeyExpiresAt: expiresAt }),

  /** Adds or replaces a followed-order activity entry, keeping the list bounded. */
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
        followedOrderActivities: nextActivities.slice(0, MAX_FOLLOWED_ORDER_ACTIVITIES),
      };
    }),

  /** Merges a batch of historical price points into the running history, deduplicating by timestamp. */
  hydrateHistory: (points) =>
    set((state) => {
      if (!Array.isArray(points) || points.length === 0) return state;

      const historyByTime = new Map<number, number>();
      for (const point of state.history) {
        if (Number.isFinite(point?.time) && Number.isFinite(point?.price) && point.time > 0) {
          historyByTime.set(point.time, point.price);
        }
      }
      for (const point of points) {
        if (Number.isFinite(point?.time) && Number.isFinite(point?.price) && point.time > 0) {
          historyByTime.set(point.time, point.price);
        }
      }

      if (historyByTime.size === 0) return state;

      const mergedHistory = Array.from(historyByTime.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([time, price]) => ({ time, price }));

      if (mergedHistory.length === 0) return state;

      const latestPoint = mergedHistory[mergedHistory.length - 1];

      return {
        history: mergedHistory,
        currentPrice: latestPoint.price,
        basePrice: state.basePrice > 0 ? state.basePrice : mergedHistory[0].price,
        // Binance candle timestamps are close times, not "now" — don't use them for offset
      };
    }),

  /** Appends a live price tick, guarding against backwards-in-time points. */
  updatePrice: (price, ts, receivedAt) =>
    set((state) => {
      if (!Number.isFinite(price)) return state;
      const normalizedTs = normalizeTs(ts);

      // Never append a point that goes backwards — normalizeTs falls back to
      // Date.now() which can lag behind the last server-timestamped point.
      const lastHistoryTime =
        state.history.length > 0 ? state.history[state.history.length - 1].time : 0;
      const safeTs = Math.max(normalizedTs, lastHistoryTime);

      // Only update offset when the server sent a real timestamp.
      // Use RTT-compensated offset: ts was generated server-side before transit,
      // so we add half the elapsed time since receivedAt to approximate one-way latency.
      if (!ts || !Number.isFinite(normalizedTs)) {
        return {
          currentPrice: price,
          history: [...state.history, { time: safeTs, price }],
          basePrice: state.basePrice > 0 ? state.basePrice : price,
        };
      }

      const correctedOffset = computeOffsetWithLatency(normalizedTs, receivedAt ?? Date.now());
      const nextOffset = blendServerOffset(
        state.serverTimeOffset,
        correctedOffset,
        !state.serverTimeOffsetReady,
      );

      return {
        currentPrice: price,
        history: [...state.history, { time: safeTs, price }],
        basePrice: state.basePrice > 0 ? state.basePrice : price,
        serverTimeOffset: nextOffset,
        serverTimeOffsetReady: true,
      };
    }),

  /**
   * Replaces the visible grid with the latest server snapshot.
   * Cells with local bet/outcome state are retained or merged to avoid losing
   * user-facing feedback across grid refreshes.
   */
  updateGrid: (remoteCells) =>
    set((state) => {
      if (!Array.isArray(remoteCells)) return {};

      const now = getServerNow(state.serverTimeOffset);
      const chartTime = getLatestChartTime(state.history, now);
      const hideThresholdTime = getCellHideThresholdTime(chartTime);
      const latestSnapshotCells = keepLatestGridSnapshot(remoteCells);

      const previousPriceStep = extractPriceStepFromCells(
        state.cells.map((c) => ({ lowerPrice: c.original.lowerPrice, upperPrice: c.original.upperPrice })),
      );
      const nextPriceStep = extractPriceStepFromCells(latestSnapshotCells);
      const hasPriceStepChanged =
        previousPriceStep !== null &&
        nextPriceStep !== null &&
        Math.abs(previousPriceStep - nextPriceStep) > 1e-8;

      // When the grid row height changes, existing bet positions no longer
      // align with new rows — clear all local order state to avoid mis-rendering.
      const priceStepChangedAt = hasPriceStepChanged
        ? (state.priceStepChangedAt ?? Date.now())
        : null;
      const activeBets = hasPriceStepChanged ? {} : state.bets;
      const activePendingBets = hasPriceStepChanged ? {} : state.pendingBets;
      const activePendingWins = hasPriceStepChanged ? {} : state.pendingWins;
      const activeSettledOutcomes = hasPriceStepChanged ? {} : state.settledOutcomes;

      const existingCellById = new Map(state.cells.map((cell) => [cell.id, cell]));

      // Merge incoming cells: freeze multiplier/status for cells with active bets
      // so that server-pushed odds changes don't alter the user's committed view.
      const incomingCells = mapRemoteCells(latestSnapshotCells, now).map((incomingCell) => {
        const existingCell = existingCellById.get(incomingCell.id);
        if (!existingCell) return incomingCell;

        const shouldFreezeMultiplier =
          (activeBets[incomingCell.id] || 0) > 0 ||
          (activePendingBets[incomingCell.id] || 0) > 0 ||
          activePendingWins[incomingCell.id] !== undefined ||
          activeSettledOutcomes[incomingCell.id] !== undefined;

        if (!shouldFreezeMultiplier) return incomingCell;

        return {
          ...incomingCell,
          multiplier: existingCell.multiplier,
          status:
            existingCell.status === "hit" || existingCell.status === "lose"
              ? existingCell.status
              : incomingCell.status,
          original: { ...incomingCell.original, rewardRate: existingCell.original.rewardRate },
        };
      });

      const incomingIds = new Set(incomingCells.map((c) => c.id));

      // When the row height changes, every previous cell geometry becomes stale.
      // Dropping the old snapshot entirely avoids mixing old/new price bands in
      // the same frame, which otherwise renders overlapping cells.
      const retainedCells = hasPriceStepChanged
        ? []
        : state.cells
            .filter((cell) => {
              if (incomingIds.has(cell.id)) return false;

              const hasTrackedState =
                (activeBets[cell.id] || 0) > 0 ||
                (activePendingBets[cell.id] || 0) > 0 ||
                activePendingWins[cell.id] !== undefined ||
                activeSettledOutcomes[cell.id] !== undefined;
              const settledOutcome = activeSettledOutcomes[cell.id];
              const shouldKeepSettledWin =
                settledOutcome?.isWin === true || cell.status === "hit";

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
        bets: activeBets,
        pendingBets: activePendingBets,
        pendingWins: activePendingWins,
        settledOutcomes: activeSettledOutcomes,
        priceStepChangedAt,
      };
    }),

  /** Removes a pending bet for a cell — used when socket confirmation times out. */
  cancelPendingBet: (cellId) =>
    set((state) => {
      if (!(cellId in state.pendingBets)) return state;
      const nextPendingBets = { ...state.pendingBets };
      delete nextPendingBets[cellId];
      return { pendingBets: nextPendingBets };
    }),

  /** Moves a bet from pending to the grid; no-ops if a bet already exists for this cell. */
  placeBet: (cellId, amount) =>
    set((state) => {
      if (amount <= 0 || amount > state.balance) return state;
      if ((state.bets[cellId] || 0) > 0 || (state.pendingBets[cellId] || 0) > 0) {
        return state;
      }
      return {
        pendingBets: { ...state.pendingBets, [cellId]: amount },
      };
    }),

  /**
   * Advances cell display statuses based on the current chart time.
   * Reveals settled outcomes and transitions cells to "hit" or "lose" when appropriate.
   */
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
              delete nextPendingWins[cell.id];
              nextSettledOutcomes[cell.id] = { ...settledOutcome, revealed: true };
              changed = true;
            }
          } else {
            // Delay "lose" paint until the chart visually reaches the cell end
            // to avoid marking other same-row bets red prematurely.
            nextStatus = chartPassedCellEnd ? "lose" : isPast ? "past" : "active";
            if (!settledOutcome.revealed) {
              nextSettledOutcomes[cell.id] = { ...settledOutcome, revealed: true };
              changed = true;
            }
          }
        } else if (chartPassedCellEnd) {
          // Optimistic loss feedback while waiting for the server settlement.
          // A WIN update arriving later will still override this to "hit".
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

  /**
   * Handles a WebSocket order event: confirms pending bets, records settled
   * outcomes (win/lose/payout), and rejects cancelled orders.
   */
  updateOrder: (payload) =>
    set((state) => {
      const cellId = resolveOrderCellId(payload);
      if (!cellId) return state;

      const record =
        payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
      if (!record) return state;

      const status = toNonEmptyString(record.status)?.toUpperCase();
      const amount = toFiniteNumber(record.amount);
      const rewardRate = resolveRewardRate(payload);
      const rewardRateNum = toFiniteNumber(rewardRate);
      const statusIsWin = status === "WIN" || status === "WON";
      const statusIsLose =
        status === "LOSE" || status === "LOST" || status === "FAIL" || status === "FAILED";
      const isSettled = status === "SETTLED" || statusIsWin || statusIsLose;

      const nextPendingBets = { ...state.pendingBets };
      const nextBets = { ...state.bets };
      const nextPendingWins = { ...state.pendingWins };
      const nextSettledOutcomes = { ...state.settledOutcomes };
      const now = getServerNow(state.serverTimeOffset);
      const chartTime = getLatestChartTime(state.history, now);
      const hideThresholdTime = getCellHideThresholdTime(chartTime);
      const existingCell = state.cells.find((cell) => cell.id === cellId) ?? null;
      const reconstructedCell = existingCell
        ? null
        : mapRemoteCells(
            [resolveRemoteCellFromOrderPayload(payload)].filter(
              (cell): cell is RemoteCell => cell !== null,
            ),
            now,
          )[0] ?? null;
      // Don't inject stale historical cells — they belong to a past session and
      // would appear as ghost cells when backfilling orders on app load.
      const isReconstructedCellStale =
        reconstructedCell !== null &&
        reconstructedCell.timeWindowEnd <= hideThresholdTime;
      const cellsWithRecoveredTarget =
        reconstructedCell !== null && !isReconstructedCellStale
          ? [...state.cells, reconstructedCell]
          : state.cells;
      let changed = false;

      if (reconstructedCell !== null && !isReconstructedCellStale) {
        changed = true;
      }

      if (status === "OPEN") {
        const confirmedAmount = amount ?? nextPendingBets[cellId] ?? 0;
        delete nextPendingBets[cellId];
        if (confirmedAmount > 0) nextBets[cellId] = confirmedAmount;
        changed = true;
      }

      if (isSettled) {
        const settledWinRaw = record.settledWin ?? record.outcome;
        const settledWinText = toNonEmptyString(settledWinRaw)?.toUpperCase();
        const hasExplicitOutcome = settledWinRaw !== undefined && settledWinRaw !== null;
        const outcomeIsWin =
          settledWinRaw === true || settledWinText === "TRUE" || settledWinText === "WIN";
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
          const settledBasePayout = toNonNegativeFiniteNumber(record.settledBasePayout);
          const settledBonusPayout = toNonNegativeFiniteNumber(record.settledBonusPayout);
          const settledPayout = toNonNegativeFiniteNumber(record.settledPayout);
          const hasSettledPayoutParts = settledBasePayout !== null || settledBonusPayout !== null;
          const resolvedPayoutFromParts = hasSettledPayoutParts
            ? (settledBasePayout ?? 0) + (settledBonusPayout ?? 0)
            : null;
          const mult =
            rewardRateNum ??
            existingCell?.multiplier ??
            reconstructedCell?.multiplier ??
            0;
          const fallbackPayoutFromStake = baseAmount > 0 ? baseAmount * Math.max(mult, 0) : null;
          const resolvedPayout = resolvedPayoutFromParts ?? settledPayout ?? fallbackPayoutFromStake;
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
          }
        } else {
          delete nextPendingWins[cellId];
        }

        const resolvedStakeAmount = amount ?? nextBets[cellId] ?? nextPendingBets[cellId] ?? 0;
        if (resolvedStakeAmount > 0 && !nextBets[cellId]) nextBets[cellId] = resolvedStakeAmount;
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

      const nextCells = cellsWithRecoveredTarget.map((cell) => {
        if (cell.id !== cellId) return cell;

        const nextCell: CellData = { ...cell };
        const chartPassedCellEnd = now >= cell.timeWindowEnd;

        if (rewardRate) {
          const resolvedMultiplier = rewardRateNum !== null ? rewardRateNum : cell.multiplier;
          nextCell.multiplier = resolvedMultiplier;
          nextCell.original = { ...cell.original, rewardRate };
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
