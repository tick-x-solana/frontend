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
import { getUserInitials } from "@/src/features/trade/orderFollow";

const timeLabelFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
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
export const COLOR_BORDER_MAIN = "#1E3550";
export const COLOR_BLUE = "#12DDFF";
export const COLOR_BLUE_SOFT = "#2AC5D9";
export const COLOR_GREEN = "#A8E8BB";
export const COLOR_RED = "#F6465D";
export const COLOR_DOT = "#B2EBDF";
export const COLOR_WARNING = "#FD7F26";
export const COLOR_WARNING_TEXT = "rgba(253,127,38,0.7)";
export const COLOR_WARNING_SURFACE = "rgba(253,127,38,0.10)";
export const COLOR_BORDER_SUBTLE = "rgba(228,228,228,0.40)";

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

function getPriceAxisMetrics(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  isMobile: boolean,
) {
  const { w, h, effectivePriceStep, basePrice } = layout;
  const priceAtTop = layout.toPrice(0);
  const priceAtBot = layout.toPrice(h);
  const rowAtTop = (priceAtTop - basePrice) / effectivePriceStep;
  const rowAtBot = (priceAtBot - basePrice) / effectivePriceStep;
  const rowEndIdx = Math.ceil(Math.max(rowAtTop, rowAtBot)) + 2;
  const fontSize = isMobile ? 8 : 9;

  ctx.font = `bold ${fontSize}px monospace`;

  const sampleLabel = priceLabelFormatter.format(
    basePrice + rowEndIdx * effectivePriceStep,
  );
  const axisWidth = ctx.measureText(sampleLabel).width + 10;

  return {
    axisWidth,
    axisX: w - axisWidth,
  };
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
  previewCellId: string | null = null,
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
  const followedActivitiesByCellId = store.followedOrderActivities.reduce<
    Record<string, (typeof store.followedOrderActivities)[number]>
  >(
    (acc, activity) => {
      if (!activity.cellId) return acc;

      const current = acc[activity.cellId];
      if (!current || activity.observedAt >= current.observedAt) {
        acc[activity.cellId] = activity;
      }
      return acc;
    },
    {},
  );
  const chartTime = getLatestChartTime(history, now);
  const hideThresholdTime = getCellHideThresholdTime(chartTime);
  const chartHeadX = toCanvasX(chartTime);
  const selectedColumnStart =
    cells
      .filter(
        (cell) =>
          !hasChartReachedColumn(chartHeadX, toCanvasX(cell.timeWindowStart)),
      )
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
    const isPreviewed =
      previewCellId === cell.id && !isPast && !isNext && !hasAnyBet;
    const followedActivity = followedActivitiesByCellId[cell.id] ?? null;
    const hasFollowedActivity = followedActivity !== null;

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
    if (isPreviewed) {
      _drawPreviewCell(ctx, {
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        cellTop,
        cellBottom: cellTop + ch,
        cellLeft: cx,
        cellRight: cx + cw,
        cellSize,
        multiplier: Number(cell.original.rewardRate),
        betAmount: store.betAmount,
        isMobile,
      });
    } else if (!isPast && !hasAnyBet && hasFollowedActivity) {
      _drawCopyTradeCell(ctx, {
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        cellTop,
        cellBottom: cellTop + ch,
        cellLeft: cx,
        cellRight: cx + cw,
        cellSize,
        multiplier: followedActivity.multiplier,
        initials: getUserInitials(followedActivity.targetUserId),
      });
    } else if (isHit && hasAnyBet) {
      _drawWinCell(ctx, {
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        cellTop,
        cellBottom: cellTop + ch,
        cellLeft: cx,
        cellRight: cx + cw,
        cellSize,
        multiplier: cell.multiplier,
        detailTxt: formatMultiplier(Number(cell.original.rewardRate)),
        isMobile,
      });
    } else if (!isPast && hasAnyBet) {
      _drawBetBadge(ctx, {
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        cellTop,
        cellBottom: cellTop + ch,
        cellLeft: cx,
        cellRight: cx + cw,
        cellSize,
        multTxt: formatMultiplier(cell.multiplier),
        displayBetAmount,
      });
    } else if (isNext && !hasAnyBet) {
      ctx.fillStyle = "rgba(246,70,93,0.06)";
      ctx.fillRect(rx, ry, rw, rh);
    } else if (isSelectedColumn && !hasAnyBet) {
      ctx.fillStyle = "rgba(246,70,93,0.06)";
      ctx.fillRect(rx, ry, rw, rh);
    }

    // Subtle outer border (always)
    if (!isPreviewed && !(hasAnyBet && !isHit) && !hasFollowedActivity) {
      ctx.strokeStyle = COLOR_GRID;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(rx, ry, rw, rh);
    }

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

    if (isPreviewed) {
      if (needsClip) ctx.restore();
      continue;
    } else if (hasFollowedActivity && !hasAnyBet) {
      if (needsClip) ctx.restore();
      continue;
    } else if (hasAnyBet && !isHit) {
      if (needsClip) ctx.restore();
      continue;
    } else if (isHit && hasAnyBet) {
      if (needsClip) ctx.restore();
      continue;
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
  x: number;
  y: number;
  width: number;
  height: number;
  cellTop: number;
  cellBottom: number;
  cellLeft: number;
  cellRight: number;
  cellSize: number;
  multTxt: string;
  displayBetAmount: number;
}

interface PreviewCellParams {
  x: number;
  y: number;
  width: number;
  height: number;
  cellTop: number;
  cellBottom: number;
  cellLeft: number;
  cellRight: number;
  cellSize: number;
  multiplier: number;
  betAmount: number;
  isMobile: boolean;
}

interface CopyTradeCellParams {
  x: number;
  y: number;
  width: number;
  height: number;
  cellTop: number;
  cellBottom: number;
  cellLeft: number;
  cellRight: number;
  cellSize: number;
  multiplier: number | null;
  initials: string;
}

function _drawPreviewCell(ctx: CanvasRenderingContext2D, p: PreviewCellParams) {
  const {
    x,
    y,
    width,
    height,
    cellTop,
    cellBottom,
    cellLeft,
    cellRight,
    cellSize,
    multiplier,
    betAmount,
    isMobile,
  } = p;
  const radius = clamp(cellSize * 0.16, 6, 8);
  const innerInset = 0.75;
  const titleSize = clamp(Math.round(cellSize * 0.25), 10, 12);
  const detailSize = clamp(Math.round(cellSize * 0.17), 7, 8);
  const cornerDotRadius = clamp(cellSize * 0.032, 1.4, 1.9);
  const titleY = y + height * 0.44;
  const detailY = y + height * 0.68;
  const safeMultiplier =
    typeof multiplier === "number" && Number.isFinite(multiplier)
      ? multiplier
      : 0;
  const previewPayout = Math.max(0, betAmount * safeMultiplier);
  const previewDetail =
    previewPayout > 0
      ? new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(previewPayout)
      : formatMultiplier(safeMultiplier);

  ctx.save();
  ctx.shadowColor = "rgba(0,229,255,0.15)";
  ctx.shadowBlur = clamp(cellSize * 0.18, 7, 10);
  ctx.fillStyle = "rgba(0,229,255,0.10)";
  roundRect(
    ctx,
    x + innerInset,
    y + innerInset,
    width - innerInset * 2,
    height - innerInset * 2,
    radius,
  );
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#2AC5D9";
  ctx.lineWidth = 0.5;
  roundRect(
    ctx,
    x + innerInset,
    y + innerInset,
    width - innerInset * 2,
    height - innerInset * 2,
    radius,
  );
  ctx.stroke();

  ctx.strokeStyle = "rgba(0,229,255,0.30)";
  ctx.lineWidth = 0.7;
  roundRect(
    ctx,
    x + innerInset * 2,
    y + innerInset * 2,
    width - innerInset * 4,
    height - innerInset * 4,
    Math.max(0, radius - 1),
  );
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#00E5FF";
  ctx.font = `700 ${titleSize}px sans-serif`;
  ctx.fillText(formatMultiplier(safeMultiplier), x + width / 2, titleY);

  ctx.fillStyle = "#7A9BB5";
  ctx.font = `${isMobile ? 500 : 600} ${detailSize}px sans-serif`;
  ctx.fillText(previewDetail, x + width / 2, detailY);

  ctx.fillStyle = "#00E5FF";
  const corners = [
    [cellLeft, cellTop],
    [cellRight, cellTop],
    [cellLeft, cellBottom],
    [cellRight, cellBottom],
  ];
  for (const [dx, dy] of corners) {
    ctx.beginPath();
    ctx.arc(dx, dy, cornerDotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function _drawCopyTradeCell(
  ctx: CanvasRenderingContext2D,
  p: CopyTradeCellParams,
) {
  const {
    x,
    y,
    width,
    height,
    cellTop,
    cellBottom,
    cellLeft,
    cellRight,
    cellSize,
    multiplier,
    initials,
  } = p;
  const safeMultiplier =
    typeof multiplier === "number" && Number.isFinite(multiplier)
      ? multiplier
      : 0;
  const badgeSize = clamp(cellSize * 0.24, 15, 18);
  const badgeRadius = badgeSize / 2;
  const avatarFontSize = clamp(cellSize * 0.11, 6.5, 7.5);
  const multiplierFontSize = clamp(cellSize * 0.18, 10, 12);
  const cardRadius = 0;
  const inset = 0.25;
  const dotRadius = clamp(cellSize * 0.03, 1.6, 2.1);
  const multiplierLabel = formatMultiplier(safeMultiplier);
  const avatarCenterX = x + width / 2;
  const avatarCenterY = y + clamp(height * 0.28, 11, 14);
  const multiplierY = y + height - clamp(cellSize * 0.16, 8, 10);

  ctx.save();

  roundRect(
    ctx,
    x + inset,
    y + inset,
    width - inset * 2,
    height - inset * 2,
    cardRadius,
  );
  ctx.fillStyle = COLOR_WARNING_SURFACE;
  ctx.fill();

  ctx.lineWidth = 0.5;
  ctx.strokeStyle = COLOR_BORDER_SUBTLE;
  roundRect(
    ctx,
    x + inset,
    y + inset,
    width - inset * 2,
    height - inset * 2,
    cardRadius,
  );
  ctx.stroke();

  ctx.fillStyle = COLOR_WARNING;
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, badgeRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#F8F8F8";
  ctx.font = `500 ${avatarFontSize}px sans-serif`;
  ctx.fillText(initials, avatarCenterX, avatarCenterY + 0.2);

  ctx.fillStyle = COLOR_WARNING_TEXT;
  ctx.font = `${multiplierFontSize}px sans-serif`;
  ctx.fillText(multiplierLabel, x + width / 2, multiplierY);

  ctx.fillStyle = COLOR_WARNING;
  const corners = [
    [cellLeft, cellTop],
    [cellRight, cellTop],
    [cellLeft, cellBottom],
    [cellRight, cellBottom],
  ];

  for (const [dx, dy] of corners) {
    ctx.beginPath();
    ctx.arc(dx, dy, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

interface WinCellParams {
  x: number;
  y: number;
  width: number;
  height: number;
  cellTop: number;
  cellBottom: number;
  cellLeft: number;
  cellRight: number;
  cellSize: number;
  multiplier: number;
  detailTxt: string;
  isMobile: boolean;
}

function _drawWinCell(ctx: CanvasRenderingContext2D, p: WinCellParams) {
  const {
    x,
    y,
    width,
    height,
    cellTop,
    cellBottom,
    cellLeft,
    cellRight,
    cellSize,
    multiplier,
    detailTxt,
    isMobile,
  } = p;
  const radius = clamp(cellSize * 0.16, 6, 8);
  const innerInset = 0.75;
  const titleSize = clamp(Math.round(cellSize * 0.25), 10, 12);
  const detailSize = clamp(Math.round(cellSize * 0.17), 7, 8);
  const cornerDotRadius = clamp(cellSize * 0.032, 1.4, 1.9);
  const titleY = y + height * 0.44;
  const detailY = y + height * 0.68;
  const safeMultiplier = Number.isFinite(multiplier) ? multiplier : 0;

  ctx.save();
  ctx.shadowColor = "rgba(17,211,68,0.18)";
  ctx.shadowBlur = clamp(cellSize * 0.16, 6, 8);
  ctx.fillStyle = "rgba(17,211,68,0.04)";
  roundRect(
    ctx,
    x + innerInset,
    y + innerInset,
    width - innerInset * 2,
    height - innerInset * 2,
    radius,
  );
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#11D344";
  ctx.lineWidth = 0.5;
  roundRect(
    ctx,
    x + innerInset,
    y + innerInset,
    width - innerInset * 2,
    height - innerInset * 2,
    radius,
  );
  ctx.stroke();

  ctx.strokeStyle = "rgba(0,229,255,0.25)";
  ctx.lineWidth = 0.7;
  roundRect(
    ctx,
    x + innerInset * 2,
    y + innerInset * 2,
    width - innerInset * 4,
    height - innerInset * 4,
    Math.max(0, radius - 1),
  );
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#11D344";
  ctx.font = `${isMobile ? 600 : 700} ${titleSize}px sans-serif`;
  ctx.fillText(formatMultiplier(safeMultiplier), x + width / 2, titleY);

  ctx.fillStyle = "#7A9BB5";
  ctx.font = `${isMobile ? 500 : 600} ${detailSize}px sans-serif`;
  ctx.fillText(detailTxt, x + width / 2, detailY);

  ctx.fillStyle = "#12DDFF";
  const corners = [
    [cellLeft, cellTop],
    [cellRight, cellTop],
    [cellLeft, cellBottom],
    [cellRight, cellBottom],
  ];
  for (const [dx, dy] of corners) {
    ctx.beginPath();
    ctx.arc(dx, dy, cornerDotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function _drawBetBadge(ctx: CanvasRenderingContext2D, p: BetBadgeParams) {
  const {
    x,
    y,
    width,
    height,
    cellTop,
    cellBottom,
    cellLeft,
    cellRight,
    cellSize,
    multTxt,
    displayBetAmount,
  } = p;
  const inset = 0.75;
  const radius = clamp(cellSize * 0.18, 8, 12);
  const multiplierSize = clamp(Math.round(cellSize * 0.2), 11, 16);
  const badgeFontSize = clamp(Math.round(cellSize * 0.25), 13, 22);
  const badgeWidth = clamp(width * 0.5, 40, width - 18);
  const badgeHeight = clamp(height * 0.26, 18, 28);
  const badgeRadius = clamp(cellSize * 0.14, 6, 10);
  const centerX = x + width / 2;
  const multiplierY = y + height * 0.33;
  const badgeX = centerX - badgeWidth / 2;
  const badgeY = y + height * 0.56;
  const badgeText = `$${displayBetAmount}`;
  const cornerDotRadius = clamp(cellSize * 0.032, 1.4, 1.9);

  ctx.save();

  ctx.shadowColor = "rgba(0,229,255,0.12)";
  ctx.shadowBlur = clamp(cellSize * 0.14, 5, 8);
  ctx.fillStyle = "rgba(5,29,43,0.94)";
  roundRect(
    ctx,
    x + inset,
    y + inset,
    width - inset * 2,
    height - inset * 2,
    radius,
  );
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLOR_BLUE_SOFT;
  ctx.lineWidth = 0.5;
  roundRect(
    ctx,
    x + inset,
    y + inset,
    width - inset * 2,
    height - inset * 2,
    radius,
  );
  ctx.stroke();

  ctx.shadowColor = "rgba(0,229,255,0.16)";
  ctx.shadowBlur = clamp(cellSize * 0.18, 6, 9);
  ctx.strokeStyle = "rgba(18,221,255,0.14)";
  ctx.lineWidth = 0.6;
  roundRect(
    ctx,
    x + inset * 2,
    y + inset * 2,
    width - inset * 4,
    height - inset * 4,
    Math.max(0, radius - 2),
  );
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#00E5FF";
  ctx.font = `700 ${multiplierSize}px Inter, sans-serif`;
  ctx.fillText(multTxt, centerX, multiplierY);

  const badgeGradient = ctx.createLinearGradient(
    badgeX,
    badgeY,
    badgeX,
    badgeY + badgeHeight,
  );
  badgeGradient.addColorStop(0, "#3D95DA");
  badgeGradient.addColorStop(1, "#2C7FC8");
  ctx.fillStyle = badgeGradient;
  roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeRadius);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 ${badgeFontSize}px Inter, sans-serif`;
  ctx.shadowColor = "rgba(255,255,255,0.14)";
  ctx.shadowBlur = 0.8;
  ctx.shadowOffsetY = 0.4;
  ctx.fillText(badgeText, centerX, badgeY + badgeHeight / 2);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = "#00E5FF";
  const corners = [
    [cellLeft, cellTop],
    [cellRight, cellTop],
    [cellLeft, cellBottom],
    [cellRight, cellBottom],
  ];
  for (const [dx, dy] of corners) {
    ctx.beginPath();
    ctx.arc(dx, dy, cornerDotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
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
    (pt) =>
      pt.time >= firstTime - clipPaddingMs &&
      pt.time <= lastTime + clipPaddingMs,
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

  const { axisWidth, axisX } = getPriceAxisMetrics(ctx, layout, isMobile);

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  // Background strip
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(axisX, 0, axisWidth, h);

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
  const labelInterval = isMobile ? 30_000 : 15_000;
  const labelColor = isMobile ? "#7A9BB5" : "#79afd5";
  const stripHeight = 24;
  const { axisX } = getPriceAxisMetrics(ctx, layout, isMobile);
  const maxLabelX = isMobile ? axisX : w;

  // Collect timestamps that fall inside the visible time range
  const timeLabels: number[] = [];
  let tLabel = Math.floor(firstTime / labelInterval) * labelInterval;
  while (tLabel <= lastTime + labelInterval) {
    if (tLabel >= firstTime && tLabel <= lastTime) timeLabels.push(tLabel);
    tLabel += labelInterval;
  }

  if (isMobile) {
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, h - stripHeight, axisX, stripHeight);

    ctx.strokeStyle = COLOR_BORDER_MAIN;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - stripHeight + 0.5);
    ctx.lineTo(axisX, h - stripHeight + 0.5);
    ctx.stroke();
  }

  ctx.save();
  if (isMobile) {
    ctx.beginPath();
    ctx.rect(0, h - stripHeight, axisX, stripHeight);
    ctx.clip();
  }

  ctx.font = isMobile ? "500 10px monospace" : "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = isMobile ? "middle" : "bottom";

  for (const t of timeLabels) {
    const cx = toCanvasX(t);
    if (cx < 0 || cx > maxLabelX) continue;

    const label = timeLabelFormatter.format(new Date(t));

    ctx.fillStyle = labelColor;
    ctx.fillText(label, cx, isMobile ? h - stripHeight / 2 : h - 4);
  }

  ctx.restore();
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
