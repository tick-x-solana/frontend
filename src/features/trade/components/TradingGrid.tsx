"use client";

/**
 * TradingGrid — canvas-based price grid with zoom/pan and click-to-bet.
 *
 * Architecture:
 *   src/utils/gridLayout.ts   — coordinate-transform math (computeLayout, hitTestCell)
 *   src/utils/canvasDraw.ts   — all canvas rendering routines (pure functions)
 *   src/hooks/useGridInteraction.ts — mouse / touch / wheel handlers
 *   TradingGrid.tsx           — React wiring: store selectors, rAF loop, resize observer
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { io } from "socket.io-client";
import type { RemoteCell } from "@/src/features/trade/store";
import { BACKEND_URL } from "@/src/features/trade/constant";
import { useGameStore } from "@/src/features/trade/store";
import { computeLayout, hitTestCell } from "@/src/utils/gridLayout";
import type { Transform, StoreSnapshot } from "@/src/utils/gridLayout";
import { computeGridDimensions } from "@/src/utils/gridDimensions";
import {
  COLOR_BG,
  drawBackgroundGrid,
  drawBetCells,
  drawPriceLine,
  drawPriceAxis,
  drawTimeAxis,
  drawZoomIndicator,
} from "@/src/utils/canvasDraw";
import { useGridInteraction } from "@/src/hooks/useGridInteraction";

// ─── Constants ────────────────────────────────────────────────────────────────

const DESKTOP_ZOOM_MIN = 0.5;
const MOBILE_ZOOM_MIN = 1.3;
const MIN_PRICE_MOTION_MS = 250;
const MAX_PRICE_MOTION_MS = 5000;
const TICK_CADENCE_SMOOTHING = 0.2;

function buildDisplayHistory(
  history: StoreSnapshot["history"],
  now: number,
  displayPrice: number,
): StoreSnapshot["history"] {
  if (history.length === 0 || !Number.isFinite(displayPrice)) return history;

  const lastPoint = history[history.length - 1];
  const displayTime = Math.max(now, lastPoint.time);

  if (
    displayTime === lastPoint.time &&
    Math.abs(displayPrice - lastPoint.price) < 1e-6
  ) {
    return history;
  }

  return [...history, { time: displayTime, price: displayPrice }];
}
// ─── Component ────────────────────────────────────────────────────────────────

export const TradingGrid: React.FC = () => {
  // ── Store selectors ────────────────────────────────────────────────────────
  const cells = useGameStore((s) => s.cells);
  const history = useGameStore((s) => s.history);
  const basePrice = useGameStore((s) => s.basePrice);
  const currentPrice = useGameStore((s) => s.currentPrice);
  const modePriceStep = useGameStore((s) => s.modePriceStep);
  const modeIntervalSeconds = useGameStore((s) => s.modeIntervalSeconds);
  const placeBet = useGameStore((s) => s.placeBet);
  const bets = useGameStore((s) => s.bets);
  const pendingBets = useGameStore((s) => s.pendingBets);
  const pendingWins = useGameStore((s) => s.pendingWins);
  const socket = useGameStore((s) => s.socket);
  const wssKey = useGameStore((s) => s.wssKey);
  const setConnection = useGameStore((s) => s.setConnection);
  const updatePrice = useGameStore((s) => s.updatePrice);
  const updateGrid = useGameStore((s) => s.updateGrid);
  const betAmount = useGameStore((s) => s.betAmount);
  const balance = useGameStore((s) => s.balance);
  const serverTimeOffset = useGameStore((s) => s.serverTimeOffset);

  const isDemoMode = useGameStore((s) => s.isDemoMode);
  const demoAddress = useGameStore((s) => s.demoAddress);
  const address = isDemoMode ? demoAddress : null;

  // ── Refs ───────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Live values kept in refs to avoid re-triggering the rAF loop
  const initialIsMobile =
    typeof window !== "undefined" ? window.innerWidth < 640 : false;
  const initialMinZoom = initialIsMobile ? MOBILE_ZOOM_MIN : DESKTOP_ZOOM_MIN;
  const nowRef = useRef(0);
  const cameraPriceRef = useRef(currentPrice || 0);
  const isMobileRef = useRef(initialIsMobile);
  const sizeRef = useRef({ w: 0, h: 0 });
  const getMinZoom = useCallback(
    () => (isMobileRef.current ? MOBILE_ZOOM_MIN : DESKTOP_ZOOM_MIN),
    [],
  );
  const transformRef = useRef<Transform>({
    offsetX: 0,
    offsetY: 0,
    zoom: initialMinZoom,
  });
  const priceMotionRef = useRef<{
    startPrice: number;
    targetPrice: number;
    startTime: number;
    durationMs: number;
  } | null>(null);
  const tickCadenceMsRef = useRef(1000);
  const lastHistoryPointRef = useRef<{
    time: number;
    price: number;
  } | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const rafRef = useRef<number>(0);
  const triggeredWinsRef = useRef<Set<string>>(new Set());
  const previewCellIdRef = useRef<string | null>(null);

  // Mirror store into a ref so rAF reads the latest data without deps changes
  const storeRef = useRef<StoreSnapshot>({
    cells,
    history,
    bets,
    pendingBets,
    pendingWins,
    basePrice,
    modePriceStep,
    modeIntervalSeconds,
    betAmount,
    balance,
    socket,
    wssKey,
    address,
    dims: null,
  });
  useEffect(() => {
    // Recompute dims only when cells change — avoids Map/sort allocation every frame.
    const prevCells = storeRef.current.cells;
    const nextDims =
      cells !== prevCells
        ? computeGridDimensions(
            cells.map((c) => ({
              ...c.original,
              startTs: c.timeWindowStart,
              endTs: c.timeWindowEnd,
            })),
          )
        : storeRef.current.dims;
    storeRef.current = {
      cells,
      history,
      bets,
      pendingBets,
      pendingWins,
      basePrice,
      modePriceStep,
      modeIntervalSeconds,
      betAmount,
      balance,
      socket,
      wssKey,
      address,
      dims: nextDims,
    };
  });

  const [overlayMode, setOverlayMode] = useState(false);

  // ── Live socket feed ───────────────────────────────────────────────────────
  useEffect(() => {
    const liveSocket = io(BACKEND_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    setConnection(liveSocket, null);

    liveSocket.on("price_now", (payload: unknown) => {
      const data = payload as
        | number
        | {
            price?: number | string;
            ts?: number;
            time?: number;
          };
      const priceRaw = typeof data === "number" ? data : data?.price;
      const price = Number(priceRaw);
      if (!Number.isFinite(price)) return;

      const ts =
        typeof data === "number" ? undefined : (data?.ts ?? data?.time);
      updatePrice(price, ts);
    });

    liveSocket.on("grid_update", (payload: unknown) => {
      let remoteCells: RemoteCell[] | null = null;
      if (Array.isArray(payload)) {
        remoteCells = payload as RemoteCell[];
      } else if (payload && typeof payload === "object") {
        const wrapped = payload as { data?: unknown; grids?: unknown };
        if (Array.isArray(wrapped.data))
          remoteCells = wrapped.data as RemoteCell[];
        if (Array.isArray(wrapped.grids))
          remoteCells = wrapped.grids as RemoteCell[];
      }

      if (remoteCells) {
        updateGrid(remoteCells);
      }
    });

    return () => {
      liveSocket.off("price_now");
      liveSocket.off("grid_update");
      liveSocket.disconnect();
      setConnection(null, null);
    };
  }, [setConnection, updateGrid, updatePrice]);

  // ── Track wins (avoid repeated effects for the same cell id) ──────────────
  useEffect(() => {
    cells.forEach((cell) => {
      if (cell.status !== "hit") return;
      const hasBet =
        (bets[cell.id] || 0) > 0 || (pendingBets[cell.id] || 0) > 0;
      if (hasBet) triggeredWinsRef.current.add(cell.id);
    });
  }, [cells, bets, pendingBets]);

  useEffect(() => {
    if (history.length === 0) return;

    const lastPoint = history[history.length - 1];
    const previousRealPoint =
      history.length > 1 ? history[history.length - 2] : null;
    const previousTrackedPoint = lastHistoryPointRef.current;

    if (
      previousTrackedPoint &&
      previousTrackedPoint.time === lastPoint.time &&
      previousTrackedPoint.price === lastPoint.price
    ) {
      return;
    }

    if (!previousTrackedPoint || cameraPriceRef.current === 0) {
      cameraPriceRef.current = lastPoint.price;
      priceMotionRef.current = null;
      lastHistoryPointRef.current = {
        time: lastPoint.time,
        price: lastPoint.price,
      };
      return;
    }

    const observedInterval = previousRealPoint
      ? lastPoint.time - previousRealPoint.time
      : 0;
    if (observedInterval > 0) {
      tickCadenceMsRef.current =
        tickCadenceMsRef.current +
        (observedInterval - tickCadenceMsRef.current) * TICK_CADENCE_SMOOTHING;
    }
    const durationMs = Math.min(
      MAX_PRICE_MOTION_MS,
      Math.max(MIN_PRICE_MOTION_MS, tickCadenceMsRef.current * 0.92),
    );

    priceMotionRef.current = {
      startPrice: cameraPriceRef.current,
      targetPrice: lastPoint.price,
      startTime:
        nowRef.current > 0 ? nowRef.current : Date.now() + serverTimeOffset,
      durationMs,
    };
    lastHistoryPointRef.current = {
      time: lastPoint.time,
      price: lastPoint.price,
    };
  }, [history, serverTimeOffset]);

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      sizeRef.current = { w, h };
      isMobileRef.current = window.innerWidth < 640;
      const minZoom = getMinZoom();

      if (transformRef.current.zoom < minZoom) {
        transformRef.current = { ...transformRef.current, zoom: minZoom };
      }

      const cv = canvasRef.current;
      if (cv) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        cv.style.width = `${w}px`;
        cv.style.height = `${h}px`;
      }
      drawRef.current();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let debounceTimer: ReturnType<typeof setTimeout>;
    const handleWindowResize = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(resize, 150);
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      clearTimeout(debounceTimer);
    };
  }, [getMinZoom]);

  // ── Hit-test ───────────────────────────────────────────────────────────────
  const hitTest = useCallback((cx: number, cy: number) => {
    const layout = computeLayout(
      transformRef.current,
      sizeRef.current,
      nowRef.current,
      cameraPriceRef.current,
      storeRef.current,
    );
    return hitTestCell(cx, cy, layout, storeRef.current, nowRef.current);
  }, []);

  // ── Draw ───────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const tf = transformRef.current;
    const layout = computeLayout(
      tf,
      sizeRef.current,
      nowRef.current,
      cameraPriceRef.current,
      storeRef.current,
    );
    const store = storeRef.current;
    const isMobile = isMobileRef.current;
    const drawStore = {
      ...store,
      history: buildDisplayHistory(
        store.history,
        nowRef.current,
        cameraPriceRef.current,
      ),
    };
    ctx.save();
    ctx.scale(dpr, dpr);

    // Base fill
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, layout.w, layout.h);

    drawBackgroundGrid(ctx, layout, drawStore);
    drawBetCells(ctx, layout, drawStore, isMobile, previewCellIdRef.current);
    drawPriceLine(ctx, layout, drawStore);
    drawPriceAxis(ctx, layout, drawStore, isMobile);
    drawTimeAxis(ctx, layout, isMobile);
    drawZoomIndicator(ctx, layout, tf.zoom);

    ctx.restore();
  }, []);

  // Keep drawRef in sync so the resize observer always calls the latest draw
  useEffect(() => {
    drawRef.current = draw;
  });

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    nowRef.current = Date.now() + serverTimeOffset;
  }, [serverTimeOffset]);

  useEffect(() => {
    // Throttle checkWinEffects — cell windows are 5 s wide so checking once per second is plenty.
    let lastWinCheck = 0;

    const loop = () => {
      const loopNow = performance.now();
      const wallClockNow = Date.now();
      const state = useGameStore.getState();
      const target = state.currentPrice;

      const nextNow = wallClockNow + state.serverTimeOffset;
      nowRef.current = nextNow;

      // Animate each real tick across most of the gap to the next tick so the
      // line keeps moving instead of snapping and then idling.
      const motion = priceMotionRef.current;
      if (motion && motion.durationMs > 0) {
        const elapsed = nextNow - motion.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / motion.durationMs));
        cameraPriceRef.current =
          motion.startPrice +
          (motion.targetPrice - motion.startPrice) * progress;

        if (progress >= 1) {
          cameraPriceRef.current = motion.targetPrice;
          priceMotionRef.current = null;
        }
      } else if (cameraPriceRef.current === 0 && target !== 0) {
        cameraPriceRef.current = target;
      } else if (Math.abs(target - cameraPriceRef.current) < 1e-6) {
        cameraPriceRef.current = target;
      }

      // Only check win effects once per second — avoids zustand setState at 60fps.
      if (loopNow - lastWinCheck > 1000) {
        const hasOpenBetState =
          Object.keys(state.pendingBets).length > 0 ||
          Object.keys(state.bets).length > 0 ||
          Object.keys(state.pendingWins).length > 0;
        if (hasOpenBetState) {
          state.checkWinEffects(nowRef.current);
        }
        lastWinCheck = loopNow;
      }

      draw();
      rafRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── Interaction ────────────────────────────────────────────────────────────
  const {
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
  } = useGridInteraction({
    canvasRef,
    sizeRef,
    transformRef,
    nowRef,
    storeRef,
    previewCellIdRef,
    hitTest,
    placeBet,
    getMinZoom,
  });

  // Attach wheel and touchmove as non-passive so preventDefault() works
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, [handleWheel, handleTouchMove]);

  // ── Loading state ──────────────────────────────────────────────────────────
  const hasLiveData =
    cells.length > 0 || history.length > 0 || currentPrice > 0;
  const showLoadingState = !hasLiveData;
  const loadingLabel = socket
    ? "Waiting for live market grid..."
    : address
      ? "Reconnecting to market feed..."
      : "Connect wallet to load the market feed";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background-grid relative flex flex-1 flex-col overflow-hidden font-mono">
      <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-center gap-3 sm:inset-x-3">
        <div className="pointer-events-auto flex h-8 items-center gap-1 rounded-[9px] border border-white/80 bg-transparent px-2.5 text-xs font-medium text-white">
          <span className="bg-grid-axis size-2 rounded-full" />
          ETH/USD
          <ChevronDown className="size-3.5 text-white/80" />
        </div>
        <span className="text-grid-axis text-xs font-medium">2,290.07</span>
        <span className="h-6 w-px bg-[#113e66]" />
        <button
          type="button"
          onClick={() => setOverlayMode((prev) => !prev)}
          className="pointer-events-auto flex items-center gap-2 text-xs font-medium text-white/95"
        >
          <span>OVERLAY MODE</span>
          <span
            className={`relative flex h-6 w-10 items-center rounded-full border border-white/80 px-[2px] ${overlayMode ? "justify-end bg-white/10" : "justify-start bg-transparent"}`}
            aria-hidden
          >
            <span
              className={`size-4 rounded-full ${overlayMode ? "bg-grid-accent" : "bg-transparent"}`}
            />
          </span>
        </button>
      </div>

      {/* Canvas wrapper */}
      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden"
        style={{
          background: COLOR_BG,
          cursor: showLoadingState
            ? "wait"
            : isDragging
              ? "grabbing"
              : "crosshair",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={() => {
          endDrag();
          clearPreviewCell();
        }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ display: "block" }}
        />

        {showLoadingState && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="border-grid-line-strong bg-background-grid text-grid-axis rounded-md border px-4 py-3 text-center text-xs shadow-[0_12px_32px_rgba(0,0,0,0.28)] sm:text-sm">
              <div className="font-semibold text-white">{loadingLabel}</div>
              <div className="mt-1 opacity-70">
                Canvas stays mounted while the first price ticks arrive.
              </div>
              {serverTimeOffset !== 0 && (
                <div className="mt-1 text-[11px] opacity-50">
                  Syncing with server time...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
