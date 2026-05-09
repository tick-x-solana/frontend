"use client";

import React, { useMemo } from "react";
import {
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeFortressPayload(payload: unknown): FortressMcDiagnosticsPayload | null {
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
  const hue = 56 - normalized * 52;
  const saturation = 84;
  const lightness = 88 - normalized * 46;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function FortressMcDiagnosticsModal({
  isOpen,
  onClose,
  payload,
  currentPrice,
}: FortressMcDiagnosticsModalProps) {
  const model = useMemo<ChartModel | null>(() => {
    const normalized = normalizeFortressPayload(payload);
    if (!normalized) return null;

    const allPrices = normalized.paths.flat();
    const rawMin = Math.min(...allPrices);
    const rawMax = Math.max(...allPrices);
    const referencePrice = Number.isFinite(currentPrice) ? currentPrice : normalized.paths[0][0];
    const distance = Math.max(Math.abs(rawMax - referencePrice), Math.abs(referencePrice - rawMin), 0.0001);
    const yMin = referencePrice - distance;
    const yMax = referencePrice + distance;
    const steps = Math.max(...normalized.paths.map((path) => path.length - 1));
    const pRawCols = Math.max(...normalized.pRaw.map((row) => row.length));
    const pRawMax = Math.max(
      ...normalized.pRaw.flat().map((value) => (Number.isFinite(value) ? value : 0)),
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

  const xScale = (second: number) => PADDING.left + (Math.max(0, second) / Math.max(1, model?.steps ?? 1)) * plotWidth;
  const yScale = (price: number) => {
    if (!model) return PADDING.top + plotHeight / 2;
    const ratio = (price - model.yMin) / Math.max(1e-9, model.yMax - model.yMin);
    return PADDING.top + (1 - ratio) * plotHeight;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="pointer-events-none max-w-[min(96vw,1120px)] p-0">
        <div className="pointer-events-auto rounded-[16px] border border-border-main bg-background-main p-4">
          <DialogTitle className="text-text-heading text-base font-semibold">
            Fortress MC Diagnostics
          </DialogTitle>
          <DialogDescription className="text-text-sub text-xs">
            Paths are plotted per second. Heatmap cells use 5-second buckets from pRaw.
          </DialogDescription>

          {!model ? (
            <div className="text-text-sub mt-4 rounded-[10px] border border-border-main bg-surface-overlay-subtle p-4 text-sm">
              Waiting for valid `fortress_mc_diagnostics` payload.
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
                <rect x={0} y={0} width={CHART_WIDTH} height={CHART_HEIGHT} fill="transparent" />

                {model.pRaw.map((row, rowIndex) =>
                  row.map((value, colIndex) => {
                    const xStart = colIndex * FORTRESS_MC_GRID_CELL_SECONDS;
                    const xEnd = (colIndex + 1) * FORTRESS_MC_GRID_CELL_SECONDS;
                    const x = xScale(xStart);
                    const width = Math.max(1, xScale(xEnd) - x);
                    const y = PADDING.top + (rowIndex / model.pRawRows) * plotHeight;
                    const height = plotHeight / model.pRawRows;
                    return (
                      <rect
                        key={`cell-${rowIndex}-${colIndex}`}
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={probabilityColor(value, model.pRawMax)}
                        opacity={0.56}
                      />
                    );
                  }),
                )}

                {Array.from({ length: Math.max(2, Math.ceil(model.steps / 5) + 1) }, (_, index) => {
                  const second = Math.min(model.steps, index * 5);
                  const x = xScale(second);
                  return (
                    <line
                      key={`v-grid-${index}`}
                      x1={x}
                      y1={PADDING.top}
                      x2={x}
                      y2={PADDING.top + plotHeight}
                      stroke="rgba(148,163,184,0.18)"
                    />
                  );
                })}

                {model.paths.map((path, pathIndex) => {
                  const d = path
                    .map((value, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${xScale(pointIndex)} ${yScale(value)}`)
                    .join(" ");
                  return (
                    <path
                      key={`path-${pathIndex}`}
                      d={d}
                      fill="none"
                      stroke="rgba(125,161,201,0.34)"
                      strokeWidth={1.1}
                    />
                  );
                })}

                <line
                  x1={PADDING.left}
                  y1={yScale(currentPrice)}
                  x2={PADDING.left + plotWidth}
                  y2={yScale(currentPrice)}
                  stroke="#ef4444"
                  strokeDasharray="6 5"
                  strokeWidth={1.6}
                />

                <text x={8} y={PADDING.top + 12} fill="var(--color-text-sub)" fontSize={12}>
                  {model.yMax.toFixed(4)}
                </text>
                <text x={8} y={PADDING.top + plotHeight + 2} fill="var(--color-text-sub)" fontSize={12}>
                  {model.yMin.toFixed(4)}
                </text>
                <text
                  x={PADDING.left + plotWidth - 140}
                  y={PADDING.top + plotHeight + 24}
                  fill="var(--color-text-sub)"
                  fontSize={12}
                >
                  time (seconds)
                </text>
              </svg>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
