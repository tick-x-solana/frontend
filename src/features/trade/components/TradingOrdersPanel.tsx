"use client";

import { useMemo } from "react";
import { useAuth } from "@/src/components/providers/AuthProvider";
import {
  RECENT_ORDERS_INLINE_MAX_HEIGHT,
  RECENT_ORDERS_SHEET_MAX_HEIGHT,
  USER_ORDERS_FETCH_LIMIT,
  USER_ORDERS_LOOKBACK_MS,
} from "@/src/constants";
import { useGameStore } from "@/src/features/trade/store";
import { useOrderControllerGetUserOrders } from "@/src/services/queries";
import {
  formatCompactNumber,
  formatFixedTwoDecimal,
  formatUsdCurrencyFixedTwo,
} from "@/src/utils/formatters";
import useSolUsdPrice from "@/src/hooks/useSolUsdPrice";
import { cn } from "@/lib/utils";

type TradingOrdersPanelProps = {
  className?: string;
  fallbackMarketLabel?: string;
  inline?: boolean;
  queryAnchorTime: number | null;
  showHeader?: boolean;
};

type UnknownRecord = Record<string, unknown>;

type RecentUserOrderItem = {
  id: string;
  marketLabel: string;
  placedAtMs: number;
  bidAmountWld: number | null;
  valueUsd: number | null;
  multiple: number | null;
  statusLabel: string;
  statusClassName: string;
};

const orderTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
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
  if (typeof value !== "string") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function readTimestampMs(value: unknown): number | null {
  const numericValue = asNumber(value);
  return numericValue !== null ? numericValue : null;
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

function normalizeMarketLabel(
  value: string | null,
  fallbackMarketLabel: string,
): string {
  if (!value) return fallbackMarketLabel;
  if (value.endsWith("USDT")) {
    return `${value.slice(0, -4)}/USD`;
  }
  return value;
}

function getStatusPresentation(order: UnknownRecord) {
  const status = asString(order.status)?.toUpperCase();
  const settledWin = asBoolean(order.settledWin);

  if (status === "SETTLED" && settledWin === true) {
    return {
      label: "Won",
      className:
        "border-success-border bg-success-background text-success-medium",
    };
  }

  if (status === "SETTLED" && settledWin === false) {
    return {
      label: "Lost",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }

  if (status === "OPEN") {
    return {
      label: "Open",
      className: "border-border-primary bg-surface-selected text-primary-light",
    };
  }

  if (status === "REJECTED") {
    return {
      label: "Rejected",
      className: "border-border-main bg-surface-overlay-subtle text-text-sub",
    };
  }

  if (status === "CANCELLED") {
    return {
      label: "Cancelled",
      className: "border-border-main bg-surface-overlay-subtle text-text-sub",
    };
  }

  return {
    label: status
      ? `${status.charAt(0)}${status.slice(1).toLowerCase()}`
      : "Recent",
    className: "border-border-main bg-surface-overlay-subtle text-text-sub",
  };
}

function resolveAmountWld(record: UnknownRecord): number | null {
  return (
    asNumber(record.amount) ??
    asNumber(record.amountSol) ??
    asNumber(record.tokenAmount) ??
    asNumber(record.size) ??
    asNumber(record.quantity) ??
    null
  );
}

function resolveStakeAmountUsd(
  record: UnknownRecord,
  amountWld: number | null,
): number | null {
  const placedQuotePriceUsd = asNumber(record.placedQuotePriceUsd);
  return (
    asNumber(record.amountUsd) ??
    asNumber(record.totalAmount) ??
    asNumber(record.stakeAmount) ??
    (amountWld !== null && placedQuotePriceUsd !== null
      ? amountWld * placedQuotePriceUsd
      : null) ??
    null
  );
}

function resolveMultiple(record: UnknownRecord): number | null {
  const cell = asRecord(record.cell);
  return (
    asNumber(record.multiplier) ??
    asNumber(record.rewardRate) ??
    asNumber(record.settledRewardRate) ??
    asNumber(cell?.rewardRate) ??
    null
  );
}

function resolveSettledWin(record: UnknownRecord): boolean | null {
  const status = asString(record.status)?.toUpperCase() ?? null;
  const inferredFromStatus =
    status === "WIN" ||
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
        : null;

  return (
    asBoolean(record.settledWin) ??
    asBoolean(record.isWin) ??
    asBoolean(record.win) ??
    asBoolean(record.isWinning) ??
    asBoolean(record.won) ??
    inferredFromStatus
  );
}

function resolveDirectPnl(record: UnknownRecord): number | null {
  return (
    asNumber(record.pnl) ??
    asNumber(record.profit) ??
    asNumber(record.rewardAmount) ??
    asNumber(record.settledPnl) ??
    null
  );
}

function resolveValueUsd(params: {
  record: UnknownRecord;
  settledWin: boolean | null;
  stakeAmountUsd: number | null;
  multiple: number | null;
  solUsdPrice: number | null;
}): number | null {
  const { record, settledWin, stakeAmountUsd, multiple, solUsdPrice } = params;
  const directPnl = resolveDirectPnl(record);
  const settledPayoutSol = asNumber(record.settledPayout);
  const settledPayoutUsd =
    settledPayoutSol !== null &&
    solUsdPrice !== null &&
    Number.isFinite(solUsdPrice) &&
    solUsdPrice > 0
      ? settledPayoutSol * solUsdPrice
      : null;
  const fallbackProfitUsd =
    stakeAmountUsd !== null && multiple !== null
      ? stakeAmountUsd * Math.max(multiple - 1, 0)
      : null;
  const settledPayoutSignedUsd =
    settledPayoutUsd === null
      ? null
      : settledWin === false
        ? -Math.abs(settledPayoutUsd)
        : settledPayoutUsd;

  return (
    settledPayoutSignedUsd ??
    directPnl ??
    (settledWin === false && stakeAmountUsd !== null
      ? -Math.abs(stakeAmountUsd)
      : settledWin === true
        ? fallbackProfitUsd
        : null)
  );
}

function toRecentUserOrderItem(
  value: unknown,
  fallbackMarketLabel: string,
  solUsdPrice: number | null,
): RecentUserOrderItem | null {
  const record = asRecord(value);
  if (!record) return null;

  const amountWld = resolveAmountWld(record);
  const stakeAmountUsd = resolveStakeAmountUsd(record, amountWld);
  const multiple = resolveMultiple(record);
  const settledWin = resolveSettledWin(record);
  const valueUsd = resolveValueUsd({
    record,
    settledWin,
    stakeAmountUsd,
    multiple,
    solUsdPrice,
  });
  const placedAtMs =
    readTimestampMs(record.placedAt) ??
    readTimestampMs(record.createdAt) ??
    readTimestampMs(record.cellTimeStart) ??
    Date.now();
  const marketLabel = normalizeMarketLabel(
    asString(record.marketId) ?? asString(record.marketSymbol),
    fallbackMarketLabel,
  );
  const statusPresentation = getStatusPresentation(record);

  return {
    id:
      asString(record.orderId) ??
      asString(record.id) ??
      `${marketLabel}-${placedAtMs}`,
    marketLabel,
    placedAtMs,
    bidAmountWld: amountWld,
    valueUsd,
    multiple,
    statusLabel: statusPresentation.label,
    statusClassName: statusPresentation.className,
  };
}

function formatBidAmountWld(value: number | null): string {
  if (value === null) return "-- SOL";
  return `${formatCompactNumber(value)}`;
}

function formatSignedUsd(value: number | null): string {
  if (value === null) return "--";
  const absValue = Math.abs(value);
  const formattedAmount = formatUsdCurrencyFixedTwo(absValue);
  if (value > 0) return `+${formattedAmount}`;
  if (value < 0) return `-${formattedAmount}`;
  return formattedAmount;
}

function formatMultiple(value: number | null): string {
  if (value === null) return "--";
  return `${formatFixedTwoDecimal(value)}x`;
}

export default function TradingOrdersPanel({
  className,
  fallbackMarketLabel = "SOL/USDT",
  inline = false,
  queryAnchorTime,
  showHeader = true,
}: TradingOrdersPanelProps) {
  const { isAuthenticated, isLoggingIn } = useAuth();
  const recentOrderUpdates = useGameStore((s) => s.recentOrderUpdates);
  const { data: solUsdPriceRaw } = useSolUsdPrice();
  const solUsdPrice =
    typeof solUsdPriceRaw === "number" && Number.isFinite(solUsdPriceRaw)
      ? solUsdPriceRaw
      : null;
  const queryParams = useMemo(
    () =>
      queryAnchorTime === null
        ? undefined
        : {
            limit: USER_ORDERS_FETCH_LIMIT,
            offset: 0,
            fromTime: Math.max(0, queryAnchorTime - USER_ORDERS_LOOKBACK_MS),
            toTime: queryAnchorTime,
          },
    [queryAnchorTime],
  );
  const { data, error, isFetching } = useOrderControllerGetUserOrders<unknown>(
    queryParams,
    {
      query: {
        enabled:
          isAuthenticated &&
          !isLoggingIn &&
          queryAnchorTime !== null &&
          queryParams !== undefined,
        staleTime: 5_000,
        refetchOnWindowFocus: true,
      },
    },
  );

  const orders = useMemo(() => {
    const mergedOrders = [...recentOrderUpdates, ...extractOrders(data)];
    return mergedOrders
      .map((item) =>
        toRecentUserOrderItem(item, fallbackMarketLabel, solUsdPrice),
      )
      .filter((item): item is RecentUserOrderItem => item !== null)
      .sort((a, b) => b.placedAtMs - a.placedAtMs)
      .filter(
        (item, index, arr) =>
          arr.findIndex((entry) => entry.id === item.id) === index,
      )
      .slice(0, USER_ORDERS_FETCH_LIMIT);
  }, [data, fallbackMarketLabel, recentOrderUpdates, solUsdPrice]);

  const emptyMessage = !isAuthenticated
    ? "Sign in to view your latest orders."
    : "No recent orders found in the last 5 seconds.";
  const containerClassName = inline
    ? "border-border-main/70 flex flex-col gap-3 border-t pt-4"
    : "border-border-main bg-background-surface flex flex-col gap-3 rounded-[10px] border p-3";
  const emptyStateClassName = inline
    ? "text-text-sub flex min-h-20 items-center justify-center rounded-[8px] bg-surface-overlay-subtle px-4 text-center text-sm font-medium tracking-[-0.01em]"
    : "text-text-sub flex min-h-24 items-center justify-center rounded-[8px] border border-dashed border-white/10 px-4 text-center text-sm font-medium tracking-[-0.01em]";
  const loadingStateClassName = inline
    ? "text-text-sub flex min-h-20 items-center justify-center rounded-[8px] bg-surface-overlay-subtle px-4 text-sm font-medium tracking-[-0.01em]"
    : "text-text-sub flex min-h-24 items-center justify-center rounded-[8px] border border-dashed border-white/10 px-4 text-sm font-medium tracking-[-0.01em]";
  const errorStateClassName = inline
    ? "text-destructive flex min-h-20 items-center justify-center rounded-[8px] bg-destructive/10 px-4 text-center text-sm font-medium tracking-[-0.01em]"
    : "text-destructive flex min-h-24 items-center justify-center rounded-[8px] border border-dashed border-destructive/30 px-4 text-center text-sm font-medium tracking-[-0.01em]";
  const listClassName = inline
    ? "flex min-h-0 flex-col gap-2 overflow-y-auto pr-1"
    : "flex min-h-0 flex-col gap-3 overflow-y-auto pr-1";
  const cardClassName = inline
    ? "border-border-main/70 bg-surface-overlay-subtle rounded-[8px] border p-3"
    : "border-border-main bg-background-main rounded-[12px] border p-4";
  const listMaxHeight = inline
    ? RECENT_ORDERS_INLINE_MAX_HEIGHT
    : RECENT_ORDERS_SHEET_MAX_HEIGHT;

  return (
    <section className={cn(containerClassName, className)}>
      {showHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-text-heading text-sm font-semibold tracking-[-0.01em]">
              Recent Orders
            </p>
            <p
              className={cn(
                "text-text-sub text-xs font-medium tracking-[-0.01em]",
                inline && "max-w-[220px]",
              )}
            >
              Showing up to {USER_ORDERS_FETCH_LIMIT} orders from the last 5
              seconds.
            </p>
          </div>
        </div>
      ) : null}

      {isFetching ? (
        <div className={loadingStateClassName}>
          Loading your recent orders...
        </div>
      ) : error ? (
        <div className={errorStateClassName}>Failed to load recent orders.</div>
      ) : orders.length === 0 ? (
        <div className={emptyStateClassName}>{emptyMessage}</div>
      ) : (
        <div className={listClassName} style={{ maxHeight: listMaxHeight }}>
          {orders.map((order) => (
            <article key={order.id} className={cardClassName}>
              <div
                className={cn(
                  "mb-3 flex items-start justify-between gap-3",
                  !inline && "mb-0 items-center",
                )}
              >
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-text-heading truncate text-sm font-semibold tracking-[-0.01em]",
                      !inline && "text-base",
                    )}
                  >
                    {order.marketLabel}
                  </p>
                  <p className="text-text-sub text-xs font-medium tracking-[-0.01em]">
                    {orderTimeFormatter.format(order.placedAtMs)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-1 text-[11px] font-semibold tracking-[-0.01em]",
                    !inline && "px-3 py-1.5 text-xs",
                    order.statusClassName,
                  )}
                >
                  {order.statusLabel}
                </span>
              </div>

              <div
                className={cn(
                  !inline && "border-border-main/70 mt-3 border-t pt-3",
                )}
              >
                <div
                  className={cn("grid grid-cols-3 gap-2", !inline && "gap-2.5")}
                >
                  <div
                    className={cn(
                      "bg-surface-overlay-subtle rounded-[8px] px-2.5 py-2",
                      !inline && "rounded-[10px] px-3 py-2.5",
                    )}
                  >
                    <p className="text-hint text-[11px] font-semibold tracking-[-0.01em] uppercase">
                      Bid Size
                    </p>
                    <p
                      className={cn(
                        "text-text-heading mt-1 text-sm font-semibold tracking-[-0.01em]",
                        !inline && "text-[15px]",
                      )}
                    >
                      {formatBidAmountWld(order.bidAmountWld)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "bg-surface-overlay-subtle rounded-[8px] px-2.5 py-2",
                      !inline && "rounded-[10px] px-3 py-2.5",
                    )}
                  >
                    <p className="text-hint text-[11px] font-semibold tracking-[-0.01em] uppercase">
                      Value
                    </p>
                    <p
                      className={cn(
                        "text-text-heading mt-1 text-sm font-semibold tracking-[-0.01em]",
                        !inline && "text-[15px]",
                        order.valueUsd !== null &&
                          order.valueUsd > 0 &&
                          "text-success-medium",
                        order.valueUsd !== null &&
                          order.valueUsd < 0 &&
                          "text-destructive",
                      )}
                    >
                      {formatSignedUsd(order.valueUsd)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "bg-surface-overlay-subtle rounded-[8px] px-2.5 py-2",
                      !inline && "rounded-[10px] px-3 py-2.5",
                    )}
                  >
                    <p className="text-hint text-[11px] font-semibold tracking-[-0.01em] uppercase">
                      Multiple
                    </p>
                    <p
                      className={cn(
                        "text-text-heading mt-1 text-sm font-semibold tracking-[-0.01em]",
                        !inline && "text-[15px]",
                      )}
                    >
                      {formatMultiple(order.multiple)}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
