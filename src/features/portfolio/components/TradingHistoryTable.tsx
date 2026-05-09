"use client";

import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/shadcn/table";
import { useAuth } from "@/src/components/providers/AuthProvider";
import useSolUsdPrice from "@/src/hooks/useSolUsdPrice";
import useWinShareActions from "@/src/hooks/useWinShareActions";
import { TradingShareSheet } from "@/src/features/trade/components/tradingGrid.panels";
import { useOrderControllerGetUserOrders } from "@/src/services/queries";
import {
  formatFixedTwoDecimal,
  formatOneDecimalNumber,
  formatUpToFourDecimalNumber,
} from "@/src/utils/formatters";
import { cn } from "@/lib/utils";

dayjs.extend(relativeTime);

type UnknownRecord = Record<string, unknown>;

interface TradingHistoryItem {
  id: string;
  market: string;
  amountUsd: number | null;
  amountSol: number | null;
  multiplier: number | null;
  pnl: number | null;
  settledWin: boolean | null;
  inProgress: boolean;
  whenLabel: string;
  timestampMs: number;
  currentPrice: number | null;
  targetPrice: number | null;
  createdAtLabel: string;
  progress: number;
}

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

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
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
  return `$${formatFixedTwoDecimal(value)}`;
}

function formatSol(value: number | null): string {
  if (value === null) return "-- SOL";
  return `${formatUpToFourDecimalNumber(value)} SOL`;
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

function formatPercent(value: number): string {
  return `${formatOneDecimalNumber(value)}%`;
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
  const placedQuotePriceUsd = asNumber(record.placedQuotePriceUsd);
  const amountBetWld =
    asNumber(record.amount) ??
    asNumber(record.amountSol) ??
    asNumber(record.tokenAmount) ??
    asNumber(record.size) ??
    asNumber(record.quantity) ??
    null;
  const amountUsd =
    asNumber(record.amountUsd) ??
    asNumber(record.totalAmount) ??
    asNumber(record.stakeAmount) ??
    (amountBetWld !== null && placedQuotePriceUsd !== null
      ? amountBetWld * placedQuotePriceUsd
      : null) ??
    null;
  const amountSol = amountBetWld;
  const multiplier =
    asNumber(record.multiplier) ??
    asNumber(record.rewardRate) ??
    asNumber(cell?.rewardRate) ??
    null;

  const status = asString(record.status)?.toUpperCase();
  const inProgress = status === "OPEN";
  const settledWin =
    asBoolean(record.settledWin) ??
    asBoolean(record.isWin) ??
    asBoolean(record.win) ??
    asBoolean(record.isWinning) ??
    asBoolean(record.won) ??
    (status === "WIN" ||
    status === "WON" ||
    status === "SETTLED_WIN" ||
    status === "CLOSED_WIN"
      ? true
      : status === "LOSE" ||
          status === "LOST" ||
          status === "FAILED" ||
          status === "FAIL" ||
          status === "LOSS"
        ? false
        : null);

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
    status === "FAIL" ||
    status === "LOSS";
  const statusIsWin =
    status === "WIN" ||
    status === "WON" ||
    status === "SETTLED_WIN" ||
    status === "CLOSED_WIN";

  const pnl =
    directPnl ??
    (settledWin === false && amountUsd !== null
      ? -Math.abs(amountUsd)
      : settledWin === true
        ? fallbackPnl
        : statusIsLose && amountUsd !== null
          ? -Math.abs(amountUsd)
          : statusIsWin
            ? fallbackPnl
            : null);

  const timestampMs =
    readTimestampMs(record.placeAt) ??
    readTimestampMs(record.placedAt) ??
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
    "SOL/USDT";

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
    amountSol,
    multiplier,
    pnl,
    settledWin,
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

function isWinRow(item: TradingHistoryItem): boolean {
  if (item.settledWin === false) return false;
  if (item.settledWin === true) return true;
  return !item.inProgress && item.pnl !== null && item.pnl > 0;
}

const TradingHistoryTable = () => {
  const { isAuthenticated, isLoggingIn, username, walletAddress } = useAuth();
  const { data: solUsdPrice } = useSolUsdPrice(isAuthenticated && !isLoggingIn);
  const { isSharing, shareUrl, copyShareLink, share } = useWinShareActions({
    username,
    walletAddress,
  });
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [shareItemId, setShareItemId] = useState<string | null>(null);

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
      .map((item) => {
        if (!solUsdPrice || solUsdPrice <= 0) {
          return item;
        }

        let resolved = item;

        if (item.amountUsd === null && item.amountSol !== null) {
          resolved = { ...resolved, amountUsd: item.amountSol * solUsdPrice };
        } else if (item.amountUsd !== null) {
          resolved = { ...resolved, amountSol: item.amountUsd / solUsdPrice };
        }

        // Recalculate pnl now that amountUsd is resolved
        if (
          resolved.pnl === null &&
          resolved.amountUsd !== null &&
          !resolved.inProgress
        ) {
          if (resolved.settledWin === false) {
            resolved = { ...resolved, pnl: -Math.abs(resolved.amountUsd) };
          } else if (
            resolved.settledWin === true &&
            resolved.multiplier !== null
          ) {
            resolved = {
              ...resolved,
              pnl: resolved.amountUsd * Math.max(resolved.multiplier - 1, 0),
            };
          }
        }

        return resolved;
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [data, solUsdPrice]);

  const emptyState = !isLoading && items.length === 0;
  const selectedShareItem = useMemo(
    () => items.find((item) => item.id === shareItemId) ?? null,
    [items, shareItemId],
  );
  const selectedShareMultiplier = selectedShareItem?.multiplier ?? 1;
  const selectedShareAmountUsd = selectedShareItem?.amountUsd ?? 0;
  const selectedShareProfit = Math.max(selectedShareItem?.pnl ?? 0, 0);
  const settledItems = useMemo(
    () => items.filter((item) => !item.inProgress && item.pnl !== null),
    [items],
  );
  const shareWinRate = useMemo(() => {
    if (settledItems.length === 0) return null;
    const wins = settledItems.filter(isWinRow).length;
    return formatPercent((wins / settledItems.length) * 100);
  }, [settledItems]);
  const selectedShareRoi = useMemo(() => {
    if (!selectedShareItem || selectedShareAmountUsd <= 0) return null;
    const pnl = selectedShareItem.pnl;
    if (pnl === null) return null;
    return formatPercent((pnl / selectedShareAmountUsd) * 100);
  }, [selectedShareAmountUsd, selectedShareItem]);

  const handleOpenShareSheet = (itemId: string) => {
    setShareItemId(itemId);
    setIsShareSheetOpen(true);
  };

  return (
    <div className="bg-background-surface border-border-main relative z-10 overflow-hidden rounded-[12px] border">
      <div className="border-border-main flex items-center justify-between border-b px-5 py-4">
        <h3 className="text-text-main text-[18px] font-semibold tracking-[-0.02em]">
          Trading History
        </h3>
        {!isLoading && items.length > 0 && (
          <span className="text-hint bg-surface-overlay-subtle rounded-full px-2.5 py-0.5 text-[12px] font-medium">
            {items.length} trades
          </span>
        )}
      </div>
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
        <Table className="text-text-main w-full table-fixed border-collapse">
          <TableHeader className="border-border-main sticky top-0 z-10 border-b">
            <TableRow className="bg-background-surface border-border-main hover:bg-background-surface">
              <TableHead className="text-hint w-[150px] px-5 py-3 text-[11px] font-medium tracking-[0.04em] uppercase">
                Size
              </TableHead>
              <TableHead className="text-hint w-[80px] px-4 py-3 text-[11px] font-medium tracking-[0.04em] uppercase">
                Mult
              </TableHead>
              <TableHead className="text-hint w-[140px] px-4 py-3 text-[11px] font-medium tracking-[0.04em] uppercase">
                PNL
              </TableHead>
              <TableHead className="text-hint bg-background-surface w-[160px] px-4 py-3 text-[11px] font-medium tracking-[0.04em] whitespace-nowrap uppercase">
                When
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-border-main hover:bg-background-main">
                <TableCell
                  colSpan={4}
                  className="text-hint px-5 py-10 text-center text-[14px]"
                >
                  Loading trading history...
                </TableCell>
              </TableRow>
            ) : null}

            {emptyState ? (
              <TableRow className="border-border-main hover:bg-background-main">
                <TableCell
                  colSpan={4}
                  className="text-hint px-5 py-10 text-center text-[14px]"
                >
                  No trading records yet.
                </TableCell>
              </TableRow>
            ) : null}

            {items.map((item) => {
              return (
                <FragmentRow
                  key={item.id}
                  item={item}
                  onShare={handleOpenShareSheet}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TradingShareSheet
        isOpen={isShareSheetOpen}
        onClose={() => setIsShareSheetOpen(false)}
        marketSymbol={selectedShareItem?.market ?? ""}
        selectedShareCell={
          selectedShareItem ? { multiplier: selectedShareMultiplier } : null
        }
        selectedShareAmountUsd={selectedShareAmountUsd}
        selectedShareTime={selectedShareItem?.createdAtLabel ?? ""}
        selectedShareProfitUsd={selectedShareProfit}
        shareUrl={shareUrl}
        copyShareLink={copyShareLink}
        isSharing={isSharing}
        share={share}
        shareWinRate={shareWinRate}
        selectedShareRoi={selectedShareRoi}
      />
    </div>
  );
};

interface FragmentRowProps {
  item: TradingHistoryItem;
  onShare: (itemId: string) => void;
}

const FragmentRow = ({ item, onShare }: FragmentRowProps) => {
  const canShareWin = isWinRow(item);
  const isWin = isWinRow(item);
  const isLoss = !item.inProgress && item.settledWin === false;

  return (
    <TableRow
      className={cn(
        "group border-b transition-colors",
        "border-border-main bg-background-main hover:bg-surface-overlay-subtle",
        isWin && "border-l-success-medium border-l-2",
        isLoss && "border-l-warning-medium border-l-2",
        item.inProgress && "border-l-primary-light border-l-2",
        !isWin &&
          !isLoss &&
          !item.inProgress &&
          "border-l-2 border-l-transparent",
      )}
    >
      <TableCell className="px-5 py-3">
        <p className="text-text-main text-[14px] font-semibold">
          {formatMoney(item.amountUsd)}
        </p>
        <p className="text-hint mt-0.5 text-[11px] font-medium tracking-[0.02em] uppercase">
          {formatSol(item.amountSol)}
        </p>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <span className="bg-surface-overlay-subtle text-text-sub rounded-full px-2 py-0.5 text-[13px] font-medium">
          {formatMultiplier(item.multiplier)}
        </span>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "min-w-0 truncate text-[14px] font-semibold",
              item.inProgress
                ? "text-primary-light"
                : item.pnl !== null && item.pnl >= 0
                  ? "text-success-medium"
                  : "text-warning-medium",
            )}
          >
            {pnlText(item)}
          </p>
          {canShareWin ? (
            <button
              type="button"
              className="bg-background-main/90 border-border-main text-grid-accent hover:bg-surface-overlay-subtle flex h-7 min-h-7 w-7 min-w-7 shrink-0 items-center justify-center rounded-full border p-0 opacity-100 transition-opacity"
              onClick={(event) => {
                event.stopPropagation();
                onShare(item.id);
              }}
              aria-label="Share winning row"
            >
              <Share2 className="size-3.5 shrink-0" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-text-sub bg-background-main group-hover:bg-surface-overlay-subtle w-[160px] px-4 py-3 align-middle text-[13px] font-normal whitespace-nowrap">
        {item.whenLabel}
      </TableCell>
    </TableRow>
  );
};

export default TradingHistoryTable;
