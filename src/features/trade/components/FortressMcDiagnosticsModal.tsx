"use client";

import React, { useMemo } from "react";
import {
  DialogClose,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/shadcn/dialog";
import {
  FORTRESS_MC_GRID_CELL_SECONDS,
  FORTRESS_MC_P_RAW_MAX,
} from "@/src/constants";

type FortressMcDiagnosticsPayload = {
  paths: number[][];
  pRaw: number[][];
};

type FortressMcDiagnosticsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  payload: unknown;
  currentPrice: number;
};

type ChartModel = {
  paths: number[][];
  pRaw: number[][];
  steps: number;
  yMin: number;
  yMax: number;
  pRawRows: number;
  pRawCols: number;
  pRawMax: number;
};

const CHART_WIDTH = 980;
const CHART_HEIGHT = 520;
const PADDING = { top: 24, right: 16, bottom: 34, left: 64 };
const HEATMAP_LABEL_MIN_CELL_WIDTH = 26;
const HEATMAP_LABEL_MIN_CELL_HEIGHT = 14;
const HEATMAP_LABEL_FONT_SIZE = 11;
const HEATMAP_LABEL_DECIMALS = 4;
const PRICE_AXIS_LABEL_DECIMALS = 4;
const PRICE_AXIS_QUANTIZE_STEP = 0.0005;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeFortressPayload(
  payload: unknown,
): FortressMcDiagnosticsPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  if (!Array.isArray(record.paths) || !Array.isArray(record.pRaw)) return null;

  const paths = record.paths
    .map((line) =>
      Array.isArray(line) ? line.filter((value) => isFiniteNumber(value)) : [],
    )
    .filter((line) => line.length > 1);

  const pRaw = record.pRaw
    .map((row) =>
      Array.isArray(row)
        ? row.map((value) => (isFiniteNumber(value) ? Math.max(0, value) : 0))
        : [],
    )
    .filter((row) => row.length > 0);

  if (paths.length === 0 || pRaw.length === 0) return null;
  return { paths, pRaw };
}

