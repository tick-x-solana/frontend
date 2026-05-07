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
import { formatApproxUsd as formatApproxUsdValue } from "@/src/utils/formatters";

const timeLabelFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const priceLabelFormatterOneDecimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const priceLabelFormatterTwoDecimals = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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
export const COLOR_WARNING_SURFACE = "rgba(253,127,38,0.10)";
export const COLOR_RED_SOFT = "#FF5A6E";

const PRICE_AXIS_MIN_LABEL_GAP_PX = 18;
const TIME_AXIS_MIN_LABEL_GAP_PX = 56;
const REWARD_RATE_LABEL_HIDE_ZOOM = 0.39;
const CELL_DETAIL_COMPACT_ZOOM = 0.5;

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

function formatApproxUsd(amountWld: number, wldUsdPrice: number | null) {
  return formatApproxUsdValue(amountWld, wldUsdPrice);
}

function formatPriceLabel(value: number, marketId: string): string {
  const normalizedMarketId = marketId.trim().toUpperCase();
  const isEthUsdMarket =
    normalizedMarketId === "ETHUSD" || normalizedMarketId === "ETHUSDT";
  return isEthUsdMarket
    ? priceLabelFormatterTwoDecimals.format(value)
    : priceLabelFormatterOneDecimal.format(value);
}

function hasChartPassedColumn(
  chartX: number,
  columnStartX: number,
  columnWidth: number,
) {
  return chartX >= columnStartX + columnWidth - 0.5;
}

function getClosingFadeAlpha(
  cellStartTs: number,
  now: number,
  closingMs: number,
): number {
  const remainingMs = Math.max(0, cellStartTs - now);
  const ratio = clamp(remainingMs / closingMs, 0, 1);
  // At the closing boundary keep full opacity; near chart head fade down.
  return 0.35 + ratio * 0.65;
}

function getClosingPulseAlpha(
  cellStartTs: number,
  now: number,
  closingMs: number,
): number {
  const fade = getClosingFadeAlpha(cellStartTs, now, closingMs);
  const pulse = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(now / 180));
  return clamp(fade * pulse, 0.2, 1);
}

function getCompactRateColor(multColor: string, rate: number): string {
  const safeRate = Number.isFinite(rate) ? Math.max(rate, 0) : 0;
  // Normalize to [0,1] around the common reward-rate span.
  const strength = clamp((safeRate - 1) / 24, 0, 1);
  const alpha = 0.42 + strength * 0.36;

  if (multColor === COLOR_GREEN) {
    const green = Math.round(178 - strength * 44);
    const blue = Math.round(170 - strength * 28);
    return `rgba(92, ${green}, ${blue}, ${alpha.toFixed(3)})`;
  }

  if (multColor === COLOR_RED || multColor === COLOR_RED_SOFT) {
    const red = Math.round(156 - strength * 24);
    const green = Math.round(112 - strength * 28);
    const blue = Math.round(124 - strength * 26);
    return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
  }

  if (multColor === COLOR_BLUE || multColor === COLOR_BLUE_SOFT) {
    const red = Math.round(82 - strength * 22);
    const green = Math.round(132 - strength * 24);
    const blue = Math.round(194 - strength * 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
  }

  // Neutral cells still follow rate intensity but remain less saturated.
  const red = Math.round(86 - strength * 20);
  const green = Math.round(124 - strength * 20);
  const blue = Math.round(176 - strength * 14);
  return `rgba(${red}, ${green}, ${blue}, ${(alpha - 0.04).toFixed(3)})`;
}

function getPriceAxisMetrics(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  isMobile: boolean,
) {
  const { plotRight, priceAxisWidth } = layout;
  const fontSize = isMobile ? 8 : 9;

  ctx.font = `bold ${fontSize}px monospace`;

  const axisWidth = priceAxisWidth;

  return {
    axisWidth,
    axisX: plotRight,
    axisRight: plotRight + axisWidth,
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
    plotRight,
    plotBottom,
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
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, plotRight, plotBottom);
  ctx.clip();

  // Determine the visible price / time range in logical units
  const visibleT0 = toTime(0);
  const visibleT1 = toTime(plotRight);
  const priceAtTop = toPrice(0);
  const priceAtBot = toPrice(plotBottom);
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
    if (cellTop > plotBottom + cellH || cellTop + cellH < 0) continue;

    for (let ts = colStartTs; ts <= colEndTs; ts += intervalMs) {
      const cx = toCanvasX(ts);
      if (cx + cellW < 0 || cx > plotRight) continue;

      ctx.fillRect(cx, cellTop, cellW, cellH);
      // Inset 0.5 px so adjacent cells share the same pixel — one crisp line, no doubling
      ctx.strokeRect(cx + 0.5, cellTop + 0.5, cellW - 1, cellH - 1);
    }
  }
  ctx.restore();
}

