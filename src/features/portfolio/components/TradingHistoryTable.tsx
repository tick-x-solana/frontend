"use client";

import { useMemo, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Sheet } from "react-modal-sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/shadcn/table";
import { Button } from "@/src/components/shadcn/button";
import { useAuth } from "@/src/components/providers/AuthProvider";
import useWldUsdPrice from "@/src/hooks/useWldUsdPrice";
import useWinShareActions from "@/src/hooks/useWinShareActions";
import { WinShareCard } from "@/src/features/trade/components/WinShareCard";
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
  settledWin: boolean | null;
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

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const percentageFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
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
  return `$${moneyFormatter.format(value)}`;
}

function formatWld(value: number | null): string {
  if (value === null) return "-- WLD";
  return `${integerFormatter.format(Math.round(value))} WLD`;
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
  return `${percentageFormatter.format(value)}%`;
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
  const settledWin =
    asBoolean(record.settledWin) ??
    asBoolean(record.isWin) ??
    asBoolean(record.win) ??
    null;

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
    "BTC/USD";

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
  const { data: wldUsdPrice } = useWldUsdPrice(isAuthenticated && !isLoggingIn);
  const { isSharing, shareUrl, copyShareLink, share, shareToWorldChat } =
    useWinShareActions({ username, walletAddress });
  console.log("shareUrl: ", shareUrl);
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
        if (item.amountUsd === null || !wldUsdPrice || wldUsdPrice <= 0) {
          return item;
        }

        return {
          ...item,
          amountWld: item.amountUsd / wldUsdPrice,
        };
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [data, wldUsdPrice]);

  const emptyState = !isLoading && items.length === 0;
  const selectedShareItem = useMemo(
    () => items.find((item) => item.id === shareItemId) ?? null,
    [items, shareItemId],
  );
  const selectedShareMultiplier = selectedShareItem?.multiplier ?? 1;
  const selectedShareAmount = selectedShareItem?.amountUsd ?? 0;
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
    if (!selectedShareItem || selectedShareAmount <= 0) return null;
    const pnl = selectedShareItem.pnl;
    if (pnl === null) return null;
    return formatPercent((pnl / selectedShareAmount) * 100);
  }, [selectedShareAmount, selectedShareItem]);

  const handleOpenShareSheet = (itemId: string) => {
    setShareItemId(itemId);
    setIsShareSheetOpen(true);
  };

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
            <TableHead className="text-text-sub w-[130px] px-4 py-3 text-[14px] font-normal">
              PNL
            </TableHead>
            <TableHead className="text-text-sub bg-surface-overlay-subtle w-[170px] px-4 py-3 text-[14px] font-normal whitespace-nowrap">
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

      <Sheet
        isOpen={isShareSheetOpen}
        onClose={() => setIsShareSheetOpen(false)}
        detent="content"
        unstyled
      >
        <Sheet.Backdrop
          onTap={() => setIsShareSheetOpen(false)}
          className="bg-background-main/55 backdrop-blur-[2px]"
        />
        <Sheet.Container className="pointer-events-none">
          <Sheet.Content
            disableDrag={false}
            className="bg-background-main border-border-main pointer-events-auto rounded-t-[16px] border-t"
          >
            {selectedShareItem ? (
              <div className="mx-auto w-full max-w-[400px]">
                <WinShareCard
                  marketSymbol={selectedShareItem.market}
                  multiplier={selectedShareMultiplier}
                  amount={selectedShareAmount}
                  openedAt={selectedShareItem.createdAtLabel}
                  profit={selectedShareProfit}
                />
                <div className="px-5 pb-5">
                  <div className="flex flex-col gap-4">
                    <p className="text-hint text-sm font-medium tracking-[-0.01em]">
                      Share your win
                    </p>
                    <div className="bg-surface-overlay rounded-[8px] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <p className="text-text-heading min-w-0 flex-1 truncate text-sm font-medium tracking-[-0.01em]">
                          {shareUrl}
                        </p>
                        <button
                          type="button"
                          className="text-text-sub hover:text-text-heading flex size-5 items-center justify-center"
                          onClick={copyShareLink}
                          aria-label="Copy share link"
                        >
                          <Copy className="size-4" strokeWidth={1.9} />
                        </button>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="bg-primary-medium text-text-inverse hover:bg-primary-light h-11 rounded-[8px] text-base font-medium tracking-[-0.01em]"
                      onClick={share}
                      disabled={isSharing}
                    >
                      <Share2 className="mr-2 size-4" strokeWidth={1.9} />
                      {isSharing ? "Sharing..." : "Share"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-primary-light text-text-heading hover:bg-surface-overlay-subtle h-11 rounded-[8px] bg-transparent text-base font-medium tracking-[-0.01em]"
                      onClick={() =>
                        void shareToWorldChat({
                          metrics: {
                            winRate: shareWinRate,
                            pnl:
                              selectedShareProfit > 0
                                ? `+${formatMoney(selectedShareProfit)}`
                                : formatMoney(selectedShareProfit),
                            roi: selectedShareRoi,
                          },
                        })
                      }
                    >
                      <Share2 className="mr-2 size-4" strokeWidth={1.9} />
                      WorldChat
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </Sheet.Content>
        </Sheet.Container>
      </Sheet>
    </div>
  );
};

interface FragmentRowProps {
  item: TradingHistoryItem;
  onShare: (itemId: string) => void;
}

const FragmentRow = ({ item, onShare }: FragmentRowProps) => {
  const canShareWin = isWinRow(item);

  return (
    <TableRow className="border-border-main bg-background-main hover:bg-surface-overlay-subtle group border-l-success-medium border-b border-l-2">
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
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "min-w-0 truncate text-[14px] font-medium",
              item.inProgress
                ? "text-text-main"
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
              className="bg-background-main/90 border-border-main text-grid-accent hover:bg-surface-overlay-subtle flex h-7 min-h-7 w-7 min-w-7 shrink-0 items-center justify-center rounded-full border p-0"
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
      <TableCell className="text-text-sub bg-background-main group-hover:bg-surface-overlay-subtle w-[170px] px-4 py-2 align-middle text-[14px] font-normal whitespace-nowrap">
        {item.whenLabel}
      </TableCell>
    </TableRow>
  );
};

export default TradingHistoryTable;
