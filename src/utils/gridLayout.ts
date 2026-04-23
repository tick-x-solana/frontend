/**
 * Grid coordinate system: converts between canvas pixels, logical time, and price.
 *
 * The grid is anchored so that every remote cell maps to exactly one square on screen.
 * Zoom/pan are applied around the viewport centre (pivotX, pivotY) so the visual
 * midpoint of the grid stays fixed when the user scales.
 */

import { computeGridDimensions } from "./gridDimensions";
import type { GridDimensions } from "./gridDimensions";
import type { CellData } from "@/src/features/trade/store";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Transform {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface GridLayout {
  w: number;
  h: number;
  now: number;
  chartHeadTime: number;
  firstTime: number;
  lastTime: number;
  timeSpanMs: number;
  maxPrice: number;
  minPrice: number;
  totalPriceSpan: number;
  priceSpan: number;
  cellSize: number;
  cellW: number;
  cellH: number;
  effectivePriceStep: number;
  basePrice: number;
  gridAnchorTime: number;
  gridAnchorPrice: number;
  modePriceStep: number;
  cam: number;
  toCanvasX: (t: number) => number;
  toCanvasY: (p: number) => number;
  toCellY: (p: number) => number;
  toTime: (cx: number) => number;
  toPrice: (cy: number) => number;
}

export interface StoreSnapshot {
  cells: CellData[];
  history: { time: number; price: number }[];
  bets: Record<string, number>;
  pendingBets: Record<string, number>;
  pendingWins: Record<string, number>;
  basePrice: number;
  modePriceStep: number;
  modeIntervalSeconds: number;
  betAmount: number;
  balance: number;
  socket: unknown;
  wssKey: string | null;
  address: string | null | undefined;
  /** Cached result of computeGridDimensions — updated only when cells change. */
  dims: GridDimensions | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Layout computation ───────────────────────────────────────────────────────

/**
 * Computes all coordinate-transform functions for the current viewport.
 * Called every frame from the rAF loop — keep it allocation-light.
 */
export function computeLayout(
  tf: Transform,
  size: { w: number; h: number },
  now: number,
  cam: number,
  store: StoreSnapshot,
): GridLayout {
  const BASE_DATA_COLS = 11;
  const BASE_DATA_ROWS = 9;
  const MOBILE_BREAKPOINT_PX = 640;
  const DESKTOP_VIEWPORT_PADDING_COLS = 2;
  const MOBILE_VIEWPORT_PADDING_COLS = 2;
  const DESKTOP_LEADING_PADDING_COLS = 1;
  const MOBILE_LEADING_PADDING_COLS = 6;

  const { w, h } = size;
  const { modeIntervalSeconds, modePriceStep, cells: rawCells, basePrice } = store;
  const isMobileViewport = w < MOBILE_BREAKPOINT_PX;
  const viewportPaddingCols = isMobileViewport
    ? MOBILE_VIEWPORT_PADDING_COLS
    : DESKTOP_VIEWPORT_PADDING_COLS;
  const leadingPaddingCols = isMobileViewport
    ? MOBILE_LEADING_PADDING_COLS
    : DESKTOP_LEADING_PADDING_COLS;

  // Use cached dims — recomputed only when cells change (see TradingGrid storeRef sync).
  // Fall back to computing inline if cache is missing (e.g. first frame).
  const dims = store.dims ?? computeGridDimensions(
    rawCells.map((c) => ({ ...c.original, startTs: c.timeWindowStart, endTs: c.timeWindowEnd }))
  );
  // Keep the row budget stable for the same reason as columns: live payload
  // rowCount can fluctuate as the backend recentres the grid, and letting that
  // drive cellSize produces a visible canvas rescale.
  const dataRows = BASE_DATA_ROWS;

  const intervalMs = modeIntervalSeconds * 1000;
  const effectivePriceStep = dims.priceStep > 0 ? dims.priceStep : modePriceStep;

  // chartHeadTime = the smoothed viewport anchor passed in as `now` from TradingGrid's
  // cameraTimeRef — already EMA-smoothed so no extra computation needed here.
  const chartHeadTime = now;

  // Keep the viewport width stable. If visibleCols tracks live server column
  // count, removing the leading column makes cellSize shrink/grow for one
  // frame, which reads as a horizontal "kick" exactly when a column hides.
  const visibleCols = BASE_DATA_COLS + viewportPaddingCols;
  // On mobile, bias the initial frame so the active/focus column lands near
  // the viewport centre instead of opening flush against the left edge.
  const firstTime = chartHeadTime - leadingPaddingCols * intervalMs;
  const lastTime = firstTime + visibleCols * intervalMs;
  // Snap the background grid to the scrolling viewport instead of the first
  // live server column, otherwise rolling off that column shifts the whole
  // grid phase by one interval.
  const gridAnchorTime = Math.floor(firstTime / intervalMs) * intervalMs;
  const gridAnchorPrice =
    rawCells.length > 0 ? rawCells[0].priceLevel : basePrice;

  const timeSpanMs = lastTime - firstTime;
  const totalCols = visibleCols;

  // Square cells: take the smaller of the two fitted dimensions
  const cellSize = Math.min(w / totalCols, (h * 0.92) / dataRows);

  // Price axis: derive min/max from camera + visible rows
  const visibleRows = h / cellSize;
  const priceSpan = visibleRows;
  const halfSpan = (visibleRows / 2) * effectivePriceStep;
  const maxPrice = cam + halfSpan;
  const minPrice = cam - halfSpan;
  const totalPriceSpan = maxPrice - minPrice;

  // Left edge of the first column at zoom = 1
  const originX = w / 2 - (totalCols / 2) * cellSize;

  // Camera maps to vertical centre
  const camY = h / 2;
  const pivotX = w / 2;
  const pivotY = h / 2;

  // Pre-compute linear transform coefficients so the 5 transform functions
  // capture only plain numbers — no allocations per call.
  //
  // toCanvasX(t) = t * xScale + xBias
  const xScale = (cellSize / intervalMs) * tf.zoom;
  const xBias  = pivotX * (1 - tf.zoom) + (originX - firstTime * cellSize / intervalMs) * tf.zoom + tf.offsetX;

  // toCanvasY(p) = p * yScale + yBias
  const yScale = -(cellSize / effectivePriceStep) * tf.zoom;
  const yBias  = pivotY * (1 - tf.zoom) + (camY + cam * cellSize / effectivePriceStep) * tf.zoom + tf.offsetY;

  // Logical → zoomed-canvas transforms (allocation-free: only captured scalars)
  const toCanvasX = (t: number) => t * xScale + xBias;
  const toCanvasY = (p: number) => p * yScale + yBias;
  const toCellY   = toCanvasY;

  // Canvas → logical inverses
  const toTime  = (cx: number) => (cx - xBias) / xScale;
  const toPrice = (cy: number) => (cy - yBias) / yScale;

  return {
    w,
    h,
    now,
    chartHeadTime,
    firstTime,
    lastTime,
    timeSpanMs,
    maxPrice,
    minPrice,
    totalPriceSpan,
    priceSpan,
    cellSize: cellSize * tf.zoom,
    cellW: cellSize * tf.zoom,
    cellH: cellSize * tf.zoom,
    effectivePriceStep,
    basePrice,
    gridAnchorTime,
    gridAnchorPrice,
    modePriceStep,
    cam,
    toCanvasX,
    toCanvasY,
    toCellY,
    toTime,
    toPrice,
  };
}

// ─── Hit-test ─────────────────────────────────────────────────────────────────

/**
 * Returns the cell under canvas-space point (cx, cy), or null if none is bettable.
 * A cell is bettable when it is in the future, not the very-next interval, and has no bet.
 */
export function hitTestCell(
  cx: number,
  cy: number,
  layout: GridLayout,
  store: StoreSnapshot,
  now: number,
): CellData | null {
  const { toTime, toPrice, effectivePriceStep } = layout;
  const t = toTime(cx);
  const p = toPrice(cy);
  const { cells, pendingBets, bets } = store;

  // 5 s closing window — matches the interval hard-coded in TradingGrid
  const CLOSING_WINDOW_MS = 5000;

  for (const cell of cells) {
    if (t < cell.timeWindowStart || t > cell.timeWindowEnd) continue;

    const lo = cell.priceLevel - effectivePriceStep / 2;
    const hi = cell.priceLevel + effectivePriceStep / 2;
    if (p < lo || p > hi) continue;

    const hasAnyBet = (bets[cell.id] || 0) > 0 || (pendingBets[cell.id] || 0) > 0;

    const isFuture = cell.timeWindowStart > now;
    const isNext = isFuture && cell.timeWindowStart - now <= CLOSING_WINDOW_MS;
    const canBet = isFuture && !isNext && !hasAnyBet;
    return canBet ? cell : null;
  }

  return null;
}