// ─── Current-time indicator ───────────────────────────────────────────────────

export function drawNowLine(ctx: CanvasRenderingContext2D, layout: GridLayout) {
  const { plotBottom, toCanvasX, chartHeadTime } = layout;
  const nowX = toCanvasX(chartHeadTime);
  ctx.strokeStyle = COLOR_NOW;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nowX, 0);
  ctx.lineTo(nowX, plotBottom);
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
  activeWinEffectCellIds: Set<string> = new Set(),
) {
  const {
    plotRight,
    plotBottom,
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
  const { cells, bets, history, pendingBets, settledOutcomes } = store;
  const wldUsdPrice =
    typeof store.wldUsdPrice === "number" && Number.isFinite(store.wldUsdPrice)
      ? store.wldUsdPrice
      : null;
  const followedActivitiesByCellId = store.followedOrderActivities.reduce<
    Record<string, (typeof store.followedOrderActivities)[number]>
  >((acc, activity) => {
    if (!activity.cellId) return acc;

    const current = acc[activity.cellId];
    if (!current || activity.observedAt >= current.observedAt) {
      acc[activity.cellId] = activity;
    }
    return acc;
  }, {});
  const suggestedStrategyCellIds = new Set(store.suggestedStrategyCellIds);
  const chartTime = getLatestChartTime(history, now);
  const hideThresholdTime = getCellHideThresholdTime(chartTime);
  const chartHeadX = toCanvasX(chartTime);
  const selectedColumnStart =
    cells
      .filter(
        (cell) =>
          !hasChartPassedColumn(
            chartHeadX,
            toCanvasX(cell.timeWindowStart),
            cellW,
          ),
      )
      .reduce<
        number | null
      >((minTs, cell) => (minTs === null || cell.timeWindowStart < minTs ? cell.timeWindowStart : minTs), null) ??
    null;

  // Closing window: cells whose window starts within this many ms cannot be bet on
  const CLOSING_MS = 5000;
  const shouldHideRewardRateLabel = layout.zoom < REWARD_RATE_LABEL_HIDE_ZOOM;
  const shouldUseCompactCellDetail = layout.zoom < CELL_DETAIL_COMPACT_ZOOM;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, plotRight, plotBottom);
  ctx.clip();
  for (const cell of cells) {
    const isHit = cell.status === "hit";
    // Win cells are drawn even if they've scrolled past the left viewport edge
    // so the green state remains visible until the cell is completely off-canvas.
    if (
      !isHit &&
      (cell.timeWindowEnd < firstTime || cell.timeWindowStart > lastTime)
    )
      continue;
    if (cell.timeWindowStart > lastTime) continue;

    const isPast = now >= cell.timeWindowEnd;
    const isLose = cell.status === "lose";
    const betAmountVal = bets[cell.id] || 0;
    const pendingBetAmountVal = pendingBets[cell.id] || 0;
    const hasBet = betAmountVal > 0;
    const isPending = pendingBetAmountVal > 0;
    const hasAnyBet = hasBet || isPending;
    const displayBetAmount = hasBet ? betAmountVal : pendingBetAmountVal;
    const followedActivity = followedActivitiesByCellId[cell.id] ?? null;
    const hasFollowedActivity = followedActivity !== null;
    const shouldHideLosingBet = isLose && hasAnyBet;

    const cx = toCanvasX(cell.timeWindowStart);
    const cellTop = toCellY(cell.priceLevel + effectivePriceStep / 2);
    const chartPassedColumn = hasChartPassedColumn(chartHeadX, cx, cellW);
    const hasSuggestedStrategy = suggestedStrategyCellIds.has(cell.id);
    const hasOverlayActivity = hasFollowedActivity || hasSuggestedStrategy;
    const chartPassedCell = chartTime >= cell.timeWindowEnd;
    const hasVisibleOverlayActivity = hasOverlayActivity && !chartPassedCell;
    const proximityVisualAlpha = !hasAnyBet
      ? clamp((cx - chartHeadX + cellW * 0.2) / (cellW * 0.8), 0, 1)
      : 1;
    const overlayVisualAlpha = hasVisibleOverlayActivity
      ? proximityVisualAlpha
      : 1;
    const hasTrackedState =
      (hasAnyBet && !shouldHideLosingBet) ||
      isHit ||
      (isLose && !shouldHideLosingBet) ||
      hasVisibleOverlayActivity;

    if (chartPassedColumn && !hasTrackedState) continue;

    const isFuture = cell.timeWindowStart > hideThresholdTime;
    const isNext = isFuture && cell.timeWindowStart - now <= CLOSING_MS;
    const nextCellVisualAlpha =
      isNext && !hasAnyBet
        ? getClosingPulseAlpha(cell.timeWindowStart, now, CLOSING_MS)
        : 1;
    const plainCellVisualAlpha =
      !hasAnyBet && !hasVisibleOverlayActivity
        ? Math.min(nextCellVisualAlpha, proximityVisualAlpha)
        : 1;
    const isSelectedColumn =
      selectedColumnStart !== null &&
      cell.timeWindowStart === selectedColumnStart;
    const isPreviewed =
      previewCellId === cell.id && !isPast && !isNext && !hasAnyBet;

    // priceLevel is the CENTRE of the band; top edge = centre + step/2
    const cw = cellW;
    const ch = cellH;

    if (
      cx + cw < 0 ||
      cx > plotRight ||
      cellTop + ch < 0 ||
      cellTop > plotBottom
    )
      continue;

    // Clip to canvas edge so cells that extend past any viewport edge shrink correctly
    const rx = Math.max(0, cx);
    const ry = Math.max(0, cellTop);
    const rw = Math.min(cx + cw, plotRight) - rx;
    const rh = Math.min(cellTop + ch, plotBottom) - ry;
    if (rw <= 0 || rh <= 0) continue;
    if (shouldHideLosingBet) continue;
    const needsClip =
      cx < 0 || cx + cw > plotRight || cellTop < 0 || cellTop + ch > plotBottom;
    if (needsClip) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
    }

    const multColor =
      hasAnyBet && !isHit
        ? COLOR_BLUE
        : isLose && hasAnyBet
          ? COLOR_RED_SOFT
          : isHit && hasAnyBet
            ? COLOR_GREEN
            : isNext && !hasAnyBet
              ? `rgba(83,117,155,${0.24 + nextCellVisualAlpha * 0.5})`
              : cell.multiplier >= 100
                ? COLOR_RED
                : isSelectedColumn
                  ? COLOR_BLUE_SOFT
                  : cell.multiplier >= 10
                    ? COLOR_BLUE
                    : COLOR_TEXT_DIM;

    if (shouldHideRewardRateLabel) {
      if (isNext && !hasAnyBet) {
        ctx.globalAlpha = plainCellVisualAlpha;
      } else if (!hasAnyBet && !hasVisibleOverlayActivity) {
        ctx.globalAlpha = plainCellVisualAlpha;
      } else if (!hasAnyBet && hasVisibleOverlayActivity) {
        ctx.globalAlpha = overlayVisualAlpha;
      }

      // Compact mode for deep zoom: show only color blocks, no labels/details.
      const compactRate =
        hasAnyBet || isHit
          ? cell.multiplier
          : Number(cell.original.rewardRate || cell.multiplier);
      const shouldForceWinBetGreen = hasAnyBet || isHit;
      ctx.fillStyle = shouldForceWinBetGreen
        ? getCompactRateColor(
            COLOR_GREEN,
            Number.isFinite(compactRate) && compactRate > 0 ? compactRate : 1,
          )
        : getCompactRateColor(
            multColor,
            Number.isFinite(compactRate) && compactRate > 0 ? compactRate : 1,
          );
      ctx.fillRect(
        rx + 0.5,
        ry + 0.5,
        Math.max(0, rw - 1),
        Math.max(0, rh - 1),
      );
      ctx.globalAlpha = 1;

      ctx.strokeStyle = COLOR_GRID;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(
        rx + 0.5,
        ry + 0.5,
        Math.max(0, rw - 1),
        Math.max(0, rh - 1),
      );

      if (needsClip) ctx.restore();
      continue;
    }

    const textX = cx + cw - clamp(cellSize * 0.13, 6, 10);
    const textY = cellTop + ch - clamp(cellSize * 0.12, 6, 10);

    // ── Background fill ──
    if (isPreviewed) {
      _drawPreviewCell(ctx, {
        x: cx,
        y: cellTop,
        width: cw,
        height: ch,
        cellTop,
        cellBottom: cellTop + ch,
        cellLeft: cx,
        cellRight: cx + cw,
        cellSize,
        multiplier: Number(cell.original.rewardRate),
      });
    } else if (!hasAnyBet && hasVisibleOverlayActivity) {
      ctx.save();
      ctx.globalAlpha *= overlayVisualAlpha;
      _drawCopyTradeCell(ctx, {
        x: cx,
        y: cellTop,
        width: cw,
        height: ch,
        cellTop,
        cellBottom: cellTop + ch,
        cellLeft: cx,
        cellRight: cx + cw,
        cellSize,
      });
      ctx.restore();
    } else if (isHit) {
      const rewardRate = hasAnyBet
        ? cell.multiplier
        : Number(cell.original.rewardRate || cell.multiplier);
      const settledOutcome = settledOutcomes[cell.id];
      const hasSettledBreakdown =
        settledOutcome?.basePayout !== null ||
        settledOutcome?.bonusPayout !== null;
      const settledBasePayout = Math.max(settledOutcome?.basePayout ?? 0, 0);
      const settledBonusPayout = Math.max(settledOutcome?.bonusPayout ?? 0, 0);
      const settledTotalPayout = hasSettledBreakdown
        ? settledBasePayout + settledBonusPayout
        : Math.max(settledOutcome?.payout ?? 0, 0);
      const receivedAmount =
        settledTotalPayout > 0
          ? settledTotalPayout
          : Math.max(0, displayBetAmount * rewardRate);
      const shouldHideReceivedAmount = activeWinEffectCellIds.has(cell.id);
      const receivedApproxUsd = formatApproxUsd(receivedAmount, wldUsdPrice);
      _drawWinCell(ctx, {
        x: cx,
        y: cellTop,
        width: cw,
        height: ch,
        cellTop,
        cellBottom: cellTop + ch,
        cellLeft: cx,
        cellRight: cx + cw,
        cellSize,
        multiplier: rewardRate,
        detailTxt: hasAnyBet
          ? shouldHideReceivedAmount
            ? ""
            : receivedApproxUsd
              ? `+${receivedApproxUsd}`
              : "$--"
          : "",
        isMobile,
        compact: shouldUseCompactCellDetail,
      });
    } else if (isLose && !shouldHideLosingBet) {
      const betApproxUsd = formatApproxUsd(displayBetAmount, wldUsdPrice);
      _drawLoseCell(ctx, {
        x: cx,
        y: cellTop,
        width: cw,
        height: ch,
        cellTop,
        cellBottom: cellTop + ch,
        cellLeft: cx,
        cellRight: cx + cw,
        cellSize,
        multiplier: cell.multiplier,
        detailTxt: hasAnyBet ? (betApproxUsd ?? "$--") : "Settled",
        isMobile,
        compact: shouldUseCompactCellDetail,
      });
    } else if (!isPast && hasAnyBet && !shouldHideLosingBet) {
      const betApproxUsd = formatApproxUsd(displayBetAmount, wldUsdPrice);
      _drawBetBadge(ctx, {
        x: cx,
        y: cellTop,
        width: cw,
        height: ch,
        cellTop,
        cellBottom: cellTop + ch,
        cellLeft: cx,
        cellRight: cx + cw,
        cellSize,
        multTxt: formatMultiplier(cell.multiplier),
        betAmountUsdText: betApproxUsd ?? "$--",
      });
    }

    // Subtle outer border (always)
    if (
      !isPreviewed &&
      !(hasAnyBet && !isHit && !isLose) &&
      !hasVisibleOverlayActivity
    ) {
      ctx.strokeStyle =
        isNext && !hasAnyBet
          ? `rgba(22,46,71,${0.2 + plainCellVisualAlpha * 0.4})`
          : COLOR_GRID;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(
        rx + 0.5,
        ry + 0.5,
        Math.max(0, rw - 1),
        Math.max(0, rh - 1),
      );
    }

    // ── Text ──
    // Font scales with zoom so labels remain readable at any zoom level
    const fontSize =
      clamp(Math.round(cellSize * 0.2), 7, 12) / (isMobile ? 1.08 : 1);
    ctx.font = `${cell.multiplier >= 100 ? "bold" : cell.multiplier >= 10 ? "600" : "normal"} ${fontSize}px monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = multColor;

    // Glow behind multiplier text for active/won bets
    if (isHit && hasAnyBet) {
      ctx.shadowColor = "rgba(46,189,133,1)";
      ctx.shadowBlur = 8;
    } else if (isLose && hasAnyBet) {
      ctx.shadowColor = "rgba(246,70,93,0.7)";
      ctx.shadowBlur = 6;
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
    } else if (hasAnyBet && !isHit) {
      if (isLose) {
        if (needsClip) ctx.restore();
        continue;
      }
      if (needsClip) ctx.restore();
      continue;
    } else if (isHit) {
      if (needsClip) ctx.restore();
      continue;
    } else if (isLose) {
      if (needsClip) ctx.restore();
      continue;
    } else {
      // Plain multiplier
      if (isNext && !hasAnyBet) {
        ctx.globalAlpha = plainCellVisualAlpha;
      } else if (!hasAnyBet && !hasVisibleOverlayActivity) {
        ctx.globalAlpha = plainCellVisualAlpha;
      } else if (!hasAnyBet && hasVisibleOverlayActivity) {
        ctx.globalAlpha = overlayVisualAlpha;
      }
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
          if (dx < -2 || dx > plotRight + 2 || dy < -2 || dy > plotBottom + 2)
            continue;
          ctx.beginPath();
          ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;
    if (needsClip) ctx.restore();
  }
  ctx.restore();
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
  betAmountUsdText: string;
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
  } = p;
  const radius = clamp(cellSize * 0.16, 6, 8);
  const innerInset = 0.75;
  const titleSize = clamp(Math.round(cellSize * 0.25), 10, 12);
  const cornerDotRadius = clamp(cellSize * 0.032, 1.4, 1.9);
  const titleY = y + height * 0.44;
  const safeMultiplier =
    typeof multiplier === "number" && Number.isFinite(multiplier)
      ? multiplier
      : 0;

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
  } = p;
  const cardRadius = 0;
  const inset = 0.25;
  const dotRadius = clamp(cellSize * 0.03, 1.6, 2.1);

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

  ctx.lineWidth = 0.75;
  ctx.strokeStyle = "rgba(253,127,38,0.45)";
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
  compact: boolean;
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
    compact,
  } = p;
  const radius = clamp(cellSize * 0.16, 6, 8);
  const innerInset = 0.75;
  const titleSizeBase = clamp(Math.round(cellSize * 0.24), 8, 16);
  const detailSizeBase = clamp(Math.round(cellSize * 0.17), 7, 12);
  const cornerDotRadius = clamp(cellSize * 0.032, 1.4, 1.9);
  const titleY = compact ? y + height * 0.52 : y + height * 0.44;
  const detailY = compact ? y + height * 0.56 : y + height * 0.68;
  const safeMultiplier = Number.isFinite(multiplier) ? multiplier : 0;
  const receivedAmountText = detailTxt.trim();
  const maxTextWidth = Math.max(6, width - innerInset * 6);

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
  if (!compact && receivedAmountText.length > 0) {
    ctx.fillStyle = "#11D344";
    let titleSize = titleSizeBase;
    ctx.font = `${isMobile ? 600 : 700} ${titleSize}px sans-serif`;
    const titleWidth = ctx.measureText(receivedAmountText).width;
    if (titleWidth > maxTextWidth) {
      titleSize = Math.max(
        7,
        Math.floor((titleSize * maxTextWidth) / Math.max(titleWidth, 1)),
      );
      ctx.font = `${isMobile ? 600 : 700} ${titleSize}px sans-serif`;
    }
    ctx.fillText(receivedAmountText, x + width / 2, titleY);
  }

  ctx.fillStyle = "#7A9BB5";
  const multiplierText = formatMultiplier(safeMultiplier);
  let detailSize = compact ? Math.max(8, detailSizeBase) : detailSizeBase;
  ctx.font = `${isMobile ? 500 : 600} ${detailSize}px sans-serif`;
  const detailWidth = ctx.measureText(multiplierText).width;
  if (detailWidth > maxTextWidth) {
    detailSize = Math.max(
      7,
      Math.floor((detailSize * maxTextWidth) / Math.max(detailWidth, 1)),
    );
    ctx.font = `${isMobile ? 500 : 600} ${detailSize}px sans-serif`;
  }
  ctx.fillText(formatMultiplier(safeMultiplier), x + width / 2, detailY);

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

function _drawLoseCell(ctx: CanvasRenderingContext2D, p: WinCellParams) {
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
    compact,
  } = p;
  const radius = clamp(cellSize * 0.16, 6, 8);
  const innerInset = 0.75;
  const titleSizeBase = clamp(Math.round(cellSize * 0.22), 8, 12);
  const detailSizeBase = clamp(Math.round(cellSize * 0.2), 7, 14);
  const cornerDotRadius = clamp(cellSize * 0.032, 1.4, 1.9);
  const titleY = y + height * 0.44;
  const detailY = compact ? y + height * 0.56 : y + height * 0.68;
  const safeMultiplier = Number.isFinite(multiplier) ? multiplier : 0;
  const maxTextWidth = Math.max(6, width - innerInset * 6);

  ctx.save();
  ctx.shadowColor = "rgba(246,70,93,0.16)";
  ctx.shadowBlur = clamp(cellSize * 0.16, 6, 8);
  ctx.fillStyle = "rgba(246,70,93,0.05)";
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
  ctx.strokeStyle = COLOR_RED_SOFT;
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

  ctx.strokeStyle = "rgba(246,70,93,0.28)";
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
  ctx.fillStyle = COLOR_RED_SOFT;
  const multiplierText = formatMultiplier(safeMultiplier);
  let titleSize = titleSizeBase;
  ctx.font = `${isMobile ? 600 : 700} ${titleSize}px sans-serif`;
  const titleWidth = ctx.measureText(multiplierText).width;
  if (titleWidth > maxTextWidth) {
    titleSize = Math.max(
      7,
      Math.floor((titleSize * maxTextWidth) / Math.max(titleWidth, 1)),
    );
    ctx.font = `${isMobile ? 600 : 700} ${titleSize}px sans-serif`;
  }
  ctx.fillText(multiplierText, x + width / 2, titleY);

  if (!compact) {
    ctx.fillStyle = "#E6A0AA";
    let detailSize = detailSizeBase;
    ctx.font = `${isMobile ? 500 : 600} ${detailSize}px sans-serif`;
    const detailWidth = ctx.measureText(detailTxt).width;
    if (detailWidth > maxTextWidth) {
      detailSize = Math.max(
        7,
        Math.floor((detailSize * maxTextWidth) / Math.max(detailWidth, 1)),
      );
      ctx.font = `${isMobile ? 500 : 600} ${detailSize}px sans-serif`;
    }
    ctx.fillText(detailTxt, x + width / 2, detailY);
  }

  ctx.fillStyle = COLOR_RED_SOFT;
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
    betAmountUsdText,
  } = p;
  const inset = 0.75;
  const radius = clamp(cellSize * 0.18, Math.min(8, cellSize * 0.15), 12);
  const multiplierSize = clamp(
    Math.round(cellSize * 0.2),
    Math.max(6, Math.round(cellSize * 0.14)),
    16,
  );
  const badgeBaseFontSize = clamp(
    Math.round(cellSize * 0.22),
    Math.max(7, Math.round(cellSize * 0.16)),
    20,
  );
  const badgeWidth = clamp(width * 0.46, Math.min(38, width * 0.7), width - 4);
  const badgeHeight = clamp(
    height * 0.28,
    Math.min(18, height * 0.22),
    Math.min(28, height * 0.32),
  );
  const badgeRadius = clamp(cellSize * 0.14, Math.min(6, cellSize * 0.1), 10);
  const centerX = x + width / 2;
  const multiplierY = y + height * 0.33;
  const badgeX = centerX - badgeWidth / 2;
  const badgeY = y + height * 0.56;
  const badgeText = betAmountUsdText;
  const cornerDotRadius = clamp(cellSize * 0.032, 1.4, 1.9);
  const compact = cellSize < 30;

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
  const fittedMultiplierSize = compact
    ? Math.max(7, Math.floor(multiplierSize * 0.86))
    : multiplierSize;
  ctx.font = `700 ${fittedMultiplierSize}px Inter, sans-serif`;
  ctx.fillText(multTxt, centerX, multiplierY);

  if (compact) {
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
    return;
  }

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

  const badgeMaxTextWidth = Math.max(6, badgeWidth - 8);
  let badgeFontSize = badgeBaseFontSize;
  ctx.font = `700 ${badgeFontSize}px Inter, sans-serif`;
  const measuredBadgeTextWidth = ctx.measureText(badgeText).width;
  if (measuredBadgeTextWidth > badgeMaxTextWidth) {
    badgeFontSize = Math.max(
      Math.max(6, Math.round(cellSize * 0.1)),
      Math.floor((badgeFontSize * badgeMaxTextWidth) / measuredBadgeTextWidth),
    );
  }

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
  const { plotRight, plotBottom, toCanvasX, toCanvasY, toTime } = layout;
  const { history } = store;
  if (history.length < 2) return;

  const clipPaddingPx = 80;
  const minTime = Math.min(
    toTime(-clipPaddingPx),
    toTime(plotRight + clipPaddingPx),
  );
  const maxTime = Math.max(
    toTime(-clipPaddingPx),
    toTime(plotRight + clipPaddingPx),
  );

  const lowerBoundByTime = (value: number) => {
    let lo = 0;
    let hi = history.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (history[mid].time < value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const upperBoundByTime = (value: number) => {
    let lo = 0;
    let hi = history.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (history[mid].time <= value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const startIndex = Math.max(0, lowerBoundByTime(minTime) - 1);
  const endIndex = Math.min(history.length, upperBoundByTime(maxTime) + 1);
  if (endIndex - startIndex < 2) return;

  const points: Array<{ x: number; y: number }> = [];
  for (let index = startIndex; index < endIndex; index += 1) {
    const pt = history[index];
    points.push({ x: toCanvasX(pt.time), y: toCanvasY(pt.price) });
  }
  if (points.length < 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, plotRight, plotBottom);
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
  const latestPoint = history[endIndex - 1];
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

  ctx.restore();
}

// ─── Price Y-axis labels ──────────────────────────────────────────────────────

export function drawPriceAxis(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  store: StoreSnapshot,
  isMobile: boolean,
) {
  const { w, plotBottom, toCellY, effectivePriceStep, basePrice } = layout;
  const anchorPrice = basePrice;
  const anchorRowIdx = 0;

  // Compute visible row range
  const priceAtTop = layout.toPrice(0);
  const priceAtBot = layout.toPrice(plotBottom);
  const rowAtTop = (priceAtTop - basePrice) / effectivePriceStep;
  const rowAtBot = (priceAtBot - basePrice) / effectivePriceStep;
  const rowStartIdx = Math.floor(Math.min(rowAtTop, rowAtBot)) - 2;
  const rowEndIdx = Math.ceil(Math.max(rowAtTop, rowAtBot)) + 2;

  const { axisWidth, axisX } = getPriceAxisMetrics(ctx, layout, isMobile);

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  // Background strip
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(axisX, 0, axisWidth, plotBottom);

  // Separator line
  ctx.strokeStyle = COLOR_GRID_STRONG;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(axisX, 0);
  ctx.lineTo(axisX, plotBottom);
  ctx.stroke();

  ctx.fillStyle = COLOR_TEXT_DIM;
  const rowStep = Math.max(
    1,
    Math.ceil(PRICE_AXIS_MIN_LABEL_GAP_PX / Math.max(layout.cellH, 1)),
  );
  const firstLabeledRow = Math.ceil(rowStartIdx / rowStep) * rowStep;
  for (let i = firstLabeledRow; i <= rowEndIdx; i += rowStep) {
    const p = anchorPrice + (i - anchorRowIdx) * effectivePriceStep;
    const cy = toCellY(p);
    if (cy < -10 || cy > plotBottom + 10) continue;
    ctx.fillText(formatPriceLabel(p, store.marketId), w - 4, cy);
  }

  const focusPrice = layout.cam;
  const focusY = layout.toCanvasY(focusPrice);
  if (focusY > 8 && focusY < plotBottom - 8) {
    const focusText = formatPriceLabel(focusPrice, store.marketId);
    const textWidth = ctx.measureText(focusText).width + 10;
    const boxX = axisX + Math.max(2, axisWidth - textWidth - 2);
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
  const { plotBottom, plotRight, timeAxisHeight, toCanvasX, toTime } = layout;
  const labelInterval = isMobile ? 30_000 : 15_000;
  const labelColor = isMobile ? "#7A9BB5" : "#79afd5";
  const stripHeight = timeAxisHeight;
  const stripTop = plotBottom;
  const maxLabelX = plotRight;

  // Use the full visible canvas range so labels are distributed across the
  // entire bottom strip, not only the data-grid core.
  const visibleTimeStart = Math.min(toTime(0), toTime(maxLabelX));
  const visibleTimeEnd = Math.max(toTime(0), toTime(maxLabelX));

  // Collect timestamps that fall inside the visible time range
  const timeLabels: number[] = [];
  let tLabel = Math.floor(visibleTimeStart / labelInterval) * labelInterval;
  while (tLabel <= visibleTimeEnd + labelInterval) {
    if (tLabel >= visibleTimeStart && tLabel <= visibleTimeEnd) {
      timeLabels.push(tLabel);
    }
    tLabel += labelInterval;
  }

  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, stripTop, plotRight, stripHeight);

  ctx.strokeStyle = COLOR_BORDER_MAIN;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, stripTop + 0.5);
  ctx.lineTo(plotRight, stripTop + 0.5);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, stripTop, plotRight, stripHeight);
  ctx.clip();

  ctx.font = isMobile ? "500 10px monospace" : "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let lastLabelX = -Infinity;

  for (const t of timeLabels) {
    const cx = toCanvasX(t);
    if (cx < 0 || cx > maxLabelX) continue;
    if (cx - lastLabelX < TIME_AXIS_MIN_LABEL_GAP_PX) continue;

    const label = timeLabelFormatter.format(new Date(t));

    ctx.fillStyle = labelColor;
    ctx.fillText(label, cx, stripTop + stripHeight / 2);
    lastLabelX = cx;
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
  const { plotRight } = layout;
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(18,221,255,0.75)";
  ctx.fillText(`${zoom.toFixed(2)}x`, plotRight - 6, 6);
}
