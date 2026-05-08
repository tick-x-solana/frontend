/**
 * useWinEffectTracking — detects newly hit bet cells and drives the win-effect
 * animation lifecycle (pulse start → show amounts → expire). Suppresses effects
 * during initial hydration and after a price-step clear.
 */

import { useState, useRef, useEffect, useMemo } from "react";
import type { CellData, SettledOutcome } from "@/src/features/trade/store";
import {
  WIN_EFFECT_INIT_GRACE_MS,
  WIN_EFFECT_VISIBLE_MS,
  WIN_EFFECT_AMOUNTS_VISIBLE_MS,
} from "../components/tradingGrid.constants";
import type { ActiveWinEffectState } from "../components/tradingGrid.utils";

type SettledOutcomes = Record<string, SettledOutcome>;

export function useWinEffectTracking({
  cells,
  bets,
  pendingBets,
  pendingWins,
  settledOutcomes,
  canTrackWinEffects,
  priceStepChangedAt,
}: {
  cells: CellData[];
  bets: Record<string, number>;
  pendingBets: Record<string, number>;
  pendingWins: Record<string, number>;
  settledOutcomes: SettledOutcomes;
  canTrackWinEffects: boolean;
  priceStepChangedAt: number | null;
}) {
  const [activeWinEffectByCellId, setActiveWinEffectByCellId] = useState<
    Record<string, ActiveWinEffectState>
  >({});

  const previousWinningCellIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedWinEffectTrackingRef = useRef(false);
  // Lazy-initialized via useState so Date.now() runs once at mount, not on every render.
  const [componentMountedAt] = useState<number>(() => Date.now());
  const effectTimeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set(),
  );

  const clearScheduledEffectTimeouts = () => {
    effectTimeoutIdsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    effectTimeoutIdsRef.current.clear();
  };

  const scheduleEffectTimeout = (callback: () => void, delayMs: number) => {
    const timeoutId = setTimeout(() => {
      effectTimeoutIdsRef.current.delete(timeoutId);
      callback();
    }, delayMs);
    effectTimeoutIdsRef.current.add(timeoutId);
  };

  // Absorb pre-existing wins into the baseline when the price step changes so
  // cells reconstructed after a price-step clear do not fire spurious win animations.
  useEffect(() => {
    if (priceStepChangedAt === null) return;
    previousWinningCellIdsRef.current = new Set(
      cells.filter((c) => c.status === "hit").map((c) => c.id),
    );
    hasInitializedWinEffectTrackingRef.current = false;
  }, [priceStepChangedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track wins — fire once per hit transition, not once forever per id.
  useEffect(() => {
    const nextWinningCellIds = new Set<string>();

    cells.forEach((cell) => {
      if (cell.status !== "hit") return;
      const hasTrackedStake =
        (bets[cell.id] || 0) > 0 ||
        (pendingBets[cell.id] || 0) > 0 ||
        pendingWins[cell.id] !== undefined ||
        settledOutcomes[cell.id] !== undefined;
      if (!hasTrackedStake) return;

      nextWinningCellIds.add(cell.id);
    });

    // Suppress win effects during initial data hydration:
    // absorb all pre-existing wins into the baseline for the first few seconds
    // after component mount, regardless of tracking/auth state.
    const msSinceMount = Date.now() - componentMountedAt;
    if (msSinceMount < WIN_EFFECT_INIT_GRACE_MS) {
      previousWinningCellIdsRef.current = nextWinningCellIds;
      return;
    }

    if (!canTrackWinEffects) {
      previousWinningCellIdsRef.current = nextWinningCellIds;
      hasInitializedWinEffectTrackingRef.current = false;
      return;
    }

    if (!hasInitializedWinEffectTrackingRef.current) {
      previousWinningCellIdsRef.current = nextWinningCellIds;
      hasInitializedWinEffectTrackingRef.current = true;
      return;
    }

    const newlyWinningCellIds = [...nextWinningCellIds].filter(
      (cellId) => !previousWinningCellIdsRef.current.has(cellId),
    );

    if (newlyWinningCellIds.length > 0) {
      const effectStartedAt = Date.now();
      setActiveWinEffectByCellId((currentValue) => {
        const nextValue = { ...currentValue };
        for (const cellId of newlyWinningCellIds) {
          nextValue[cellId] = {
            startedAt: effectStartedAt,
            showTotal: false,
          };
        }
        return nextValue;
      });

      scheduleEffectTimeout(() => {
        setActiveWinEffectByCellId((currentValue) => {
          let changed = false;
          const nextValue = { ...currentValue };

          for (const cellId of newlyWinningCellIds) {
            const currentCellState = nextValue[cellId];
            if (!currentCellState || currentCellState.showTotal) continue;
            nextValue[cellId] = { ...currentCellState, showTotal: true };
            changed = true;
          }

          return changed ? nextValue : currentValue;
        });
      }, WIN_EFFECT_AMOUNTS_VISIBLE_MS);

      scheduleEffectTimeout(() => {
        setActiveWinEffectByCellId((currentValue) => {
          let changed = false;
          const nextValue = { ...currentValue };

          for (const cellId of newlyWinningCellIds) {
            if (nextValue[cellId] === undefined) continue;
            delete nextValue[cellId];
            changed = true;
          }

          return changed ? nextValue : currentValue;
        });
      }, WIN_EFFECT_VISIBLE_MS);
    }

    previousWinningCellIdsRef.current = nextWinningCellIds;
  }, [
    bets,
    canTrackWinEffects,
    cells,
    pendingBets,
    pendingWins,
    settledOutcomes,
    componentMountedAt,
  ]);

  // Cleanup any pending timers on unmount to avoid stale state updates.
  useEffect(() => {
    return () => {
      clearScheduledEffectTimeouts();
    };
  }, []);

  const activeWinEffectCellIdSet = useMemo(
    () => new Set(Object.keys(activeWinEffectByCellId)),
    [activeWinEffectByCellId],
  );

  return {
    activeWinEffectByCellId,
    setActiveWinEffectByCellId,
    activeWinEffectCellIdSet,
    previousWinningCellIdsRef,
    hasInitializedWinEffectTrackingRef,
  };
}