function probabilityColor(value: number, max: number): string {
  const normalized = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const hue = 52 - normalized * 38;
  const saturation = 52 + normalized * 28;
  const lightness = 80 - normalized * 44;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function probabilityLabelColor(value: number, max: number): string {
  const normalized = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  if (normalized >= 0.45) return "var(--color-text-heading)";
  if (normalized >= 0.2) return "var(--color-text-main)";
  return "var(--color-grid-axis)";
}

function formatHeatmapLabel(value: number): string {
  const rounded = value.toFixed(HEATMAP_LABEL_DECIMALS);
  return Number(rounded).toString();
}

export function FortressMcDiagnosticsModal({
  isOpen,
  onClose,
  payload,
  currentPrice,
}: FortressMcDiagnosticsModalProps) {
  const isLoadingHeatmap = payload == null;
  const model = useMemo<ChartModel | null>(() => {
    const normalized = normalizeFortressPayload(payload);
    if (!normalized) return null;

    const allPrices = normalized.paths.flat();
    const rawMin = Math.min(...allPrices);
    const rawMax = Math.max(...allPrices);
    const referencePrice = Number.isFinite(currentPrice)
      ? currentPrice
      : normalized.paths[0][0];
    const distance = Math.max(
      Math.abs(rawMax - referencePrice),
      Math.abs(referencePrice - rawMin),
      0.0001,
    );
    const yMin = referencePrice - distance;
    const yMax = referencePrice + distance;
    const steps = Math.max(...normalized.paths.map((path) => path.length - 1));
    const pRawCols = Math.max(...normalized.pRaw.map((row) => row.length));
    const pRawMax = Math.max(
      ...normalized.pRaw
        .flat()
        .map((value) => (Number.isFinite(value) ? value : 0)),
      FORTRESS_MC_P_RAW_MAX,
    );

    return {
      paths: normalized.paths,
      pRaw: normalized.pRaw,
      steps,
      yMin,
      yMax,
      pRawRows: normalized.pRaw.length,
      pRawCols,
      pRawMax,
    };
  }, [currentPrice, payload]);

  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const yAxisTickCount = 6;
  const xAxisTickStep = FORTRESS_MC_GRID_CELL_SECONDS;
  const xDomainMax = model
    ? Math.min(model.steps, model.pRawCols * FORTRESS_MC_GRID_CELL_SECONDS)
    : 1;

  const xScale = (second: number) =>
    PADDING.left + (Math.max(0, second) / Math.max(1, xDomainMax)) * plotWidth;
  const visibleGridWidth = model
    ? xScale(xDomainMax) - PADDING.left
    : plotWidth;
  const yScale = (price: number) => {
    if (!model) return PADDING.top + plotHeight / 2;
    const ratio =
      (price - model.yMin) / Math.max(1e-9, model.yMax - model.yMin);
    return PADDING.top + (1 - ratio) * plotHeight;
  };
  const yAxisPrices = useMemo(() => {
    if (!model) return [];
    const ticks = Array.from({ length: yAxisTickCount + 1 }, (_, index) => {
      const ratio = index / yAxisTickCount;
      const rawPrice = model.yMax - ratio * (model.yMax - model.yMin);
      const quantizedPrice =
        Math.round(rawPrice / PRICE_AXIS_QUANTIZE_STEP) *
        PRICE_AXIS_QUANTIZE_STEP;
      const clampedPrice = Math.min(
        model.yMax,
        Math.max(model.yMin, quantizedPrice),
      );
      return Number(clampedPrice.toFixed(PRICE_AXIS_LABEL_DECIMALS));
    });
    return ticks.filter(
      (price, index) => index === 0 || price !== ticks[index - 1],
    );
  }, [model, yAxisTickCount]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
    >
      <DialogContent className="pointer-events-none p-4">
        <div className="border-border-main bg-background-main pointer-events-auto relative w-fit max-w-[min(96vw,1120px)] rounded-[16px] border p-4">
          <DialogClose className="text-text-sub hover:text-text-main border-border-main bg-surface-overlay-subtle absolute top-3 right-3 rounded-md border px-2 py-1 text-xs transition-colors">
            X
          </DialogClose>
          <DialogTitle className="text-text-heading text-base font-semibold">
            Fortress MC Diagnostics
          </DialogTitle>
          <DialogDescription className="text-text-sub text-xs">
            Paths are plotted per second. Heatmap cells use 5-second buckets
            from pRaw.
          </DialogDescription>

          {!model ? (
            <div className="border-border-main bg-surface-overlay-subtle mt-4 rounded-[12px] border p-4">
              {isLoadingHeatmap ? (
                <div className="flex min-h-[140px] items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="border-border-main/40 border-t-text-main h-7 w-7 animate-spin rounded-full border-2" />
                    <p className="text-text-sub text-sm">
                      Loading heatmap diagnostics...
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-text-sub text-sm">
                  Waiting for `fortress_mc_diagnostics` payload.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <svg
                width={CHART_WIDTH}
                height={CHART_HEIGHT}
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                role="img"
                aria-label="Fortress Monte Carlo diagnostics chart"
              >
                <defs>
                  <filter
                    id="path-glow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feDropShadow
                      dx="0"
                      dy="0"
                      stdDeviation="1.2"
                      floodColor="#9ccaff"
                      floodOpacity="0.32"
                    />
                  </filter>
                  <clipPath id="path-area-clip">
                    <rect
                      x={PADDING.left}
                      y={PADDING.top}
                      width={visibleGridWidth}
                      height={plotHeight}
                    />
                  </clipPath>
                </defs>
                <rect
                  x={0}
                  y={0}
                  width={CHART_WIDTH}
                  height={CHART_HEIGHT}
                  fill="transparent"
                />

                {model.pRaw.map((row, rowIndex) =>
                  row.map((value, colIndex) => {
                    const xStart = colIndex * FORTRESS_MC_GRID_CELL_SECONDS;
                    const xEnd = (colIndex + 1) * FORTRESS_MC_GRID_CELL_SECONDS;
                    const x = xScale(xStart);
                    const width = Math.max(1, xScale(xEnd) - x);
                    const y =
                      PADDING.top + (rowIndex / model.pRawRows) * plotHeight;
                    const height = plotHeight / model.pRawRows;
                    const canRenderLabel =
                      width >= HEATMAP_LABEL_MIN_CELL_WIDTH &&
                      height >= HEATMAP_LABEL_MIN_CELL_HEIGHT;
                    const label = formatHeatmapLabel(value);
                    return (
                      <g key={`cell-${rowIndex}-${colIndex}`}>
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          fill={probabilityColor(value, model.pRawMax)}
                          opacity={0.82}
                          stroke="rgb(15 23 42 / 16%)"
                          strokeWidth={0.6}
                        />
                        {canRenderLabel ? (
                          <text
                            x={x + width / 2}
                            y={y + height / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={probabilityLabelColor(value, model.pRawMax)}
                            fontSize={HEATMAP_LABEL_FONT_SIZE}
                            opacity={0.96}
                          >
                            {label}
                          </text>
                        ) : null}
                      </g>
                    );
                  }),
                )}

                {Array.from(
                  { length: Math.max(2, Math.ceil(xDomainMax / 5) + 1) },
                  (_, index) => {
                    const second = Math.min(xDomainMax, index * 5);
                    const x = xScale(second);
                    return (
                      <line
                        key={`v-grid-${index}`}
                        x1={x}
                        y1={PADDING.top}
                        x2={x}
                        y2={PADDING.top + plotHeight}
                        stroke="rgb(148 163 184 / 24%)"
                      />
                    );
                  },
                )}

                {yAxisPrices.map((price, index) => {
                  const y = yScale(price);
                  return (
                    <g key={`y-axis-${index}`}>
                      <line
                        x1={PADDING.left - 6}
                        y1={y}
                        x2={PADDING.left}
                        y2={y}
                        stroke="var(--color-grid-axis)"
                        strokeWidth={1}
                      />
                      <text
                        x={PADDING.left - 10}
                        y={y}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill="var(--color-text-main)"
                        fontSize={12}
                      >
                        {price.toFixed(PRICE_AXIS_LABEL_DECIMALS)}
                      </text>
                    </g>
                  );
                })}

                <g clipPath="url(#path-area-clip)">
                  {model.paths.map((path, pathIndex) => {
                    const d = path
                      .map(
                        (value, pointIndex) =>
                          `${pointIndex === 0 ? "M" : "L"} ${xScale(pointIndex)} ${yScale(value)}`,
                      )
                      .join(" ");
                    return (
                      <path
                        key={`path-${pathIndex}`}
                        d={d}
                        fill="none"
                        stroke="rgb(153 203 255 / 66%)"
                        strokeWidth={1.45}
                        filter="url(#path-glow)"
                      />
                    );
                  })}
                </g>

                <line
                  x1={PADDING.left}
                  y1={yScale(currentPrice)}
                  x2={xScale(xDomainMax)}
                  y2={yScale(currentPrice)}
                  stroke="#ff5d5d"
                  strokeDasharray="6 5"
                  strokeWidth={1.8}
                />

                {Array.from(
                  { length: Math.floor(xDomainMax / xAxisTickStep) + 1 },
                  (_, index) => {
                    const second = index * xAxisTickStep;
                    const x = xScale(second);
                    const y = PADDING.top + plotHeight;
                    return (
                      <g key={`x-axis-${second}`}>
                        <line
                          x1={x}
                          y1={y}
                          x2={x}
                          y2={y + 6}
                          stroke="var(--color-grid-axis)"
                          strokeWidth={1}
                        />
                        <text
                          x={x}
                          y={y + 18}
                          textAnchor="middle"
                          fill="var(--color-text-main)"
                          fontSize={12}
                        >
                          {second}s
                        </text>
                      </g>
                    );
                  },
                )}
              </svg>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
