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

  // Win-effect lifecycle: advance showTotal flag and expire finished effects.
  useEffect(() => {
    if (Object.keys(activeWinEffectByCellId).length === 0) return;

    const intervalId = setInterval(() => {
      const tickNow = Date.now();
      setActiveWinEffectByCellId((currentValue) => {
        let changed = false;
        const nextValue: Record<string, ActiveWinEffectState> = {};

        for (const [cellId, cellState] of Object.entries(currentValue)) {
          const elapsed = tickNow - cellState.startedAt;
          if (elapsed >= WIN_EFFECT_VISIBLE_MS) {
            changed = true;
            continue;
          }

          const shouldShowTotal = elapsed >= WIN_EFFECT_AMOUNTS_VISIBLE_MS;
          const nextCellState =
            shouldShowTotal && !cellState.showTotal
              ? { ...cellState, showTotal: true }
              : cellState;
          if (nextCellState !== cellState) {
            changed = true;
          }
          nextValue[cellId] = nextCellState;
        }

        return changed ? nextValue : currentValue;
      });
    }, 100);

    return () => clearInterval(intervalId);
  }, [activeWinEffectByCellId]);

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
