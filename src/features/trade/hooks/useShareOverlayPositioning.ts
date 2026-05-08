/**
 * useShareOverlayPositioning — manages DOM ref maps for share-button and win-effect
 * icon elements and provides `syncShareOverlayPositions` to stamp each overlay element
 * onto its canvas-derived target coordinate each animation frame.
 */

import { useRef, useState, useCallback } from "react";
import type { ShareOverlayTarget } from "../components/tradingGrid.utils";

export function useShareOverlayPositioning() {
  const shareOverlayButtonRefs = useRef(
    new Map<string, HTMLButtonElement | null>(),
  );
  const winEffectIconRefs = useRef(new Map<string, HTMLDivElement | null>());

  const [shareOverlayTargets, setShareOverlayTargets] = useState<
    ShareOverlayTarget[]
  >([]);

  const shareTargetsRef = useRef<ShareOverlayTarget[]>([]);
  const shareTargetIdsHashRef = useRef("");

  const setShareOverlayButtonRef = useCallback(
    (cellId: string, node: HTMLButtonElement | null) => {
      if (!node) {
        shareOverlayButtonRefs.current.delete(cellId);
        return;
      }
      shareOverlayButtonRefs.current.set(cellId, node);
    },
    [],
  );

  const setWinEffectIconRef = useCallback(
    (cellId: string, node: HTMLDivElement | null) => {
      if (!node) {
        winEffectIconRefs.current.delete(cellId);
        return;
      }
      winEffectIconRefs.current.set(cellId, node);
    },
    [],
  );

  // Position HTML overlay elements over canvas cells using latest per-frame target coordinates.
  const syncShareOverlayPositions = useCallback(
    (targets: ShareOverlayTarget[]) => {
      const targetById = new Map(
        targets.map((target) => [target.cellId, target]),
      );
      for (const [cellId, node] of shareOverlayButtonRefs.current.entries()) {
        if (!node) continue;
        const nextTarget = targetById.get(cellId);
        if (!nextTarget) {
          node.style.display = "none";
          continue;
        }
        node.style.display = "";
        node.style.transform = `translate3d(${nextTarget.left}px, ${nextTarget.top}px, 0)`;
        node.style.width = `${nextTarget.buttonSize}px`;
        node.style.height = `${nextTarget.buttonSize}px`;
      }
      for (const [cellId, node] of winEffectIconRefs.current.entries()) {
        if (!node) continue;
        const nextTarget = targetById.get(cellId);
        if (!nextTarget) {
          node.style.display = "none";
          continue;
        }
        node.style.display = "";
        node.style.transform = `translate3d(${nextTarget.centerLeft}px, ${nextTarget.centerTop}px, 0) translate(-50%, -50%)`;
      }
    },
    [],
  );

  return {
    shareOverlayButtonRefs,
    winEffectIconRefs,
    shareOverlayTargets,
    setShareOverlayTargets,
    shareTargetsRef,
    shareTargetIdsHashRef,
    setShareOverlayButtonRef,
    setWinEffectIconRef,
    syncShareOverlayPositions,
  };
}
