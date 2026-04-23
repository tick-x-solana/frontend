/**
 * All canvas drawing routines for the trading grid.
 *
 * Each function accepts a CanvasRenderingContext2D plus the pre-computed
 * GridLayout and store snapshot — no React or store imports here.
 * Keeping rendering pure makes it easy to profile and unit-test.
 */

import type { GridLayout, StoreSnapshot } from "./gridLayout";
import { clamp } from "./gridLayout";
import {
  getCellHideThresholdTime,
  getLatestChartTime,
} from "@/src/features/trade/gridTiming";

const timeLabelFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const priceLabelFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// ─── Palette ──────────────────────────────────────────────────────────────────

export const COLOR_BG = "#030C1C";
export const COLOR_LINE = "#9BC4BA";
export const COLOR_GRID = "#162E47";
export const COLOR_GRID_STRONG = "rgba(17, 118, 186, 0.92)";
export const COLOR_NOW = "rgba(18,221,255,0.28)";
export const COLOR_TEXT_DIM = "#53759B";
export const COLOR_BLUE = "#12DDFF";
export const COLOR_GREEN = "#A8E8BB";
export const COLOR_RED = "#F6465D";
export const COLOR_DOT = "#B2EBDF";

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Draws a rounded rectangle path (no fill/stroke — caller decides). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatMultiplier(value: number): string {
  const rounded = Number(value.toFixed(2));
  return `${rounded.toString()}x`;
}

function hasChartReachedColumn(chartX: number, columnX: number) {
  return chartX >= columnX - 0.5;
}

// ─── Background grid ──────────────────────────────────────────────────────────

/**
 * Draws the infinite square background grid.
 * Uses the exact same coordinate formula as bet cells so grid borders align perfectly.
 */
export function drawBackgroundGrid(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  store: StoreSnapshot,
) {
  const {
    w,
    h,
    toCanvasX,
    toCellY,
    toTime,
    toPrice,
    cellW,
    cellH,
    effectivePriceStep,
    gridAnchorPrice,
    gridAnchorTime,
  } = layout;
  const intervalMs = store.modeIntervalSeconds * 1000;

  // Determine the visible price / time range in logical units
  const visibleT0 = toTime(0);
  const visibleT1 = toTime(w);
  const priceAtTop = toPrice(0);
  const priceAtBot = toPrice(h);
  const rowAtTop = (priceAtTop - gridAnchorPrice) / effectivePriceStep;
  const rowAtBot = (priceAtBot - gridAnchorPrice) / effectivePriceStep;
  const rowStartIdx = Math.floor(Math.min(rowAtTop, rowAtBot)) - 2;
  const rowEndIdx = Math.ceil(Math.max(rowAtTop, rowAtBot)) + 2;

  const colStartTs =
    gridAnchorTime +
    Math.floor((visibleT0 - gridAnchorTime) / intervalMs) * intervalMs -
    intervalMs;
  const colEndTs =
    gridAnchorTime +
    Math.ceil((visibleT1 - gridAnchorTime) / intervalMs) * intervalMs +
    intervalMs;

  const anchorPrice = gridAnchorPrice;
  const anchorRowIdx = 0;

  ctx.fillStyle = COLOR_BG;
  ctx.strokeStyle = COLOR_GRID;
  ctx.lineWidth = 0.4;

  for (let rowIdx = rowStartIdx; rowIdx <= rowEndIdx; rowIdx++) {
    const priceLevel =
      anchorPrice + (rowIdx - anchorRowIdx) * effectivePriceStep;
    const cellTop = toCellY(priceLevel + effectivePriceStep / 2);
    if (cellTop > h + cellH || cellTop + cellH < 0) continue;

    for (let ts = colStartTs; ts <= colEndTs; ts += intervalMs) {
      const cx = toCanvasX(ts);
      if (cx + cellW < 0 || cx > w) continue;

      ctx.fillRect(cx, cellTop, cellW, cellH);
      // Inset 0.5 px so adjacent cells share the same pixel — one crisp line, no doubling
      ctx.strokeRect(cx + 0.5, cellTop + 0.5, cellW - 1, cellH - 1);
    }
  }
}

