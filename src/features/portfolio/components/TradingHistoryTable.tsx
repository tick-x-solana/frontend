"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Progress from "@/src/components/common/Progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/shadcn/table";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { useOrderControllerGetUserOrders } from "@/src/services/queries";
import { cn } from "@/lib/utils";

dayjs.extend(relativeTime);

type UnknownRecord = Record<string, unknown>;

interface TradingHistoryItem {
  id: string;
  market: string;
  amountUsd: number | null;
  amountWld: number | null;
  multiplier: number | null;
  pnl: number | null;
  inProgress: boolean;
  whenLabel: string;
  timestampMs: number;
  currentPrice: number | null;
  targetPrice: number | null;
  createdAtLabel: string;
  progress: number;
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readTimestampMs(value: unknown): number | null {
  const numeric = asNumber(value);
  if (numeric !== null) {
    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }

  if (typeof value === "string") {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.valueOf() : null;
  }

  return null;
}

function formatMoney(value: number | null): string {
  if (value === null) return "--";
  return `$${moneyFormatter.format(value)}`;
}

function formatWld(value: number | null): string {
  if (value === null) return "-- WLD";
  return `${compactFormatter.format(value)} WLD`;
}

function formatMultiplier(value: number | null): string {
  if (value === null) return "--";
  return `${value.toFixed(1)}x`;
}

function formatRelativeTime(timestampMs: number): string {
  return dayjs(timestampMs).fromNow();
}

function formatClockTime(timestampMs: number): string {
  return dayjs(timestampMs).format("hh:mm:ss A");
}

function extractOrders(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  const record = asRecord(value);
  if (!record) return [];

  if (Array.isArray(record.orders)) return record.orders;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;

  const nestedData = asRecord(record.data);
  if (!nestedData) return [];

  if (Array.isArray(nestedData.orders)) return nestedData.orders;
  if (Array.isArray(nestedData.items)) return nestedData.items;
  if (Array.isArray(nestedData.results)) return nestedData.results;

  return [];
}

function toHistoryItem(order: unknown): TradingHistoryItem | null {
  const record = asRecord(order);
  if (!record) return null;

  const cell = asRecord(record.cell);
  const amountUsd =
    asNumber(record.amountUsd) ??
    asNumber(record.amount) ??
    asNumber(record.totalAmount) ??
    asNumber(record.stakeAmount) ??
    null;
  const amountWld =
    asNumber(record.amountWld) ??
    asNumber(record.tokenAmount) ??
    asNumber(record.size) ??
    asNumber(record.quantity) ??
    null;
  const multiplier =
    asNumber(record.multiplier) ??
    asNumber(record.rewardRate) ??
    asNumber(cell?.rewardRate) ??
    null;

  const status = asString(record.status)?.toUpperCase();
  const inProgress = status === "OPEN";

  const directPnl =
    asNumber(record.pnl) ??
    asNumber(record.profit) ??
    asNumber(record.rewardAmount) ??
    asNumber(record.settledPnl) ??
    null;

  const fallbackPnl =
    directPnl !== null || amountUsd === null || multiplier === null
      ? null
      : amountUsd * Math.max(multiplier - 1, 0);

  const statusIsLose =
    status === "LOSE" ||
    status === "LOST" ||
    status === "FAILED" ||
    status === "FAIL";
  const statusIsWin = status === "WIN" || status === "WON";

  const pnl =
    directPnl ??
    (statusIsLose && amountUsd !== null
      ? -Math.abs(amountUsd)
      : statusIsWin
        ? fallbackPnl
        : fallbackPnl);

  const timestampMs =
    readTimestampMs(record.createdAt) ??
    readTimestampMs(record.updatedAt) ??
    readTimestampMs(record.timestamp) ??
    readTimestampMs(record.ts) ??
    readTimestampMs(record.startTs) ??
    readTimestampMs(cell?.startTs) ??
    Date.now();
  const whenTimestampMs =
    readTimestampMs(record.settleAt) ??
    readTimestampMs(record.settledAt) ??
    readTimestampMs(record.cellTimeEnd) ??
    readTimestampMs(record.endTs) ??
    readTimestampMs(cell?.endTs) ??
    timestampMs;

  const market =
    asString(record.marketSymbol) ??
    asString(record.pair) ??
    asString(record.symbol) ??
    (asString(record.baseAsset) && asString(record.quoteAsset)
      ? `${asString(record.baseAsset)}/${asString(record.quoteAsset)}`
      : null) ??
    "WLD/USD";

  const currentPrice =
    asNumber(record.currentPrice) ?? asNumber(record.entryPrice) ?? null;
  const targetPrice =
    asNumber(record.targetPrice) ??
    asNumber(record.takeProfitPrice) ??
    asNumber(cell?.upperPrice) ??
    null;

  const startMs =
    readTimestampMs(record.cellTimeStart) ??
    readTimestampMs(record.startTs) ??
    readTimestampMs(cell?.startTs);
  const endMs =
    readTimestampMs(record.cellTimeEnd) ??
    readTimestampMs(record.endTs) ??
    readTimestampMs(cell?.endTs);
  const progress =
    startMs === null || endMs === null || endMs <= startMs
      ? 0.5
      : Math.min(1, Math.max(0, (Date.now() - startMs) / (endMs - startMs)));

  return {
    id:
      asString(record.orderId) ??
      asString(record.id) ??
      `${market}-${timestampMs}-${amountUsd ?? 0}`,
    market,
    amountUsd,
    amountWld,
    multiplier,
    pnl,
    inProgress,
    whenLabel: formatRelativeTime(whenTimestampMs),
    timestampMs,
    currentPrice,
    targetPrice,
    createdAtLabel: formatClockTime(timestampMs),
    progress,
  };
}

function pnlText(item: TradingHistoryItem): string {
  if (item.inProgress) return "In Progress";
  if (item.pnl === null) return "--";
  if (item.pnl > 0) return `+${formatMoney(item.pnl)}`;
  return formatMoney(item.pnl);
}

const TradingHistoryTable = () => {
  const { isAuthenticated, isLoggingIn } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useOrderControllerGetUserOrders<unknown>(
    {
      limit: 50,
      offset: 0,
    },
    {
      query: {
        enabled: isAuthenticated && !isLoggingIn,
        staleTime: 10_000,
        refetchOnWindowFocus: true,
      },
    },
  );

  const items = useMemo(() => {
    return extractOrders(data)
      .map(toHistoryItem)
      .filter((item): item is TradingHistoryItem => item !== null)
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [data]);

  const emptyState = !isLoading && items.length === 0;

  return (
    <div className="bg-background-surface border-border-main relative z-10 overflow-hidden rounded-[8px] border">
      <div className="px-4 py-6">
        <h3 className="text-text-main text-[20px] font-semibold">
          Trading History
        </h3>
      </div>
      <Table className="text-text-main w-full table-fixed border-collapse">
        <TableHeader className="border-border-main border-y">
          <TableRow className="bg-surface-overlay-subtle border-border-main hover:bg-surface-overlay-subtle">
            <TableHead className="text-text-sub w-[140px] px-4 py-3 text-[14px] font-normal">
              Size
            </TableHead>
            <TableHead className="text-text-sub w-[70px] px-4 py-3 text-[14px] font-normal">
              Mult
            </TableHead>
            <TableHead className="text-text-sub w-[90px] px-4 py-3 text-[14px] font-normal">
              PNL
            </TableHead>
            <TableHead className="text-text-sub px-4 py-3 text-[14px] font-normal">
              When
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="border-border-main hover:bg-background-main">
              <TableCell
                colSpan={4}
                className="text-hint px-4 py-6 text-center text-[14px]"
              >
                Loading trading history...
              </TableCell>
            </TableRow>
          ) : null}

          {emptyState ? (
            <TableRow className="border-border-main hover:bg-background-main">
              <TableCell
                colSpan={4}
                className="text-hint px-4 py-6 text-center text-[14px]"
              >
                No trading records yet.
              </TableCell>
            </TableRow>
          ) : null}

          {items.map((item) => {
            const isExpanded = expandedId === item.id;

            return (
              <FragmentRow
                key={item.id}
                item={item}
                isExpanded={isExpanded}
                onToggle={() => setExpandedId(isExpanded ? null : item.id)}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

interface FragmentRowProps {
  item: TradingHistoryItem;
  isExpanded: boolean;
  onToggle: () => void;
}

const FragmentRow = ({ item, isExpanded, onToggle }: FragmentRowProps) => {
  return (
    <>
      <TableRow
        className={cn(
          "border-border-main bg-background-main hover:bg-surface-overlay-subtle cursor-pointer border-b border-l-2",
          isExpanded
            ? "bg-background-surface border-l-success-medium"
            : "border-l-success-medium",
        )}
        onClick={onToggle}
      >
        <TableCell className="px-4 py-2">
          <p className="text-text-main text-[14px] font-semibold">
            {formatMoney(item.amountUsd)}
          </p>
          <p className="text-hint text-[12px] font-semibold uppercase">
            {formatWld(item.amountWld)}
          </p>
        </TableCell>
        <TableCell className="px-4 py-2 align-middle">
          <p className="text-success-light text-[14px] font-normal">
            {formatMultiplier(item.multiplier)}
          </p>
        </TableCell>
        <TableCell className="px-4 py-2 align-middle">
          <p
            className={cn(
              "text-[14px] font-medium",
              item.inProgress
                ? "text-text-main"
                : item.pnl !== null && item.pnl >= 0
                  ? "text-success-medium"
                  : "text-warning-medium",
            )}
          >
            {pnlText(item)}
          </p>
        </TableCell>
        <TableCell className="text-text-sub px-4 py-2 align-middle text-[14px] font-normal">
          {item.whenLabel}
        </TableCell>
      </TableRow>

      {isExpanded ? (
        <TableRow className="bg-background-surface border-border-main hover:bg-background-surface">
          <TableCell colSpan={4} className="p-0">
            <div className="bg-background-surface border-border-main flex flex-col gap-3 border-b px-4 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-text-main text-[18px] font-semibold">
                      {item.market}
                    </p>
                    <span className="bg-surface-overlay-strong text-text-sub rounded-[6px] px-1.5 py-[3px] text-[12px] font-semibold uppercase">
                      {item.createdAtLabel}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-text-main flex items-center gap-1 text-[14px] font-medium underline"
                >
                  Details
                  <ArrowUpRight className="size-4" />
                </button>
              </div>

              <div className="border-border-main border-t" />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-text-sub text-[14px] font-medium">
                    Current:{" "}
                    <span className="text-text-main font-mono text-[14px] font-bold">
                      {formatMoney(item.currentPrice)}
                    </span>
                  </p>
                  <p className="text-text-sub text-[14px] font-medium">
                    Target Price:{" "}
                    <span className="text-text-main font-mono text-[14px] font-bold">
                      {formatMoney(item.targetPrice)}
                    </span>
                  </p>
                </div>
                <Progress value={item.progress} />
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
};

export default TradingHistoryTable;
