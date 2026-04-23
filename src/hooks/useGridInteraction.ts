/**
 * Mouse / touch / wheel interaction handlers for the trading grid canvas.
 *
 * Extracted from TradingGrid so the component only wires events; all
 * interaction logic (pan, pinch-zoom, wheel-zoom, click-to-bet) lives here.
 */

import { useCallback, useRef, useState } from "react";
import { appToast } from "@/src/features/trade/toast";
import type { CellData } from "@/src/features/trade/store";
import { clamp } from "@/src/utils/gridLayout";
import type { StoreSnapshot, Transform } from "@/src/utils/gridLayout";

// ─── Constants ────────────────────────────────────────────────────────────────

const ZOOM_MAX = 4;
const ZOOM_SPEED = 0.001;
/** Drag threshold in px below which a mouseup is treated as a click, not a pan */
const DRAG_CLICK_THRESHOLD = 4;

// ─── Types ────────────────────────────────────────────────────────────────────

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  lastOffX: number;
  lastOffY: number;
}

interface UseGridInteractionOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  sizeRef: React.RefObject<{ w: number; h: number }>;
  transformRef: React.RefObject<Transform>;
  nowRef: React.RefObject<number>;
  storeRef: React.RefObject<StoreSnapshot>;
  previewCellIdRef: React.RefObject<string | null>;
  hitTest: (cx: number, cy: number) => CellData | null;
  placeBet: (cellId: string, amount: number) => void;
  getMinZoom: () => number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGridInteraction({
  canvasRef,
  sizeRef,
  transformRef,
  nowRef,
  storeRef,
  previewCellIdRef,
  hitTest,
  placeBet,
  getMinZoom,
}: UseGridInteractionOptions) {
  const dragRef = useRef<DragState>({
    active: false,
    startX: 0,
    startY: 0,
    lastOffX: 0,
    lastOffY: 0,
  });
  const [isDragging, setIsDragging] = useState(false);

  // Two-finger pinch state
  const lastTouchDistRef = useRef<number | null>(null);
  const lastTouchMidRef = useRef<{ x: number; y: number } | null>(null);

  const updatePreviewCell = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const cell = hitTest(clientX - rect.left, clientY - rect.top);
      previewCellIdRef.current = cell?.id ?? null;
    },
    [canvasRef, hitTest, previewCellIdRef],
  );

  const clearPreviewCell = useCallback(() => {
    previewCellIdRef.current = null;
  }, [previewCellIdRef]);

  // ── Zoom helpers ────────────────────────────────────────────────────────────

  /** Applies a zoom delta around canvas-space point (mx, my). */
  const applyZoom = useCallback(
    (mx: number, my: number, scaleFactor: number) => {
      const tf = transformRef.current;
      const { w, h } = sizeRef.current;
      const pivotX = w / 2;
      const pivotY = h / 2;

      const nextZoom = clamp(tf.zoom * scaleFactor, getMinZoom(), ZOOM_MAX);
      const ratio = nextZoom / tf.zoom;
      const next: Transform = {
        zoom: nextZoom,
        offsetX: mx - pivotX - (mx - pivotX - tf.offsetX) * ratio,
        offsetY: my - pivotY - (my - pivotY - tf.offsetY) * ratio,
      };
      transformRef.current = next;
    },
    [getMinZoom, sizeRef, transformRef],
  );

  // ── Wheel (desktop zoom) ─────────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current!.getBoundingClientRect();
      const scaleFactor = Math.exp(-e.deltaY * ZOOM_SPEED * 3);
      applyZoom(e.clientX - rect.left, e.clientY - rect.top, scaleFactor);
    },
    [canvasRef, applyZoom],
  );

  // ── Pan (mouse drag) ─────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      updatePreviewCell(e.clientX, e.clientY);
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        lastOffX: transformRef.current.offsetX,
        lastOffY: transformRef.current.offsetY,
      };
      setIsDragging(true);
    },
    [transformRef, updatePreviewCell],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const d = dragRef.current;
      if (!d.active) {
        updatePreviewCell(e.clientX, e.clientY);
        return;
      }
      const next: Transform = {
        ...transformRef.current,
        offsetX: d.lastOffX + (e.clientX - d.startX),
        offsetY: d.lastOffY + (e.clientY - d.startY),
      };
      transformRef.current = next;
    },
    [transformRef, updatePreviewCell],
  );

  const endDrag = useCallback(() => {
    dragRef.current.active = false;
    setIsDragging(false);
  }, []);

  // ── Touch (pan + pinch-zoom) ─────────────────────────────────────────────────

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        updatePreviewCell(e.touches[0].clientX, e.touches[0].clientY);
        dragRef.current = {
          active: true,
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          lastOffX: transformRef.current.offsetX,
          lastOffY: transformRef.current.offsetY,
        };
        setIsDragging(true);
        lastTouchDistRef.current = null;
      } else if (e.touches.length === 2) {
        clearPreviewCell();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        lastTouchDistRef.current = Math.hypot(dx, dy);
        lastTouchMidRef.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    },
    [clearPreviewCell, transformRef, updatePreviewCell],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && dragRef.current.active) {
        clearPreviewCell();
        const next: Transform = {
          ...transformRef.current,
          offsetX:
            dragRef.current.lastOffX +
            (e.touches[0].clientX - dragRef.current.startX),
          offsetY:
            dragRef.current.lastOffY +
            (e.touches[0].clientY - dragRef.current.startY),
        };
        transformRef.current = next;
      } else if (
        e.touches.length === 2 &&
        lastTouchDistRef.current !== null &&
        lastTouchMidRef.current !== null
      ) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        const mid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        const rect = canvasRef.current!.getBoundingClientRect();
        applyZoom(
          mid.x - rect.left,
          mid.y - rect.top,
          dist / lastTouchDistRef.current,
        );
        lastTouchDistRef.current = dist;
        lastTouchMidRef.current = mid;
      }
    },
    [canvasRef, clearPreviewCell, transformRef, applyZoom],
  );

  const handleTouchEnd = useCallback(() => {
    dragRef.current.active = false;
    setIsDragging(false);
    lastTouchDistRef.current = null;
  }, []);

  // ── Click → place bet ────────────────────────────────────────────────────────

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Ignore if the pointer moved more than threshold (it was a drag)
      const d = dragRef.current;
      if (
        Math.hypot(e.clientX - d.startX, e.clientY - d.startY) >
        DRAG_CLICK_THRESHOLD
      )
        return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const cell = hitTest(cx, cy);
      if (!cell) return;

      const { bets, pendingBets, betAmount, balance, socket, wssKey, address } =
        storeRef.current;
      const now = nowRef.current;

      try {
        // Warn if cell is in its closing window
        if (cell.timeWindowStart > now && cell.timeWindowStart - now <= 5000) {
          const hasBet = bets[cell.id] || pendingBets[cell.id];
          if (!hasBet) {
            appToast.warning("Cell closing soon. Select another!", {
              icon: "⏳",
            });
            return;
          }
        }

        if (!betAmount || betAmount <= 0) {
          appToast.warning("Invalid bet amount!", { icon: "⚠️" });
          return;
        }
        if (betAmount > balance) {
          appToast.error("Insufficient balance!", { icon: "💸" });
          return;
        }

        // Emit best-effort event when socket is available.
        if (
          socket &&
          typeof socket === "object" &&
          "emit" in socket &&
          typeof socket.emit === "function"
        ) {
          const payload = {
            userId: address || "demo-user",
            marketId: "BTCUSDT",
            amount: betAmount.toString(),
            cell: cell.original,
            ...(wssKey ? { userSignature: wssKey } : {}),
          };
          socket.emit("place_bet", payload);
        }

        placeBet(cell.id, betAmount);
        clearPreviewCell();
      } catch (err) {
        console.log("handleClick() error:", err);
      }
    },
    [canvasRef, nowRef, storeRef, hitTest, placeBet, clearPreviewCell],
  );

  // ── Reset zoom ───────────────────────────────────────────────────────────────

  const resetTransform = useCallback(() => {
    transformRef.current = { offsetX: 0, offsetY: 0, zoom: getMinZoom() };
  }, [getMinZoom, transformRef]);

  return {
    dragRef,
    isDragging,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    endDrag,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleClick,
    clearPreviewCell,
    resetTransform,
  };
}