// ─── Current-time indicator ───────────────────────────────────────────────────

export function drawNowLine(ctx: CanvasRenderingContext2D, layout: GridLayout) {
  const { h, toCanvasX, chartHeadTime } = layout;
  const nowX = toCanvasX(chartHeadTime);
  ctx.strokeStyle = COLOR_NOW;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nowX, 0);
  ctx.lineTo(nowX, h);
  ctx.stroke();
}

// ─── Bet cells ────────────────────────────────────────────────────────────────

/**
 * Draws all visible bet/prediction cells with their fills, borders, and text labels.
 */
export function drawBetCells(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  store: StoreSnapshot,
  isMobile: boolean,
) {
  const {
    w,
    h,
    now,
    firstTime,
    lastTime,
    toCanvasX,
    toCellY,
    cellSize,
    cellW,
    cellH,
    effectivePriceStep,
  } = layout;
  const { cells, bets, history, pendingBets } = store;
  const chartTime = getLatestChartTime(history, now);
  const hideThresholdTime = getCellHideThresholdTime(chartTime);
  const chartHeadX = toCanvasX(chartTime);
  const selectedColumnStart =
    cells
      .filter((cell) => !hasChartReachedColumn(chartHeadX, toCanvasX(cell.timeWindowStart)))
      .reduce<
        number | null
      >((minTs, cell) => (minTs === null || cell.timeWindowStart < minTs ? cell.timeWindowStart : minTs), null) ??
    null;

  // Closing window: cells whose window starts within this many ms cannot be bet on
  const CLOSING_MS = 5000;
  for (const cell of cells) {
    if (cell.timeWindowEnd < firstTime || cell.timeWindowStart > lastTime)
      continue;

    const isPast = now >= cell.timeWindowEnd;
    const isHit = cell.status === "hit";
    const betAmountVal = bets[cell.id] || 0;
    const pendingBetAmountVal = pendingBets[cell.id] || 0;
    const hasBet = betAmountVal > 0;
    const isPending = pendingBetAmountVal > 0;
    const hasAnyBet = hasBet || isPending;
    const displayBetAmount = hasBet ? betAmountVal : pendingBetAmountVal;

    const cx = toCanvasX(cell.timeWindowStart);
    const cellTop = toCellY(cell.priceLevel + effectivePriceStep / 2);
    const chartReachedColumn = hasChartReachedColumn(chartHeadX, cx);
    const hasTrackedState = hasAnyBet || isHit;

    if (chartReachedColumn && !hasTrackedState) continue;

    const isFuture = cell.timeWindowStart > hideThresholdTime;
    const isNext = isFuture && cell.timeWindowStart - now <= CLOSING_MS;
    const isSelectedColumn =
      selectedColumnStart !== null &&
      cell.timeWindowStart === selectedColumnStart;

    // priceLevel is the CENTRE of the band; top edge = centre + step/2
    const cw = cellW;
    const ch = cellH;

    if (cx + cw < 0 || cx > w || cellTop + ch < 0 || cellTop > h) continue;

    // Clip to canvas edge so cells that extend past any viewport edge shrink correctly
    const rx = Math.max(0, cx);
    const ry = Math.max(0, cellTop);
    const rw = Math.min(cx + cw, w) - rx;
    const rh = Math.min(cellTop + ch, h) - ry;
    if (rw <= 0 || rh <= 0) continue;

    const textX = cx + cw - clamp(cellSize * 0.13, 6, 10);
    const textY = cellTop + ch - clamp(cellSize * 0.12, 6, 10);

    // ── Background fill ──
    if (isHit && hasAnyBet) {
      ctx.fillStyle = "rgba(46,189,133,0.35)";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = COLOR_GREEN;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 0.75, ry + 0.75, rw - 1.5, rh - 1.5);
    } else if (!isPast && hasAnyBet) {
      const grad = ctx.createLinearGradient(rx, ry, rx, ry + rh);
      grad.addColorStop(0, "rgba(22,40,81,0.25)");
      grad.addColorStop(1, "rgba(9,22,53,0.35)");
      ctx.fillStyle = grad;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = COLOR_GRID_STRONG;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 0.75, ry + 0.75, rw - 1.5, rh - 1.5);
    } else if (isNext && !hasAnyBet) {
      ctx.fillStyle = "rgba(246,70,93,0.06)";
      ctx.fillRect(rx, ry, rw, rh);
    } else if (isSelectedColumn && !hasAnyBet) {
      ctx.fillStyle = "rgba(246,70,93,0.06)";
      ctx.fillRect(rx, ry, rw, rh);
    }

    // Subtle outer border (always)
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(rx, ry, rw, rh);

    // Only clip when the cell is partially outside the viewport — saves save/clip/restore
    // overhead (~130 cells/frame) for the common fully-visible case.
    const needsClip = cx < 0 || cx + cw > w || cellTop < 0 || cellTop + ch > h;
    if (needsClip) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
    }

    // ── Text ──
    // Font scales with zoom so labels remain readable at any zoom level
    const fontSize =
      clamp(Math.round(cellSize * 0.2), 7, 12) / (isMobile ? 1.08 : 1);
    ctx.font = `${cell.multiplier >= 100 ? "bold" : cell.multiplier >= 10 ? "600" : "normal"} ${fontSize}px monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";

    const multColor =
      hasAnyBet && !isHit
        ? COLOR_BLUE
        : isHit && hasAnyBet
          ? COLOR_GREEN
          : isNext && !hasAnyBet
            ? COLOR_RED
            : cell.multiplier >= 100
              ? COLOR_RED
              : isSelectedColumn
                ? COLOR_RED
                : cell.multiplier >= 10
                  ? COLOR_BLUE
                  : COLOR_TEXT_DIM;

    ctx.fillStyle = multColor;

    // Glow behind multiplier text for active/won bets
    if (isHit && hasAnyBet) {
      ctx.shadowColor = "rgba(46,189,133,1)";
      ctx.shadowBlur = 8;
    } else if (hasAnyBet) {
      ctx.shadowColor = "rgba(8,71,247,0.8)";
      ctx.shadowBlur = 5;
    } else {
      ctx.shadowBlur = 0;
    }

    const multTxt = `${
      hasAnyBet
        ? formatMultiplier(cell.multiplier)
        : formatMultiplier(Number(cell.original.rewardRate))
    }`;

    if (hasAnyBet && !isHit) {
      _drawBetBadge(ctx, {
        textX,
        textCenterY: textY,
        cellSize,
        multTxt,
        multColor,
        fontSize,
        displayBetAmount,
      });
    } else if (isHit && hasAnyBet) {
      _drawWinBadge(ctx, {
        textX,
        textCenterY: textY,
        cellSize,
        displayBetAmount,
        multiplier: cell.multiplier,
      });
    } else {
      // Plain multiplier
      ctx.font = `${fontSize}px monospace`;
      ctx.fillStyle = multColor;
      ctx.fillText(multTxt, textX, textY);

      if (!isPast) {
        const dotR = Math.max(0.85, Math.min(1.45, cellSize * 0.02));
        ctx.fillStyle = COLOR_DOT;
        const corners = [
          [cx, cellTop],
          [cx + cw, cellTop],
          [cx, cellTop + ch],
          [cx + cw, cellTop + ch],
        ];
        for (const [dx, dy] of corners) {
          if (dx < -2 || dx > w + 2 || dy < -2 || dy > h + 2) continue;
          ctx.beginPath();
          ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.shadowBlur = 0;
    if (needsClip) ctx.restore();
  }
}

// ── Badge helpers (private) ───────────────────────────────────────────────────

interface BetBadgeParams {
  textX: number;
  textCenterY: number;
  cellSize: number;
  multTxt: string;
  multColor: string;
  fontSize: number;
  displayBetAmount: number;
}

function _drawBetBadge(ctx: CanvasRenderingContext2D, p: BetBadgeParams) {
  const {
    textX,
    textCenterY,
    cellSize,
    multTxt,
    multColor,
    fontSize,
    displayBetAmount,
  } = p;
  const badgeFontSize = clamp(Math.round(cellSize * 0.25), 6, 20);
  const gapY = clamp(cellSize * 0.11, 2, 10);

  // Multiplier above centre
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = multColor;
  ctx.fillText(multTxt, textX, textCenterY - gapY);

  // Amount badge below
  ctx.shadowBlur = 0;
  const badgeText = `$${displayBetAmount}`;
  ctx.font = `bold ${badgeFontSize}px monospace`;
  const bw = ctx.measureText(badgeText).width + clamp(cellSize * 0.22, 4, 18);
  const bh = clamp(cellSize * 0.39, 8, 28);
  const bx = textX - bw / 2;
  const by = textCenterY + gapY - bh / 2;
  ctx.fillStyle = COLOR_GRID_STRONG;
  roundRect(ctx, bx, by, bw, bh, 4);
  ctx.fill();
  ctx.fillStyle = "#eaf8ff";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, textX, by + bh / 2);
}

interface WinBadgeParams {
  textX: number;
  textCenterY: number;
  cellSize: number;
  displayBetAmount: number;
  multiplier: number;
}

function _drawWinBadge(ctx: CanvasRenderingContext2D, p: WinBadgeParams) {
  const { textX, textCenterY, cellSize, displayBetAmount, multiplier } = p;
  const winPayout =
    displayBetAmount * (multiplier && !isNaN(multiplier) ? multiplier : 0);
  const badgeFontSize = clamp(Math.round(cellSize * 0.25), 6, 20);
  const gapY = clamp(cellSize * 0.11, 2, 10);

  // "WIN!" label
  const winFontSize = clamp(Math.round(cellSize * 0.22), 5, 18);
  ctx.font = `900 ${winFontSize}px monospace`;
  ctx.fillStyle = COLOR_GRID_STRONG;
  ctx.shadowColor = "rgba(46,189,133,1)";
  ctx.shadowBlur = 8;
  ctx.fillText("WIN!", textX, textCenterY - gapY * 2);

  // Payout badge
  ctx.shadowBlur = 0;
  const payoutText = `+$${winPayout > 0 ? winPayout.toFixed(2) : displayBetAmount}`;
  ctx.font = `bold ${badgeFontSize}px monospace`;
  const bw = ctx.measureText(payoutText).width + clamp(cellSize * 0.22, 4, 18);
  const bh = clamp(cellSize * 0.39, 8, 28);
  const bx = textX - bw / 2;
  const by = textCenterY + gapY / 2 - bh / 2;
  ctx.fillStyle = COLOR_GREEN;
  roundRect(ctx, bx, by, bw, bh, 4);
  ctx.fill();
  ctx.fillStyle = "#eaf8ff";
  ctx.textBaseline = "middle";
  ctx.fillText(payoutText, textX, by + bh / 2);
}

// ─── Price chart line ─────────────────────────────────────────────────────────

export function drawPriceLine(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  store: StoreSnapshot,
) {
  const { w, h, firstTime, lastTime, toCanvasX, toCanvasY } = layout;
  const { history } = store;
  if (history.length < 2) return;

  const clipPaddingMs = 30_000;
  const visibleHistory = history.filter(
    (pt) => pt.time >= firstTime - clipPaddingMs && pt.time <= lastTime + clipPaddingMs,
  );
  if (visibleHistory.length < 2) return;

  const points: Array<{ x: number; y: number }> = [];
  const minPxStep = 0.8;
  for (const pt of visibleHistory) {
    const x = toCanvasX(pt.time);
    const y = toCanvasY(pt.price);
    const prev = points[points.length - 1];

    if (!prev) {
      points.push({ x, y });
      continue;
    }
    if (x - prev.x >= minPxStep) {
      points.push({ x, y });
      continue;
    }
    points[points.length - 1] = { x, y };
  }
  if (points.length < 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  ctx.strokeStyle = COLOR_LINE;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const cur = points[i];
    const next = points[i + 1];
    const midX = (cur.x + next.x) / 2;
    const midY = (cur.y + next.y) / 2;
    ctx.quadraticCurveTo(cur.x, cur.y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  // End-point dot
  const latestPoint = visibleHistory[visibleHistory.length - 1];
  ctx.beginPath();
  ctx.arc(
    toCanvasX(latestPoint.time),
    toCanvasY(latestPoint.price),
    3.5,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = COLOR_BLUE;
  ctx.fill();

  // Fade-left gradient to hide chart entering from the left edge
  const fadeW = w * 0.12;
  const fadeGrad = ctx.createLinearGradient(0, 0, fadeW, 0);
  fadeGrad.addColorStop(0, COLOR_BG);
  fadeGrad.addColorStop(1, "rgba(3,12,28,0)");
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(0, 0, fadeW, h);

  ctx.restore();
}

// ─── Price Y-axis labels ──────────────────────────────────────────────────────

export function drawPriceAxis(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  _store: StoreSnapshot,
  isMobile: boolean,
) {
  const { w, h, toCellY, effectivePriceStep, basePrice } = layout;
  const anchorPrice = basePrice;
  const anchorRowIdx = 0;

  // Compute visible row range
  const priceAtTop = layout.toPrice(0);
  const priceAtBot = layout.toPrice(h);
  const rowAtTop = (priceAtTop - basePrice) / effectivePriceStep;
  const rowAtBot = (priceAtBot - basePrice) / effectivePriceStep;
  const rowStartIdx = Math.floor(Math.min(rowAtTop, rowAtBot)) - 2;
  const rowEndIdx = Math.ceil(Math.max(rowAtTop, rowAtBot)) + 2;

  const fontSize = isMobile ? 8 : 9;
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const sampleLabel = priceLabelFormatter.format(
    anchorPrice + rowEndIdx * effectivePriceStep,
  );
  const maxLabelW = ctx.measureText(sampleLabel).width + 10;
  const axisX = w - maxLabelW;

  // Background strip
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(axisX, 0, maxLabelW, h);

  // Separator line
  ctx.strokeStyle = COLOR_GRID_STRONG;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(axisX, 0);
  ctx.lineTo(axisX, h);
  ctx.stroke();

  ctx.fillStyle = COLOR_TEXT_DIM;
  for (let i = rowStartIdx; i <= rowEndIdx; i++) {
    const p = anchorPrice + (i - anchorRowIdx) * effectivePriceStep;
    const cy = toCellY(p);
    if (cy < -10 || cy > h + 10) continue;
    ctx.fillText(priceLabelFormatter.format(p), w - 2, cy);
  }

  const focusPrice = layout.cam;
  const focusY = layout.toCanvasY(focusPrice);
  if (focusY > 8 && focusY < h - 8) {
    const focusText = priceLabelFormatter.format(focusPrice);
    const textWidth = ctx.measureText(focusText).width + 10;
    const boxX = w - textWidth - 2;
    const boxY = focusY - 8;
    ctx.fillStyle = "#dce7f5";
    ctx.fillRect(boxX, boxY, textWidth, 16);
    ctx.fillStyle = "#4a6a8a";
    ctx.fillText(focusText, w - 4, focusY);
  }
}

// ─── Time X-axis labels ───────────────────────────────────────────────────────

export function drawTimeAxis(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  isMobile: boolean,
) {
  const { w, h, firstTime, lastTime, toCanvasX } = layout;
  const labelInterval = 15_000; // one label every 15 s

  // Collect timestamps that fall inside the visible time range
  const timeLabels: number[] = [];
  let tLabel = Math.floor(firstTime / labelInterval) * labelInterval;
  while (tLabel <= lastTime + labelInterval) {
    if (tLabel >= firstTime && tLabel <= lastTime) timeLabels.push(tLabel);
    tLabel += labelInterval;
  }

  ctx.font = `bold ${isMobile ? 7 : 11}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#5f85ab";

  for (const t of timeLabels) {
    const cx = toCanvasX(t);
    if (cx < 0 || cx > w) continue;

    const label = timeLabelFormatter.format(new Date(t));

    ctx.fillStyle = "#79afd5";
    ctx.fillText(label, cx, h - 4);
  }
}

// ─── Zoom indicator ───────────────────────────────────────────────────────────

export function drawZoomIndicator(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  zoom: number,
) {
  if (zoom === 1) return;
  const { w } = layout;
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(18,221,255,0.75)";
  ctx.fillText(`${zoom.toFixed(2)}x`, w - 6, 6);
}
