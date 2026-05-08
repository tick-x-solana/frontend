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
  const buttonTransformCacheRef = useRef(new Map<string, string>());
  const buttonSizeCacheRef = useRef(new Map<string, string>());
  const winEffectTransformCacheRef = useRef(new Map<string, string>());
  const displayCacheRef = useRef(new Map<string, boolean>());

  const setShareOverlayButtonRef = useCallback(
    (cellId: string, node: HTMLButtonElement | null) => {
      if (!node) {
        shareOverlayButtonRefs.current.delete(cellId);
        buttonTransformCacheRef.current.delete(cellId);
        buttonSizeCacheRef.current.delete(cellId);
        displayCacheRef.current.delete(`button:${cellId}`);
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
        winEffectTransformCacheRef.current.delete(cellId);
        displayCacheRef.current.delete(`win:${cellId}`);
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
        const displayCacheKey = `button:${cellId}`;
        if (!nextTarget) {
          if (displayCacheRef.current.get(displayCacheKey) !== false) {
            node.style.display = "none";
            displayCacheRef.current.set(displayCacheKey, false);
          }
          continue;
        }
        if (displayCacheRef.current.get(displayCacheKey) !== true) {
          node.style.display = "";
          displayCacheRef.current.set(displayCacheKey, true);
        }
        const nextTransform = `translate3d(${nextTarget.left}px, ${nextTarget.top}px, 0)`;
        if (buttonTransformCacheRef.current.get(cellId) !== nextTransform) {
          node.style.transform = nextTransform;
          buttonTransformCacheRef.current.set(cellId, nextTransform);
        }
        const nextSize = `${nextTarget.buttonSize}px`;
        if (buttonSizeCacheRef.current.get(cellId) !== nextSize) {
          node.style.width = nextSize;
          node.style.height = nextSize;
          buttonSizeCacheRef.current.set(cellId, nextSize);
        }
      }
      for (const [cellId, node] of winEffectIconRefs.current.entries()) {
        if (!node) continue;
        const nextTarget = targetById.get(cellId);
        const displayCacheKey = `win:${cellId}`;
        if (!nextTarget) {
          if (displayCacheRef.current.get(displayCacheKey) !== false) {
            node.style.display = "none";
            displayCacheRef.current.set(displayCacheKey, false);
          }
          continue;
        }
        if (displayCacheRef.current.get(displayCacheKey) !== true) {
          node.style.display = "";
          displayCacheRef.current.set(displayCacheKey, true);
        }
        const nextTransform = `translate3d(${nextTarget.centerLeft}px, ${nextTarget.centerTop}px, 0) translate(-50%, -50%)`;
        if (winEffectTransformCacheRef.current.get(cellId) !== nextTransform) {
          node.style.transform = nextTransform;
          winEffectTransformCacheRef.current.set(cellId, nextTransform);
        }
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
