"use client";

/**
 * TradingGrid — canvas-based price grid with zoom/pan and click-to-bet.
 *
 * Architecture:
 *   src/utils/gridLayout.ts   — coordinate-transform math (computeLayout, hitTestCell)
 *   src/utils/canvasDraw.ts   — all canvas rendering routines (pure functions)
 *   src/hooks/useGridInteraction.ts — mouse / touch / wheel handlers
 *   TradingGrid.tsx           — React wiring: store selectors, rAF loop, resize observer
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WalletIcon } from "@/src/assets/icons";
import { Button } from "@/src/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/shadcn/dialog";
import { cn } from "@/lib/utils";
import {
  Copy,
  Eye,
  Info,
  LocateFixed,
  Rocket,
  Share2,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import { Sheet } from "react-modal-sheet";
import { io } from "socket.io-client";
import { useAccount } from "wagmi";
import { MiniKit } from "@worldcoin/minikit-js";
import { useAuth } from "@/src/components/providers/AuthProvider";
import OverlayModePanel from "@/src/features/trade/components/OverlayModePanel";
import TradeControlsPanel from "@/src/features/trade/components/TradeControlsPanel";
import { WinShareCard } from "@/src/features/trade/components/WinShareCard";
import {
  extractFollowedOrderActivities,
  extractOrderFollowings,
  extractWssKey,
} from "@/src/features/trade/orderFollow";
import { getLatestChartTime } from "@/src/features/trade/gridTiming";
import type { CellData, RemoteCell } from "@/src/features/trade/store";
import { BACKEND_URL } from "@/src/features/trade/constant";
import { useGameStore } from "@/src/features/trade/store";
import { appToast } from "@/src/features/trade/toast";
import {
  authControllerGetWssKey,
  authControllerGetChallenge,
  getOrderFollowControllerListFollowingQueryKey,
  useAccountControllerGetBalance,
  useAuthControllerGetWssKey,
  useOrderControllerGetUserOrders,
  useOrderFollowControllerListFollowing,
  useOrderFollowControllerRegister,
} from "@/src/services/queries";
import { signWssMessage } from "@/src/features/trade/socketSignature";
import {
  computeLayout,
  hitTestAnyCell,
  hitTestCell,
} from "@/src/utils/gridLayout";
import type { Transform, StoreSnapshot } from "@/src/utils/gridLayout";
import { computeGridDimensions } from "@/src/utils/gridDimensions";
import {
  COLOR_BG,
  drawBackgroundGrid,
  drawBetCells,
  drawPriceLine,
  drawPriceAxis,
  drawTimeAxis,
  drawZoomIndicator,
} from "@/src/utils/canvasDraw";
import { useGridInteraction } from "@/src/hooks/useGridInteraction";
import useWinShareActions from "@/src/hooks/useWinShareActions";
import { getAddress } from "viem";
import { BetWinEffect } from "./BetWinEffect";

// ─── Constants ────────────────────────────────────────────────────────────────

const DESKTOP_ZOOM_MIN = 0.5;
const MOBILE_ZOOM_MIN = 1;
const MIN_PRICE_MOTION_MS = 250;
const MAX_PRICE_MOTION_MS = 5000;
const TICK_CADENCE_SMOOTHING = 0.2;
const LARGE_MOVE_STEPS_START = 2;
const LARGE_MOVE_STEPS_FULL = 12;
const LARGE_MOVE_DURATION_FACTOR_MIN = 0.38;
const RESIZE_COMMIT_DEBOUNCE_MS = 180;
const FOLLOW_OVERLAY_SOCKET_UPDATE_MIN_INTERVAL_MS = 250;
const SUGGESTED_STRATEGY_MIN_HOLD_MS = 3000;
const FOLLOW_ORDER_EVENTS = [
  "order_follow",
  "order_follow_update",
  "order_follows",
  "follow_order_placed",
  "place_bet",
] as const;
const SUBSCRIBE_USER_EVENT = "subscribe_user";
const FOLLOWED_ORDER_UPDATE_EVENT = "followed_order_update";
const ORDER_UPDATE_EVENT = "order_update";
const BALANCE_UPDATE_EVENT = "balance_update";
const SUBSCRIBE_ORDER_FOLLOWS_EVENT = "subscribe_order_follows";
const UNSUBSCRIBE_ORDER_FOLLOWS_EVENT = "unsubscribe_order_follows";
const SUBSCRIBE_SUGGESTED_STRATEGY_EVENT = "subscribe_suggested_strategy";
const SUGGESTED_STRATEGY_UPDATE_EVENT = "suggested_strategy_update";
const livePriceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const balanceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const shareTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});
const winAmountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentageFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const FAKE_WIN_TOAST_MIN_DELAY_MS = 5000;
const FAKE_WIN_TOAST_MAX_DELAY_MS = 20000;
const FAKE_WIN_TOAST_VISIBLE_MS = 1000;
const WIN_EFFECT_VISIBLE_MS = 2000;
const WIN_EFFECT_AMOUNTS_VISIBLE_MS = 1300;
const FAKE_WIN_USERNAME_PREFIXES = [
  "lion",
  "tiger",
  "eagle",
  "wolf",
  "shark",
  "falcon",
  "phoenix",
  "panther",
  "cobra",
  "rhino",
] as const;
const MARKET_SYMBOL = "BTC/USD";
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const BINANCE_HISTORY_URL =
  "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1s&limit=600";
type ShareOverlayTarget = {
  cellId: string;
  left: number;
  top: number;
  centerLeft: number;
  centerTop: number;
  cellEdge: number;
  buttonSize: number;
  isHumanVerified: boolean;
  totalPayout: number;
  basePayout: number;
  bonusPayout: number;
};
type ActiveWinEffectState = {
  startedAt: number;
  showTotal: boolean;
};
type FakeWinToastData = {
  username: string;
  amount: number;
};
type FollowOverlayActivity = ReturnType<
  typeof extractFollowedOrderActivities
>[number];
type SuggestedStrategyMessage = {
  cells: Array<{
    startTs: number;
    endTs: number;
    lowerPrice: string;
    upperPrice: string;
    rewardRate: string;
  }>;
  volatilityRegime: "low" | "medium" | "high";
  sigma: number | null;
  atrMean: number | null;
  timestamp: number;
};

type GridActionButtonProps = React.ComponentProps<typeof Button> & {
  active?: boolean;
};

function GridActionButton({
  active = false,
  className,
  children,
  ...props
}: GridActionButtonProps) {
  return (
    <Button
      type="button"
      size="icon-lg"
      variant="ghost"
      className={cn(
        "border-border-main bg-background-surface text-text-sub hover:bg-surface-control pointer-events-auto h-9 w-9 rounded-[4px] border p-0 shadow-none hover:text-white",
        active &&
          "border-grid-accent bg-surface-control-active text-grid-accent hover:bg-surface-control-active hover:text-grid-accent",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

function formatPercent(value: number) {
  return `${percentageFormatter.format(value)}%`;
}

function easeOutCubic(progress: number): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return 1 - (1 - clampedProgress) ** 3;
}

type BalanceChipProps = {
  balance: number;
};

function BalanceChip({ balance }: BalanceChipProps) {
  const safeBalance = Number.isFinite(balance) ? balance : 0;

  return (
    <div className="bg-surface-overlay-subtle border-border-main inline-flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5 backdrop-blur-[4px]">
      <span className="text-primary-light flex size-5 items-center justify-center">
        <WalletIcon className="size-3.5" aria-hidden="true" />
      </span>
      <p className="text-primary-light text-center text-xs font-bold tracking-[-0.01em] whitespace-nowrap">
        {balanceFormatter.format(safeBalance)}
      </p>
    </div>
  );
}

function extractChallenge(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;

  const record = response as Record<string, unknown>;
  const challenge =
    record.challenge ??
    (record.data &&
    typeof record.data === "object" &&
    !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>).challenge
      : null);

  return typeof challenge === "string" && challenge.trim().length > 0
    ? challenge
    : null;
}

function extractBalanceAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return (
    extractBalanceAmount(record.balance) ??
    extractBalanceAmount(record.free) ??
    extractBalanceAmount(record.amount) ??
    extractBalanceAmount(record.availableBalance) ??
    extractBalanceAmount(record.data)
  );
}

function extractBalanceUserId(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const directUserId = record.userId ?? record.userAddress ?? record.address;

  if (typeof directUserId === "string" && directUserId.trim().length > 0) {
    return directUserId.trim();
  }

  return extractBalanceUserId(record.data);
}

function parseAddress(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  try {
    return getAddress(trimmed);
  } catch {
    return null;
  }
}

function formatWalletShort(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeReferralCode(
  value: string | null | undefined,
): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTimestampToMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
  }

  return null;
}

function normalizePriceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizePriceString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  return null;
}

function extractSuggestedStrategyCellIds(
  payload: unknown,
  currentCells: CellData[],
): string[] | null {
  const payloadRecord =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  const rawCells = Array.isArray(payloadRecord?.cells)
    ? payloadRecord.cells
    : Array.isArray(payload)
      ? payload
      : [];

  const cellIds = new Set<string>();
  let parseFailureCount = 0;
  rawCells.forEach((rawCell) => {
    if (!rawCell || typeof rawCell !== "object" || Array.isArray(rawCell)) {
      return;
    }

    const cell = rawCell as Record<string, unknown>;
    const startTs = normalizeTimestampToMs(cell.startTs);
    const endTs = normalizeTimestampToMs(cell.endTs);
    const lowerPrice = normalizePriceString(cell.lowerPrice);
    const upperPrice = normalizePriceString(cell.upperPrice);
    const lowerPriceNumber = normalizePriceNumber(cell.lowerPrice);
    const upperPriceNumber = normalizePriceNumber(cell.upperPrice);

    if (
      startTs === null ||
      endTs === null ||
      lowerPrice === null ||
      upperPrice === null ||
      lowerPriceNumber === null ||
      upperPriceNumber === null
    ) {
      parseFailureCount += 1;
      return;
    }

    const matchedGridCell = currentCells.find((gridCell) => {
      if (
        gridCell.timeWindowStart !== startTs ||
        gridCell.timeWindowEnd !== endTs
      ) {
        return false;
      }

      const gridLower = normalizePriceNumber(gridCell.original.lowerPrice);
      const gridUpper = normalizePriceNumber(gridCell.original.upperPrice);
      if (gridLower === null || gridUpper === null) return false;

      return (
        Math.abs(gridLower - lowerPriceNumber) < 1e-8 &&
        Math.abs(gridUpper - upperPriceNumber) < 1e-8
      );
    });

    if (matchedGridCell) {
      cellIds.add(matchedGridCell.id);
      return;
    }

    cellIds.add(`${startTs}:${endTs}:${lowerPrice}:${upperPrice}`);
  });

  if (rawCells.length > 0 && cellIds.size === 0 && parseFailureCount > 0) {
    return null;
  }

  return [...cellIds];
}

function extractCellTimeRangeFromCellId(cellId: string): {
  startTs: number;
  endTs: number;
} | null {
  const [rawStartTs, rawEndTs] = cellId.split(":");
  const startTs = Number(rawStartTs);
  const endTs = Number(rawEndTs);
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
    return null;
  }
  return { startTs, endTs };
}

function extractCellIdentityFromCellId(cellId: string): {
  startTs: number;
  endTs: number;
  lowerPrice: number;
  upperPrice: number;
} | null {
  const parts = cellId.split(":");
  if (parts.length < 4) return null;

  const startTs = normalizeTimestampToMs(parts[parts.length - 4]);
  const endTs = normalizeTimestampToMs(parts[parts.length - 3]);
  const lowerPrice = normalizePriceNumber(parts[parts.length - 2]);
  const upperPrice = normalizePriceNumber(parts[parts.length - 1]);

  if (
    startTs === null ||
    endTs === null ||
    lowerPrice === null ||
    upperPrice === null
  ) {
    return null;
  }

  return {
    startTs,
    endTs,
    lowerPrice,
    upperPrice,
  };
}

function resolveGridCellIdFromActivityCellId(
  rawCellId: string | null,
  currentCells: CellData[],
): string | null {
  if (!rawCellId) return null;
  const trimmedCellId = rawCellId.trim();
  if (!trimmedCellId) return null;

  const exactMatch = currentCells.find((cell) => cell.id === trimmedCellId);
  if (exactMatch) return exactMatch.id;

  const identity = extractCellIdentityFromCellId(trimmedCellId);
  if (!identity) return null;

  const fuzzyMatch = currentCells.find((cell) => {
    if (
      cell.timeWindowStart !== identity.startTs ||
      cell.timeWindowEnd !== identity.endTs
    ) {
      return false;
    }

    const gridLower = normalizePriceNumber(cell.original.lowerPrice);
    const gridUpper = normalizePriceNumber(cell.original.upperPrice);
    if (gridLower === null || gridUpper === null) return false;

    return (
      Math.abs(gridLower - identity.lowerPrice) < 1e-8 &&
      Math.abs(gridUpper - identity.upperPrice) < 1e-8
    );
  });

  return fuzzyMatch?.id ?? null;
}

function isCellIdStillAheadOfChart(cellId: string, chartTime: number): boolean {
  const range = extractCellTimeRangeFromCellId(cellId);
  if (!range) return true;
  return range.endTs > chartTime;
}

function extractUserOrders(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.orders)) return record.orders;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;

  if (
    record.data &&
    typeof record.data === "object" &&
    !Array.isArray(record.data)
  ) {
    const nested = record.data as Record<string, unknown>;
    if (Array.isArray(nested.orders)) return nested.orders;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.results)) return nested.results;
  }

  return [];
}

function buildDisplayHistory(
  history: StoreSnapshot["history"],
  now: number,
  displayPrice: number,
): StoreSnapshot["history"] {
  if (history.length === 0 || !Number.isFinite(displayPrice)) return history;

  const lastPoint = history[history.length - 1];
  const displayTime = Math.max(now, lastPoint.time);

  if (
    displayTime === lastPoint.time &&
    Math.abs(displayPrice - lastPoint.price) < 1e-6
  ) {
    return history;
  }

  return [...history, { time: displayTime, price: displayPrice }];
}

function extractBinanceKlineHistory(value: unknown): StoreSnapshot["history"] {
  if (!Array.isArray(value)) return [];

  const points: StoreSnapshot["history"] = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length < 5) continue;

    const openTimeRaw = row[0];
    const closePriceRaw = row[4];
    const time =
      typeof openTimeRaw === "number"
        ? openTimeRaw
        : Number.parseInt(String(openTimeRaw), 10);
    const price = Number(closePriceRaw);

    if (!Number.isFinite(time) || !Number.isFinite(price) || time <= 0)
      continue;
    points.push({ time, price });
  }

  if (points.length < 2) return points;
  points.sort((a, b) => a.time - b.time);
  return points;
}

function randomInt(minInclusive: number, maxInclusive: number): number {
  const min = Math.ceil(minInclusive);
  const max = Math.floor(maxInclusive);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildRandomFakeUsername(): string {
  const prefix =
    FAKE_WIN_USERNAME_PREFIXES[
      randomInt(0, FAKE_WIN_USERNAME_PREFIXES.length - 1)
    ];
  const suffix = randomInt(10, 99);
  return `${prefix}${suffix}`;
}

function buildFakeWinToastData(): FakeWinToastData {
  const isLowerRange = Math.random() < 0.8;
  const minAmount = isLowerRange ? 2 : 50;
  const maxAmount = isLowerRange ? 50 : 70;
  const amount = Number(
    (Math.random() * (maxAmount - minAmount) + minAmount).toFixed(2),
  );

  return {
    username: buildRandomFakeUsername(),
    amount,
  };
}

function WinBetBanner({ data }: { data: FakeWinToastData }) {
  return (
    <div className="pumpfun-jitter bg-background-main/95 border-success-border flex max-w-[min(88vw,360px)] items-center gap-2 rounded-[12px] border px-2 py-1.5 shadow-[0_0_0_1px_rgb(17_211_68_/_0.12)_inset,0_8px_20px_rgb(3_9_16_/_0.42)]">
      <div className="bg-surface-overlay-medium border-border-main flex size-8 shrink-0 items-center justify-center rounded-[9px] border">
        <Rocket aria-hidden className="text-grid-accent size-4" />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <span className="text-text-heading truncate text-[14px] font-semibold tracking-[-0.01em]">
            {data.username}
          </span>
          <Image
            src="/onboarding/verified-badge.svg"
            alt="Verified human"
            width={16}
            height={16}
            className="h-4 w-4 shrink-0"
          />
        </div>
        <span className="bg-success-background text-success-light border-success-border rounded-[9px] border px-1.5 py-0.5 text-xs font-bold tracking-[-0.01em]">
          WIN
        </span>
      </div>

      <span className="pumpfun-flicker text-success-medium text-[14px] font-semibold tracking-[-0.02em] whitespace-nowrap">
        +${winAmountFormatter.format(data.amount)}
      </span>
    </div>
  );
}
// ─── Component ────────────────────────────────────────────────────────────────

type TradingGridProps = {
  initialFollowRefCode?: string | null;
};

export const TradingGrid: React.FC<TradingGridProps> = ({
  initialFollowRefCode = null,
}) => {
  const queryClient = useQueryClient();
  // ── Store selectors ────────────────────────────────────────────────────────
  const cells = useGameStore((s) => s.cells);
  const history = useGameStore((s) => s.history);
  const basePrice = useGameStore((s) => s.basePrice);
  const currentPrice = useGameStore((s) => s.currentPrice);
  const modePriceStep = useGameStore((s) => s.modePriceStep);
  const modeIntervalSeconds = useGameStore((s) => s.modeIntervalSeconds);
  const placeBet = useGameStore((s) => s.placeBet);
  const bets = useGameStore((s) => s.bets);
  const pendingBets = useGameStore((s) => s.pendingBets);
  const pendingWins = useGameStore((s) => s.pendingWins);
  const settledOutcomes = useGameStore((s) => s.settledOutcomes);
  const socket = useGameStore((s) => s.socket);
  const wssKey = useGameStore((s) => s.wssKey);
  const followedOrderActivities = useGameStore(
    (s) => s.followedOrderActivities,
  );
  const setConnection = useGameStore((s) => s.setConnection);
  const setWssKey = useGameStore((s) => s.setWssKey);
  const upsertFollowedOrderActivity = useGameStore(
    (s) => s.upsertFollowedOrderActivity,
  );
  const updatePrice = useGameStore((s) => s.updatePrice);
  const hydrateHistory = useGameStore((s) => s.hydrateHistory);
  const updateGrid = useGameStore((s) => s.updateGrid);
  const updateOrder = useGameStore((s) => s.updateOrder);
  const betAmount = useGameStore((s) => s.betAmount);
  const balance = useGameStore((s) => s.balance);
  const serverTimeOffset = useGameStore((s) => s.serverTimeOffset);
  const { address } = useAccount();
  const { isAuthenticated, isLoggingIn, username, walletAddress } = useAuth();
  const isMiniApp = MiniKit.isInWorldApp();
  const miniKitWalletAddress = isMiniApp
    ? (MiniKit.user?.walletAddress ?? null)
    : null;
  const resolvedUserAddress = useMemo(
    () =>
      parseAddress(miniKitWalletAddress ?? walletAddress ?? address ?? null),
    [address, miniKitWalletAddress, walletAddress],
  );
  const { data: wssKeyResponse } = useAuthControllerGetWssKey({
    query: {
      enabled: isAuthenticated && !isLoggingIn,
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  });
  const {
    data: followingResponse,
    refetch: refetchFollowing,
    isFetching: isFollowingFetching,
  } = useOrderFollowControllerListFollowing({
    query: {
      enabled: false,
      staleTime: 10_000,
      refetchOnWindowFocus: true,
    },
  });
  const { mutateAsync: registerOrderFollow } =
    useOrderFollowControllerRegister();
  const { data: userOrdersResponse } = useOrderControllerGetUserOrders(
    {
      limit: 200,
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
  const { data: balanceResponse } = useAccountControllerGetBalance({
    query: {
      enabled: isAuthenticated && !isLoggingIn,
      staleTime: 10_000,
      refetchOnWindowFocus: true,
    },
  });

  const resolvedWssKey = extractWssKey(wssKeyResponse);
  const activeFollowings = useMemo(
    () =>
      extractOrderFollowings(followingResponse).filter((item) => {
        const normalizedStatus = item.status?.trim().toUpperCase();
        return (
          normalizedStatus === undefined ||
          normalizedStatus.length === 0 ||
          normalizedStatus === "ACTIVE"
        );
      }),
    [followingResponse],
  );
  const availableFollowTargets = useMemo(() => {
    const deduped = new Map<
      string,
      { targetUserId: string; targetUsername: string | null }
    >();

    activeFollowings.forEach((item) => {
      const targetUserId = parseAddress(item.targetUserId);
      if (!targetUserId || deduped.has(targetUserId)) return;

      deduped.set(targetUserId, {
        targetUserId,
        targetUsername:
          typeof item.targetUsername === "string" &&
          item.targetUsername.trim().length > 0
            ? item.targetUsername.trim()
            : null,
      });
    });

    return [...deduped.values()];
  }, [activeFollowings]);

  const availableFollowTargetIds = useMemo(
    () => availableFollowTargets.map((item) => item.targetUserId),
    [availableFollowTargets],
  );
  const activeFollowingTargetIds = useMemo(
    () => new Set(availableFollowTargetIds),
    [availableFollowTargetIds],
  );
  // ── Refs ───────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canvasInstanceKey, setCanvasInstanceKey] = useState(0);

  // Live values kept in refs to avoid re-triggering the rAF loop
  const initialIsMobile =
    typeof window !== "undefined" ? window.innerWidth < 640 : false;
  const initialMinZoom = initialIsMobile ? MOBILE_ZOOM_MIN : DESKTOP_ZOOM_MIN;
  const nowRef = useRef(0);
  const cameraPriceRef = useRef(currentPrice || 0);
  const isMobileRef = useRef(initialIsMobile);
  const sizeRef = useRef({ w: 0, h: 0 });
  const getMinZoom = useCallback(
    () => (isMobileRef.current ? MOBILE_ZOOM_MIN : DESKTOP_ZOOM_MIN),
    [],
  );
  const transformRef = useRef<Transform>({
    offsetX: 0,
    offsetY: 0,
    zoom: initialMinZoom,
  });
  const priceMotionRef = useRef<{
    startPrice: number;
    targetPrice: number;
    startTime: number;
    durationMs: number;
  } | null>(null);
  const tickCadenceMsRef = useRef(1000);
  const lastHistoryPointRef = useRef<{
    time: number;
    price: number;
  } | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const rafRef = useRef<number>(0);
  const previousWinningCellIdsRef = useRef<Set<string>>(new Set());
  const previewCellIdRef = useRef<string | null>(null);
  const syncCanvasSize = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const { w, h } = sizeRef.current;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }, []);
  const handleCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node;
      syncCanvasSize(node);

      if (node) {
        drawRef.current();
      }
    },
    [syncCanvasSize],
  );

  // Mirror store into a ref so rAF reads the latest data without deps changes
  const storeRef = useRef<StoreSnapshot>({
    cells,
    history,
    bets,
    pendingBets,
    pendingWins,
    settledOutcomes,
    basePrice,
    modePriceStep,
    modeIntervalSeconds,
    betAmount,
    balance,
    socket,
    wssKey,
    address: resolvedUserAddress,
    followedOrderActivities,
    suggestedStrategyCellIds: [],
    dims: null,
  });
  useEffect(() => {
    // Recompute dims only when cells change — avoids Map/sort allocation every frame.
    const prevCells = storeRef.current.cells;
    const nextDims =
      cells !== prevCells
        ? computeGridDimensions(
            cells.map((c) => ({
              ...c.original,
              startTs: c.timeWindowStart,
              endTs: c.timeWindowEnd,
            })),
          )
        : storeRef.current.dims;
    storeRef.current = {
      cells,
      history,
      bets,
      pendingBets,
      pendingWins,
      settledOutcomes,
      basePrice,
      modePriceStep,
      modeIntervalSeconds,
      betAmount,
      balance,
      socket,
      wssKey,
      address: resolvedUserAddress,
      followedOrderActivities,
      suggestedStrategyCellIds: storeRef.current.suggestedStrategyCellIds,
      dims: nextDims,
    };
  });

  const [suggestedStrategyEnabled, setSuggestedStrategyEnabled] =
    useState(false);
  const [suggestedStrategyEnabledDraft, setSuggestedStrategyEnabledDraft] =
    useState(false);
  const [followTradeEnabled, setFollowTradeEnabled] = useState(false);
  const [followTradeEnabledDraft, setFollowTradeEnabledDraft] = useState(false);
  const [followTradeTargetEnabled, setFollowTradeTargetEnabled] = useState<
    Record<string, boolean>
  >({});
  const [followTradeTargetEnabledDraft, setFollowTradeTargetEnabledDraft] =
    useState<Record<string, boolean>>({});
  const [suggestedStrategyCellIds, setSuggestedStrategyCellIds] = useState<
    string[]
  >([]);
  const [isOverlaySheetOpen, setIsOverlaySheetOpen] = useState(false);
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
  const [shareOverlayTargets, setShareOverlayTargets] = useState<
    ShareOverlayTarget[]
  >([]);
  const [activeWinEffectByCellId, setActiveWinEffectByCellId] = useState<
    Record<string, ActiveWinEffectState>
  >({});
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [shareCellId, setShareCellId] = useState<string | null>(null);
  const [dismissedFollowReferralCode, setDismissedFollowReferralCode] =
    useState<string | null>(null);
  const [resolvedFollowTarget, setResolvedFollowTarget] = useState<{
    refCode: string;
    wallet: string | null;
  } | null>(null);
  const [isSubmittingFollowReferral, setIsSubmittingFollowReferral] =
    useState(false);
  const { isSharing, shareUrl, copyShareLink, share, shareToWorldChat } =
    useWinShareActions({
      username,
      walletAddress,
      resolvedUserAddress,
    });
  const shareTargetsRef = useRef<ShareOverlayTarget[]>([]);
  const shareTargetIdsHashRef = useRef("");
  const lastFollowOverlayUpdateAtRef = useRef(0);
  const lastSuggestedStrategyUpdateAtRef = useRef(0);
  const followOverlayPendingActivitiesRef = useRef<
    FollowOverlayActivity[] | null
  >(null);
  const followOverlayFlushTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const suggestedStrategyPendingCellIdsRef = useRef<string[] | null>(null);
  const suggestedStrategyFlushTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const suggestedStrategyCellIdsRef = useRef<string[]>([]);
  const winEffectCleanupTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const winEffectPhaseTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const shareOverlayButtonRefs = useRef(
    new Map<string, HTMLButtonElement | null>(),
  );
  const winEffectIconRefs = useRef(new Map<string, HTMLDivElement | null>());

  const isFollowTradeVisible = followTradeEnabled;
  const isSuggestedStrategyVisible = suggestedStrategyEnabled;
  const isFollowTradeConfigVisibleDraft =
    isOverlaySheetOpen && followTradeEnabledDraft;
  const [fakeWinToastData, setFakeWinToastData] =
    useState<FakeWinToastData | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let nextToastTimerId: ReturnType<typeof setTimeout> | null = null;
    let hideToastTimerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextToast = () => {
      if (isCancelled) return;

      nextToastTimerId = setTimeout(
        () => {
          if (isCancelled) return;

          setFakeWinToastData(buildFakeWinToastData());
          if (hideToastTimerId) {
            clearTimeout(hideToastTimerId);
          }
          hideToastTimerId = setTimeout(() => {
            if (isCancelled) return;
            setFakeWinToastData(null);
          }, FAKE_WIN_TOAST_VISIBLE_MS);

          scheduleNextToast();
        },
        randomInt(FAKE_WIN_TOAST_MIN_DELAY_MS, FAKE_WIN_TOAST_MAX_DELAY_MS),
      );
    };

    scheduleNextToast();

    return () => {
      isCancelled = true;
      if (nextToastTimerId) clearTimeout(nextToastTimerId);
      if (hideToastTimerId) clearTimeout(hideToastTimerId);
    };
  }, []);

  const enabledFollowTargetIds = useMemo(
    () =>
      availableFollowTargetIds.filter(
        (targetUserId) => followTradeTargetEnabled[targetUserId] ?? true,
      ),
    [availableFollowTargetIds, followTradeTargetEnabled],
  );
  const enabledFollowTargetsKey = useMemo(
    () => enabledFollowTargetIds.slice().sort().join("|"),
    [enabledFollowTargetIds],
  );
  const enabledFollowTargetIdsSet = useMemo(
    () => new Set(enabledFollowTargetIds),
    [enabledFollowTargetIds],
  );
  const activeWinEffectCellIdSet = useMemo(
    () => new Set(Object.keys(activeWinEffectByCellId)),
    [activeWinEffectByCellId],
  );
  const ensureFollowTargetConfig = useCallback(
    (source: Record<string, boolean>) => {
      const nextConfig: Record<string, boolean> = {};
      availableFollowTargetIds.forEach((targetUserId) => {
        nextConfig[targetUserId] = source[targetUserId] ?? true;
      });
      return nextConfig;
    },
    [availableFollowTargetIds],
  );
  const followTradeTargetsDraft = useMemo(
    () =>
      availableFollowTargets.map((target) => ({
        id: target.targetUserId,
        label: target.targetUsername ?? formatWalletShort(target.targetUserId),
        subtitle: formatWalletShort(target.targetUserId),
        enabled: followTradeTargetEnabledDraft[target.targetUserId] ?? true,
      })),
    [availableFollowTargets, followTradeTargetEnabledDraft],
  );
  const normalizedInitialFollowRefCode = useMemo(
    () => normalizeReferralCode(initialFollowRefCode),
    [initialFollowRefCode],
  );
  const followReferralCode = useMemo(() => {
    if (!normalizedInitialFollowRefCode) return null;
    if (dismissedFollowReferralCode === normalizedInitialFollowRefCode) {
      return null;
    }
    return normalizedInitialFollowRefCode;
  }, [dismissedFollowReferralCode, normalizedInitialFollowRefCode]);
  const isFollowReferralModalOpen = followReferralCode !== null;
  const resolvedFollowTargetWallet =
    followReferralCode && resolvedFollowTarget?.refCode === followReferralCode
      ? resolvedFollowTarget.wallet
      : null;
  const isFollowReferralAlreadyActive = useMemo(() => {
    if (!resolvedFollowTargetWallet) return false;
    return activeFollowingTargetIds.has(resolvedFollowTargetWallet);
  }, [activeFollowingTargetIds, resolvedFollowTargetWallet]);
  const followReferralHandle = useMemo(() => {
    if (!followReferralCode) return null;
    const normalized = followReferralCode.trim().replace(/^@/, "");
    return normalized.length > 0 ? normalized : null;
  }, [followReferralCode]);
  const followReferralStats = useMemo(
    () => [
      {
        label: "Win rate",
        value: "68%",
        color: "text-success-medium",
      },
      {
        label: "ROI",
        value: "+24.5%",
        color: "text-text-heading",
      },
      {
        label: "7D PnL",
        value: "+343.5",
        color: "text-text-heading",
      },
    ],
    [
      availableFollowTargets.length,
      followReferralHandle,
      isFollowReferralAlreadyActive,
    ],
  );

  const resolveFollowTargetWallet = useCallback(async (refCode: string) => {
    const normalized = refCode.trim().replace(/^@/, "");
    if (!normalized) {
      throw new Error("Missing referral code");
    }
    if (EVM_ADDRESS_REGEX.test(normalized)) {
      return getAddress(normalized);
    }

    const user = await MiniKit.getUserByUsername(normalized);
    if (!user.walletAddress || !EVM_ADDRESS_REGEX.test(user.walletAddress)) {
      throw new Error("Cannot resolve target wallet from referral code");
    }
    return getAddress(user.walletAddress);
  }, []);

  const handleCloseFollowReferralModal = useCallback(() => {
    if (isSubmittingFollowReferral) return;
    if (!followReferralCode) return;
    setDismissedFollowReferralCode(followReferralCode);
  }, [followReferralCode, isSubmittingFollowReferral]);

  const handleFollowReferralModalOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      handleCloseFollowReferralModal();
    },
    [handleCloseFollowReferralModal],
  );

  const handleFollowByReferral = useCallback(async () => {
    if (!followReferralCode) return;
    if (!isAuthenticated || isLoggingIn) {
      appToast.error("Please sign in before starting follow trade.", {
        icon: "⚠️",
      });
      return;
    }

    setIsSubmittingFollowReferral(true);
    try {
      // TODO
      const targetUserId = "0xD49f9f4A840F0a7cCb8173729Fa9d82dBAF427f4";

      // const targetUserId =
      //   resolvedFollowTargetWallet ??
      //   (await resolveFollowTargetWallet("0xD49f9f4A840F0a7cCb8173729Fa9d82dBAF427f4"));

      if (activeFollowingTargetIds.has(targetUserId)) {
        setFollowTradeEnabled(true);
        setFollowTradeEnabledDraft(true);
        setFollowTradeTargetEnabled((prev) => ({
          ...prev,
          [targetUserId]: true,
        }));
        setFollowTradeTargetEnabledDraft((prev) => ({
          ...prev,
          [targetUserId]: true,
        }));
        appToast.info("You are already following this trader.", {
          icon: "ℹ️",
        });
        handleCloseFollowReferralModal();
        return;
      }

      await registerOrderFollow({
        data: { targetUserId },
      });

      await queryClient.invalidateQueries({
        queryKey: getOrderFollowControllerListFollowingQueryKey(),
      });
      await refetchFollowing();

      setFollowTradeEnabled(true);
      setFollowTradeEnabledDraft(true);
      setFollowTradeTargetEnabled((prev) => ({
        ...prev,
        [targetUserId]: true,
      }));
      setFollowTradeTargetEnabledDraft((prev) => ({
        ...prev,
        [targetUserId]: true,
      }));
      appToast.success("Follow trade started successfully.", {
        icon: "✅",
      });
      handleCloseFollowReferralModal();
    } catch (error) {
      console.error("[TradingGrid] Failed to follow by referral", {
        followReferralCode,
        error,
      });
      appToast.error("Unable to start follow trade. Please try again.", {
        icon: "⚠️",
      });
    } finally {
      setIsSubmittingFollowReferral(false);
    }
  }, [
    activeFollowingTargetIds,
    followReferralCode,
    handleCloseFollowReferralModal,
    isAuthenticated,
    isLoggingIn,
    queryClient,
    refetchFollowing,
    registerOrderFollow,
  ]);

  useEffect(() => {
    if (!followReferralCode) {
      return;
    }

    let cancelled = false;
    const resolve = async () => {
      try {
        const wallet = await resolveFollowTargetWallet(followReferralCode);
        if (!cancelled) {
          setResolvedFollowTarget({
            refCode: followReferralCode,
            wallet,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setResolvedFollowTarget({
            refCode: followReferralCode,
            wallet: null,
          });
        }
        console.warn("[TradingGrid] Failed to resolve follow referral target", {
          followReferralCode,
          error,
        });
      }
    };

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [followReferralCode, resolveFollowTargetWallet]);

  useEffect(() => {
    storeRef.current.suggestedStrategyCellIds = isSuggestedStrategyVisible
      ? suggestedStrategyCellIds
      : [];
  }, [isSuggestedStrategyVisible, suggestedStrategyCellIds]);

  useEffect(() => {
    if (!isSuggestedStrategyVisible || suggestedStrategyCellIds.length === 0) {
      return;
    }

    const chartTime = getLatestChartTime(history, nowRef.current);
    const visibleCellIds = suggestedStrategyCellIds.filter((cellId) =>
      isCellIdStillAheadOfChart(cellId, chartTime),
    );

    if (visibleCellIds.length !== suggestedStrategyCellIds.length) {
      suggestedStrategyCellIdsRef.current = visibleCellIds;
      setSuggestedStrategyCellIds(visibleCellIds);
    }
  }, [history, isSuggestedStrategyVisible, suggestedStrategyCellIds]);

  useEffect(() => {
    suggestedStrategyCellIdsRef.current = suggestedStrategyCellIds;
  }, [suggestedStrategyCellIds]);

  const applyFollowOverlayActivities = useCallback(
    (activities: FollowOverlayActivity[]) => {
      if (activities.length === 0) return;
      lastFollowOverlayUpdateAtRef.current = Date.now();
      activities.forEach((activity) => {
        upsertFollowedOrderActivity(activity);
      });
    },
    [upsertFollowedOrderActivity],
  );

  const queueFollowOverlayActivities = useCallback(
    (activities: FollowOverlayActivity[]) => {
      if (activities.length === 0) return;

      const now = Date.now();
      const elapsed = now - lastFollowOverlayUpdateAtRef.current;

      if (elapsed >= FOLLOW_OVERLAY_SOCKET_UPDATE_MIN_INTERVAL_MS) {
        applyFollowOverlayActivities(activities);
        return;
      }

      followOverlayPendingActivitiesRef.current = activities;
      if (followOverlayFlushTimerRef.current) return;

      const waitMs = FOLLOW_OVERLAY_SOCKET_UPDATE_MIN_INTERVAL_MS - elapsed;
      followOverlayFlushTimerRef.current = setTimeout(() => {
        followOverlayFlushTimerRef.current = null;
        const nextActivities = followOverlayPendingActivitiesRef.current;
        followOverlayPendingActivitiesRef.current = null;
        if (!nextActivities) return;
        applyFollowOverlayActivities(nextActivities);
      }, waitMs);
    },
    [applyFollowOverlayActivities],
  );

  const applySuggestedStrategyCellIds = useCallback(
    (incomingCellIds: string[]) => {
      lastSuggestedStrategyUpdateAtRef.current = Date.now();
      const chartTime = getLatestChartTime(history, nowRef.current);
      const mergedCellIds = [
        ...suggestedStrategyCellIdsRef.current.filter((cellId) =>
          isCellIdStillAheadOfChart(cellId, chartTime),
        ),
        ...incomingCellIds.filter((cellId) =>
          isCellIdStillAheadOfChart(cellId, chartTime),
        ),
      ];
      const nextCellIds = [...new Set(mergedCellIds)];
      suggestedStrategyCellIdsRef.current = nextCellIds;
      setSuggestedStrategyCellIds(nextCellIds);
    },
    [history],
  );

  const queueSuggestedStrategyCellIds = useCallback(
    (nextCellIds: string[]) => {
      const now = Date.now();
      const elapsed = now - lastSuggestedStrategyUpdateAtRef.current;

      if (elapsed >= SUGGESTED_STRATEGY_MIN_HOLD_MS) {
        applySuggestedStrategyCellIds(nextCellIds);
        return;
      }

      suggestedStrategyPendingCellIdsRef.current = nextCellIds;
      if (suggestedStrategyFlushTimerRef.current) return;

      const waitMs = SUGGESTED_STRATEGY_MIN_HOLD_MS - elapsed;
      suggestedStrategyFlushTimerRef.current = setTimeout(() => {
        suggestedStrategyFlushTimerRef.current = null;
        const queuedCellIds = suggestedStrategyPendingCellIdsRef.current;
        suggestedStrategyPendingCellIdsRef.current = null;
        if (!queuedCellIds) return;
        applySuggestedStrategyCellIds(queuedCellIds);
      }, waitMs);
    },
    [applySuggestedStrategyCellIds],
  );

  useEffect(() => {
    if (isFollowTradeVisible) {
      lastFollowOverlayUpdateAtRef.current = 0;
      return;
    }

    lastFollowOverlayUpdateAtRef.current = 0;
    followOverlayPendingActivitiesRef.current = null;
    if (followOverlayFlushTimerRef.current) {
      clearTimeout(followOverlayFlushTimerRef.current);
      followOverlayFlushTimerRef.current = null;
    }
  }, [isFollowTradeVisible]);

  useEffect(() => {
    if (isSuggestedStrategyVisible) {
      lastSuggestedStrategyUpdateAtRef.current = 0;
      return;
    }

    lastSuggestedStrategyUpdateAtRef.current = 0;
    suggestedStrategyPendingCellIdsRef.current = null;
    if (suggestedStrategyFlushTimerRef.current) {
      clearTimeout(suggestedStrategyFlushTimerRef.current);
      suggestedStrategyFlushTimerRef.current = null;
    }
  }, [isSuggestedStrategyVisible]);

  useEffect(() => {
    return () => {
      if (followOverlayFlushTimerRef.current) {
        clearTimeout(followOverlayFlushTimerRef.current);
      }
      if (suggestedStrategyFlushTimerRef.current) {
        clearTimeout(suggestedStrategyFlushTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      !isAuthenticated ||
      isLoggingIn ||
      (!isFollowTradeVisible &&
        !isFollowTradeConfigVisibleDraft &&
        !isFollowReferralModalOpen)
    ) {
      return;
    }

    void refetchFollowing();
  }, [
    isAuthenticated,
    isFollowReferralModalOpen,
    isFollowTradeConfigVisibleDraft,
    isFollowTradeVisible,
    isLoggingIn,
    refetchFollowing,
  ]);

  useEffect(() => {
    setWssKey(resolvedWssKey);
  }, [resolvedWssKey, setWssKey]);

  // ── Live socket feed ───────────────────────────────────────────────────────
  useEffect(() => {
    const abortController = new AbortController();

    const loadHistory = async () => {
      try {
        const response = await fetch(BINANCE_HISTORY_URL, {
          method: "GET",
          cache: "no-store",
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(
            `Binance history request failed (${response.status})`,
          );
        }

        const payload: unknown = await response.json();
        const nextHistory = extractBinanceKlineHistory(payload);
        if (nextHistory.length > 0) {
          hydrateHistory(nextHistory);
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error(
          "[TradingGrid] Failed to load Binance chart history",
          error,
        );
      }
    };

    void loadHistory();

    return () => {
      abortController.abort();
    };
  }, [hydrateHistory]);

  useEffect(() => {
    const liveSocket = io(BACKEND_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    setConnection(liveSocket, null);

    liveSocket.on("price_now", (payload: unknown) => {
      const data = payload as
        | number
        | {
            price?: number | string;
            ts?: number;
            time?: number;
          };
      const priceRaw = typeof data === "number" ? data : data?.price;
      const price = Number(priceRaw);
      if (!Number.isFinite(price)) return;

      const ts =
        typeof data === "number" ? undefined : (data?.ts ?? data?.time);
      updatePrice(price, ts);
    });

    liveSocket.on("grid_update", (payload: unknown) => {
      let remoteCells: RemoteCell[] | null = null;
      if (Array.isArray(payload)) {
        remoteCells = payload as RemoteCell[];
      } else if (payload && typeof payload === "object") {
        const wrapped = payload as { data?: unknown; grids?: unknown };
        if (Array.isArray(wrapped.data))
          remoteCells = wrapped.data as RemoteCell[];
        if (Array.isArray(wrapped.grids))
          remoteCells = wrapped.grids as RemoteCell[];
      }

      if (remoteCells) {
        updateGrid(remoteCells);
      }
    });

    return () => {
      liveSocket.off("price_now");
      liveSocket.off("grid_update");
      liveSocket.disconnect();
      setConnection(null, null);
    };
  }, [setConnection, updateGrid, updatePrice]);

  useEffect(() => {
    if (
      !socket ||
      typeof socket !== "object" ||
      !("connected" in socket) ||
      typeof socket.connected !== "boolean" ||
      !("emit" in socket) ||
      typeof socket.emit !== "function" ||
      !("on" in socket) ||
      typeof socket.on !== "function" ||
      !("off" in socket) ||
      typeof socket.off !== "function"
    ) {
      return;
    }
    const userAddress = resolvedUserAddress;
    if (!isAuthenticated || !userAddress) {
      return;
    }

    const socketClient = socket as {
      connected: boolean;
      emit: (event: string, payload: unknown) => void;
      on: (event: string, handler: (payload: unknown) => void) => void;
      off: (event: string, handler?: (payload: unknown) => void) => void;
    };
    let isDisposed = false;

    const subscribeUser = async () => {
      const wssKeyResponse = await authControllerGetWssKey();
      const wssKey = extractWssKey(wssKeyResponse);
      if (!wssKey) {
        throw new Error("Missing WSS key");
      }

      setConnection(socket, wssKey);
      setWssKey(wssKey);

      const challengeResponse = await authControllerGetChallenge({
        address: userAddress,
      });
      const challenge = extractChallenge(challengeResponse);
      if (!challenge) {
        throw new Error("Missing socket user challenge");
      }

      const signature = await signWssMessage(wssKey, userAddress, challenge);
      if (isDisposed) return;

      socketClient.emit(SUBSCRIBE_USER_EVENT, {
        userId: userAddress,
        signature,
      });
    };

    const handleConnect = () => {
      void subscribeUser().catch((error) => {
        console.error("Failed to subscribe user:", error);
      });
    };

    if (socketClient.connected) {
      handleConnect();
    }
    socketClient.on("connect", handleConnect);

    return () => {
      isDisposed = true;
      socketClient.off("connect", handleConnect);
    };
  }, [isAuthenticated, resolvedUserAddress, setConnection, setWssKey, socket]);

  useEffect(() => {
    if (
      !socket ||
      typeof socket !== "object" ||
      !("connected" in socket) ||
      typeof socket.connected !== "boolean" ||
      !("emit" in socket) ||
      typeof socket.emit !== "function" ||
      !("on" in socket) ||
      typeof socket.on !== "function" ||
      !("off" in socket) ||
      typeof socket.off !== "function"
    ) {
      return;
    }
    if (!isFollowTradeVisible) {
      return;
    }
    if (
      !wssKey ||
      enabledFollowTargetIds.length === 0 ||
      !resolvedUserAddress
    ) {
      return;
    }
    const userAddress = resolvedUserAddress;
    const activeWssKey = wssKey;

    const socketClient = socket as {
      connected: boolean;
      emit: (event: string, payload: unknown) => void;
      on: (event: string, handler: (payload: unknown) => void) => void;
      off: (event: string, handler?: (payload: unknown) => void) => void;
    };

    let isDisposed = false;

    const getFollowSignature = async () => {
      const challengeResponse = await authControllerGetChallenge({
        address: userAddress,
      });
      const challenge = extractChallenge(challengeResponse);

      if (!challenge) {
        throw new Error("Missing socket follow challenge");
      }

      return signWssMessage(activeWssKey, userAddress, challenge);
    };

    const subscribeToFollows = async () => {
      const signature = await getFollowSignature();
      if (isDisposed) return;

      enabledFollowTargetIds.forEach((targetUserId) => {
        socketClient.emit(SUBSCRIBE_ORDER_FOLLOWS_EVENT, {
          userId: userAddress,
          targetUserId,
          signature,
        });
      });
    };

    const handleConnect = () => {
      void subscribeToFollows().catch((error) => {
        console.error("Failed to subscribe to followed orders:", error);
      });
    };

    if (socketClient.connected) {
      handleConnect();
    }
    socketClient.on("connect", handleConnect);

    return () => {
      isDisposed = true;

      void getFollowSignature()
        .then((signature) => {
          enabledFollowTargetIds.forEach((targetUserId) => {
            socketClient.emit(UNSUBSCRIBE_ORDER_FOLLOWS_EVENT, {
              userId: userAddress,
              targetUserId,
              signature,
            });
          });
        })
        .catch((error) => {
          console.error("Failed to unsubscribe from followed orders:", error);
        });
      socketClient.off("connect", handleConnect);
    };
  }, [
    enabledFollowTargetIds,
    enabledFollowTargetsKey,
    isFollowTradeVisible,
    wssKey,
    resolvedUserAddress,
    socket,
  ]);

  useEffect(() => {
    if (
      !socket ||
      typeof socket !== "object" ||
      !("on" in socket) ||
      typeof socket.on !== "function" ||
      !("off" in socket) ||
      typeof socket.off !== "function" ||
      !isFollowTradeVisible ||
      enabledFollowTargetIds.length === 0
    ) {
      return;
    }

    const socketClient = socket as {
      on: (event: string, handler: (payload: unknown) => void) => void;
      off: (event: string, handler: (payload: unknown) => void) => void;
    };

    const handleFollowedOrderUpdate = (payload: unknown) => {
      const activities = extractFollowedOrderActivities(
        payload,
        enabledFollowTargetIds,
      )
        .map((activity) => {
          const resolvedCellId = resolveGridCellIdFromActivityCellId(
            activity.cellId,
            storeRef.current.cells,
          );

          if (resolvedCellId === activity.cellId) return activity;
          return {
            ...activity,
            cellId: resolvedCellId,
          };
        })
        .filter((activity) => activity.cellId !== null);

      queueFollowOverlayActivities(activities);
    };

    socketClient.on(FOLLOWED_ORDER_UPDATE_EVENT, handleFollowedOrderUpdate);

    return () => {
      socketClient.off(FOLLOWED_ORDER_UPDATE_EVENT, handleFollowedOrderUpdate);
    };
  }, [
    enabledFollowTargetIds,
    isFollowTradeVisible,
    queueFollowOverlayActivities,
    socket,
    enabledFollowTargetsKey,
  ]);

  useEffect(() => {
    if (
      !socket ||
      typeof socket !== "object" ||
      !("connected" in socket) ||
      typeof socket.connected !== "boolean" ||
      !("emit" in socket) ||
      typeof socket.emit !== "function" ||
      !("on" in socket) ||
      typeof socket.on !== "function" ||
      !("off" in socket) ||
      typeof socket.off !== "function" ||
      !isSuggestedStrategyVisible
    ) {
      return;
    }

    const socketClient = socket as {
      connected: boolean;
      emit: (event: string) => void;
      on: (event: string, handler: () => void) => void;
      off: (event: string, handler?: () => void) => void;
    };

    const subscribe = () => {
      socketClient.emit(SUBSCRIBE_SUGGESTED_STRATEGY_EVENT);
    };

    if (socketClient.connected) {
      subscribe();
    }
    socketClient.on("connect", subscribe);

    return () => {
      socketClient.off("connect", subscribe);
    };
  }, [isSuggestedStrategyVisible, socket]);

  useEffect(() => {
    if (
      !socket ||
      typeof socket !== "object" ||
      !("on" in socket) ||
      typeof socket.on !== "function" ||
      !("off" in socket) ||
      typeof socket.off !== "function" ||
      !isSuggestedStrategyVisible
    ) {
      return;
    }

    const socketClient = socket as {
      on: (
        event: string,
        handler: (payload: SuggestedStrategyMessage | unknown) => void,
      ) => void;
      off: (
        event: string,
        handler: (payload: SuggestedStrategyMessage | unknown) => void,
      ) => void;
    };

    const handleSuggestedStrategyUpdate = (
      payload: SuggestedStrategyMessage | unknown,
    ) => {
      const nextCellIds = extractSuggestedStrategyCellIds(
        payload,
        storeRef.current.cells,
      );
      // Ignore malformed payload bursts to avoid clearing the current highlight set.
      if (nextCellIds === null) return;
      queueSuggestedStrategyCellIds(nextCellIds);
    };

    socketClient.on(
      SUGGESTED_STRATEGY_UPDATE_EVENT,
      handleSuggestedStrategyUpdate,
    );

    return () => {
      socketClient.off(
        SUGGESTED_STRATEGY_UPDATE_EVENT,
        handleSuggestedStrategyUpdate,
      );
    };
  }, [isSuggestedStrategyVisible, queueSuggestedStrategyCellIds, socket]);

  useEffect(() => {
    const nextServerBalance = extractBalanceAmount(balanceResponse);
    if (nextServerBalance === null) return;

    useGameStore.setState({
      serverBalance: nextServerBalance,
      balance: nextServerBalance,
    });
  }, [balanceResponse]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const socketClient = socket as {
      on: (event: string, handler: (payload: unknown) => void) => void;
      off: (event: string, handler: (payload: unknown) => void) => void;
    };

    const normalizedCurrentUser = parseAddress(resolvedUserAddress);

    const handleBalanceUpdate = (payload: unknown) => {
      const payloadUserId = parseAddress(extractBalanceUserId(payload));
      if (
        payloadUserId &&
        (!normalizedCurrentUser || payloadUserId !== normalizedCurrentUser)
      ) {
        return;
      }

      const nextServerBalance = extractBalanceAmount(payload);
      if (nextServerBalance === null) return;

      useGameStore.setState({
        serverBalance: nextServerBalance,
        balance: nextServerBalance,
      });
    };

    socketClient.on(BALANCE_UPDATE_EVENT, handleBalanceUpdate);

    return () => {
      socketClient.off(BALANCE_UPDATE_EVENT, handleBalanceUpdate);
    };
  }, [resolvedUserAddress, socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const socketClient = socket as {
      on: (event: string, handler: (payload: unknown) => void) => void;
      off: (event: string, handler: (payload: unknown) => void) => void;
    };

    const handleOrderUpdate = (payload: unknown) => {
      updateOrder(payload);
    };

    socketClient.on(ORDER_UPDATE_EVENT, handleOrderUpdate);

    return () => {
      socketClient.off(ORDER_UPDATE_EVENT, handleOrderUpdate);
    };
  }, [socket, updateOrder]);

  useEffect(() => {
    const orders = extractUserOrders(userOrdersResponse);
    if (orders.length === 0) return;

    orders.forEach((orderPayload) => {
      updateOrder(orderPayload);
    });
  }, [updateOrder, userOrdersResponse]);

  useEffect(() => {
    if (
      !socket ||
      !isFollowTradeVisible ||
      enabledFollowTargetIds.length === 0
    ) {
      return;
    }

    const socketClient = socket as {
      on: (event: string, handler: (payload: unknown) => void) => void;
      off: (event: string, handler: (payload: unknown) => void) => void;
    };
    const handleFollowedOrder = (payload: unknown) => {
      const activities = extractFollowedOrderActivities(
        payload,
        enabledFollowTargetIds,
      )
        .map((activity) => {
          const resolvedCellId = resolveGridCellIdFromActivityCellId(
            activity.cellId,
            storeRef.current.cells,
          );

          if (resolvedCellId === activity.cellId) return activity;
          return {
            ...activity,
            cellId: resolvedCellId,
          };
        })
        .filter((activity) => activity.cellId !== null);

      queueFollowOverlayActivities(activities);
    };

    FOLLOW_ORDER_EVENTS.forEach((event) => {
      if (event === "order_follow_update") {
        console.log("subscribed order_follow_update");
      }
      socketClient.on(event, handleFollowedOrder);
    });

    return () => {
      FOLLOW_ORDER_EVENTS.forEach((event) => {
        socketClient.off(event, handleFollowedOrder);
      });
    };
  }, [
    enabledFollowTargetIds,
    isFollowTradeVisible,
    queueFollowOverlayActivities,
    socket,
    enabledFollowTargetsKey,
  ]);

  // ── Track wins (fire once per hit transition, not once forever per id) ────
  useEffect(() => {
    const nextWinningCellIds = new Set<string>();

    cells.forEach((cell) => {
      if (cell.status !== "hit") return;
      const hasTrackedStake =
        (bets[cell.id] || 0) > 0 ||
        (pendingBets[cell.id] || 0) > 0 ||
        pendingWins[cell.id] !== undefined;
      if (!hasTrackedStake) return;

      nextWinningCellIds.add(cell.id);
      if (previousWinningCellIdsRef.current.has(cell.id)) return;

      const effectStartedAt = Date.now();
      setActiveWinEffectByCellId((currentValue) => ({
        ...currentValue,
        [cell.id]: {
          startedAt: effectStartedAt,
          showTotal: false,
        },
      }));

      const existingPhaseTimer = winEffectPhaseTimersRef.current.get(cell.id);
      if (existingPhaseTimer) {
        clearTimeout(existingPhaseTimer);
      }
      const phaseTimerId = setTimeout(() => {
        setActiveWinEffectByCellId((currentValue) => {
          const currentCellState = currentValue[cell.id];
          if (!currentCellState || currentCellState.showTotal) {
            return currentValue;
          }
          return {
            ...currentValue,
            [cell.id]: {
              ...currentCellState,
              showTotal: true,
            },
          };
        });
        winEffectPhaseTimersRef.current.delete(cell.id);
      }, WIN_EFFECT_AMOUNTS_VISIBLE_MS);
      winEffectPhaseTimersRef.current.set(cell.id, phaseTimerId);

      const existingCleanupTimer = winEffectCleanupTimersRef.current.get(
        cell.id,
      );
      if (existingCleanupTimer) {
        clearTimeout(existingCleanupTimer);
      }
      const cleanupTimerId = setTimeout(() => {
        setActiveWinEffectByCellId((currentValue) => {
          if (!(cell.id in currentValue)) return currentValue;
          const nextValue = { ...currentValue };
          delete nextValue[cell.id];
          return nextValue;
        });
        winEffectCleanupTimersRef.current.delete(cell.id);
      }, WIN_EFFECT_VISIBLE_MS);
      winEffectCleanupTimersRef.current.set(cell.id, cleanupTimerId);
    });

    previousWinningCellIdsRef.current = nextWinningCellIds;
  }, [cells, bets, pendingBets, pendingWins]);

  useEffect(
    () => () => {
      for (const timerId of winEffectPhaseTimersRef.current.values()) {
        clearTimeout(timerId);
      }
      winEffectPhaseTimersRef.current.clear();
      for (const timerId of winEffectCleanupTimersRef.current.values()) {
        clearTimeout(timerId);
      }
      winEffectCleanupTimersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (history.length === 0) return;

    const lastPoint = history[history.length - 1];
    const previousRealPoint =
      history.length > 1 ? history[history.length - 2] : null;
    const previousTrackedPoint = lastHistoryPointRef.current;

    if (
      previousTrackedPoint &&
      previousTrackedPoint.time === lastPoint.time &&
      previousTrackedPoint.price === lastPoint.price
    ) {
      return;
    }

    if (!previousTrackedPoint || cameraPriceRef.current === 0) {
      cameraPriceRef.current = lastPoint.price;
      priceMotionRef.current = null;
      lastHistoryPointRef.current = {
        time: lastPoint.time,
        price: lastPoint.price,
      };
      return;
    }

    const observedInterval = previousRealPoint
      ? lastPoint.time - previousRealPoint.time
      : 0;
    if (observedInterval > 0) {
      tickCadenceMsRef.current =
        tickCadenceMsRef.current +
        (observedInterval - tickCadenceMsRef.current) * TICK_CADENCE_SMOOTHING;
    }
    const durationMs = Math.min(
      MAX_PRICE_MOTION_MS,
      Math.max(MIN_PRICE_MOTION_MS, tickCadenceMsRef.current * 0.92),
    );
    const priceJump = Math.abs(lastPoint.price - cameraPriceRef.current);
    const safePriceStep = Math.max(modePriceStep, 1e-6);
    const jumpInSteps = priceJump / safePriceStep;
    const largeMoveRatio = Math.max(
      0,
      Math.min(
        1,
        (jumpInSteps - LARGE_MOVE_STEPS_START) /
          Math.max(1e-6, LARGE_MOVE_STEPS_FULL - LARGE_MOVE_STEPS_START),
      ),
    );
    const largeMoveDurationFactor =
      1 - largeMoveRatio * (1 - LARGE_MOVE_DURATION_FACTOR_MIN);
    const adaptiveDurationMs = Math.max(
      MIN_PRICE_MOTION_MS,
      durationMs * largeMoveDurationFactor,
    );

    priceMotionRef.current = {
      startPrice: cameraPriceRef.current,
      targetPrice: lastPoint.price,
      startTime:
        nowRef.current > 0 ? nowRef.current : Date.now() + serverTimeOffset,
      durationMs: adaptiveDurationMs,
    };
    lastHistoryPointRef.current = {
      time: lastPoint.time,
      price: lastPoint.price,
    };
  }, [history, modePriceStep, serverTimeOffset]);

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const commitResize = (resetCanvas = false) => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      sizeRef.current = { w, h };
      isMobileRef.current = window.innerWidth < 640;
      const minZoom = getMinZoom();

      if (transformRef.current.zoom < minZoom) {
        transformRef.current = { ...transformRef.current, zoom: minZoom };
      }

      const cv = canvasRef.current;
      if (cv) {
        syncCanvasSize(cv);
      }

      if (resetCanvas) {
        setCanvasInstanceKey((currentKey) => currentKey + 1);
        return;
      }

      drawRef.current();
    };

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleResizeCommit = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        commitResize(true);
      }, RESIZE_COMMIT_DEBOUNCE_MS);
    };

    const ro = new ResizeObserver(scheduleResizeCommit);
    ro.observe(el);
    commitResize();

    window.addEventListener("resize", scheduleResizeCommit);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", scheduleResizeCommit);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [getMinZoom, syncCanvasSize]);

  // ── Hit-test ───────────────────────────────────────────────────────────────
  const hitTest = useCallback((cx: number, cy: number) => {
    const layout = computeLayout(
      transformRef.current,
      sizeRef.current,
      nowRef.current,
      cameraPriceRef.current,
      storeRef.current,
    );
    return hitTestCell(cx, cy, layout, storeRef.current, nowRef.current);
  }, []);

  const hitTestAny = useCallback((cx: number, cy: number) => {
    const layout = computeLayout(
      transformRef.current,
      sizeRef.current,
      nowRef.current,
      cameraPriceRef.current,
      storeRef.current,
    );
    return hitTestAnyCell(cx, cy, layout, storeRef.current);
  }, []);

  const selectedShareCell = useMemo(
    () => cells.find((cell) => cell.id === shareCellId) ?? null,
    [cells, shareCellId],
  );
  const selectedShareAmount = selectedShareCell
    ? bets[selectedShareCell.id] ||
      pendingBets[selectedShareCell.id] ||
      betAmount
    : betAmount;
  const selectedShareProfit = useMemo(() => {
    if (!selectedShareCell) return 0;
    const settledPayout = settledOutcomes[selectedShareCell.id]?.payout;
    if (typeof settledPayout === "number" && Number.isFinite(settledPayout)) {
      return Math.max(settledPayout, 0);
    }
    return (
      selectedShareAmount * Math.max((selectedShareCell.multiplier ?? 0) - 1, 0)
    );
  }, [selectedShareAmount, selectedShareCell, settledOutcomes]);
  const shareWinRate = useMemo(() => {
    const settled = Object.values(settledOutcomes);
    if (settled.length === 0) return null;
    const wins = settled.filter((item) => item.isWin).length;
    return formatPercent((wins / settled.length) * 100);
  }, [settledOutcomes]);
  const selectedShareRoi = useMemo(() => {
    if (!selectedShareCell || selectedShareAmount <= 0) return null;
    return formatPercent((selectedShareProfit / selectedShareAmount) * 100);
  }, [selectedShareAmount, selectedShareCell, selectedShareProfit]);
  const selectedShareTime = useMemo(() => {
    if (!selectedShareCell) return "--:--:--";
    return shareTimeFormatter.format(
      new Date(selectedShareCell.timeWindowStart),
    );
  }, [selectedShareCell]);

  const handleOpenShareSheet = useCallback((cellId: string) => {
    setShareCellId(cellId);
    setIsShareSheetOpen(true);
  }, []);

  const setShareOverlayButtonRef = useCallback(
    (cellId: string, node: HTMLButtonElement | null) => {
      if (!node) {
        shareOverlayButtonRefs.current.delete(cellId);
        return;
      }
      shareOverlayButtonRefs.current.set(cellId, node);
    },
    [],
  );

  const setWinEffectIconRef = useCallback(
    (cellId: string, node: HTMLDivElement | null) => {
      if (!node) {
        winEffectIconRefs.current.delete(cellId);
        return;
      }
      winEffectIconRefs.current.set(cellId, node);
    },
    [],
  );

  const syncShareOverlayPositions = useCallback(
    (targets: ShareOverlayTarget[]) => {
      const targetById = new Map(
        targets.map((target) => [target.cellId, target]),
      );
      for (const [cellId, node] of shareOverlayButtonRefs.current.entries()) {
        if (!node) continue;
        const nextTarget = targetById.get(cellId);
        if (!nextTarget) {
          node.style.display = "none";
          continue;
        }
        node.style.display = "";
        node.style.transform = `translate3d(${nextTarget.left}px, ${nextTarget.top}px, 0)`;
        node.style.width = `${nextTarget.buttonSize}px`;
        node.style.height = `${nextTarget.buttonSize}px`;
      }
      const wrapRect = wrapRef.current?.getBoundingClientRect();
      const offsetX = wrapRect?.left ?? 0;
      const offsetY = wrapRect?.top ?? 0;
      for (const [cellId, node] of winEffectIconRefs.current.entries()) {
        if (!node) continue;
        const nextTarget = targetById.get(cellId);
        if (!nextTarget) {
          node.style.display = "none";
          continue;
        }
        node.style.display = "";
        node.style.transform = `translate3d(${offsetX + nextTarget.centerLeft}px, ${offsetY + nextTarget.centerTop}px, 0) translate(-50%, -50%)`;
      }
    },
    [wrapRef],
  );

  // ── Draw ───────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const tf = transformRef.current;
    const layout = computeLayout(
      tf,
      sizeRef.current,
      nowRef.current,
      cameraPriceRef.current,
      storeRef.current,
    );
    const store = storeRef.current;
    const isMobile = isMobileRef.current;
    const animatedPriceStore = {
      ...store,
      history: buildDisplayHistory(
        store.history,
        nowRef.current,
        cameraPriceRef.current,
      ),
      followedOrderActivities: isFollowTradeVisible
        ? store.followedOrderActivities.filter((activity) =>
            enabledFollowTargetIdsSet.has(activity.targetUserId),
          )
        : [],
      suggestedStrategyCellIds: isSuggestedStrategyVisible
        ? store.suggestedStrategyCellIds
        : [],
    };
    const nextShareTargets: ShareOverlayTarget[] = [];
    for (const cell of store.cells) {
      if (cell.status !== "hit") continue;
      const hasTrackedStake =
        (store.bets[cell.id] || 0) > 0 ||
        (store.pendingBets[cell.id] || 0) > 0 ||
        store.pendingWins[cell.id] !== undefined;
      if (!hasTrackedStake) continue;

      const x = layout.toCanvasX(cell.timeWindowStart);
      const y = layout.toCellY(cell.priceLevel + layout.effectivePriceStep / 2);
      const w = layout.cellW;
      const h = layout.cellH;
      if (x + w < 0 || x > layout.w || y + h < 0 || y > layout.h) continue;
      const settled = store.settledOutcomes[cell.id];
      const hasSettledBreakdown =
        settled?.basePayout !== null || settled?.bonusPayout !== null;
      const fallbackTotalPayout = Math.max(
        settled?.payout ?? store.pendingWins[cell.id] ?? 0,
        0,
      );
      const bonusPayout = Math.max(settled?.bonusPayout ?? 0, 0);
      const basePayout = hasSettledBreakdown
        ? Math.max(settled?.basePayout ?? 0, 0)
        : fallbackTotalPayout;
      const totalPayout = hasSettledBreakdown
        ? basePayout + bonusPayout
        : fallbackTotalPayout;

      const minEdge = Math.max(1, Math.min(w, h));
      const inset = Math.max(1, Math.min(4, Math.round(minEdge * 0.12)));
      const maxButtonSize = Math.max(10, Math.round(minEdge - inset * 2));
      const buttonSize = Math.max(
        10,
        Math.min(24, maxButtonSize, Math.round(minEdge * 0.4)),
      );

      nextShareTargets.push({
        cellId: cell.id,
        left: Math.max(
          0,
          Math.min(layout.w - buttonSize, x + w - buttonSize - inset),
        ),
        top: Math.max(0, Math.min(layout.h - buttonSize, y + inset)),
        centerLeft: x + w / 2,
        centerTop: y + h / 2,
        cellEdge: minEdge,
        buttonSize,
        isHumanVerified: settled?.isHumanVerified ?? false,
        totalPayout,
        basePayout,
        bonusPayout,
      });
    }
    shareTargetsRef.current = nextShareTargets;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Base fill
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, layout.w, layout.h);

    drawBackgroundGrid(ctx, layout, store);
    // Bet-cell visibility/selection must track real server ticks, not the
    // interpolated display point used for smoother line animation.
    drawBetCells(
      ctx,
      layout,
      animatedPriceStore,
      isMobile,
      previewCellIdRef.current,
      activeWinEffectCellIdSet,
    );
    drawPriceLine(ctx, layout, animatedPriceStore);
    drawPriceAxis(ctx, layout, animatedPriceStore, isMobile);
    drawTimeAxis(ctx, layout, isMobile);
    drawZoomIndicator(ctx, layout, tf.zoom);

    ctx.restore();
  }, [
    activeWinEffectCellIdSet,
    enabledFollowTargetIdsSet,
    isFollowTradeVisible,
    isSuggestedStrategyVisible,
  ]);

  // Keep drawRef in sync so the resize observer always calls the latest draw
  useEffect(() => {
    drawRef.current = draw;
  });

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    nowRef.current = Date.now() + serverTimeOffset;
  }, [serverTimeOffset]);

  useEffect(() => {
    // Keep bet-status transitions visually immediate when the chart head crosses
    // a cell boundary. 1s cadence causes noticeable lag; run at sub-frame cadence.
    const WIN_CHECK_INTERVAL_MS = 50;
    let lastWinCheck = 0;

    const loop = () => {
      const loopNow = performance.now();
      const wallClockNow = Date.now();
      const state = useGameStore.getState();
      const target = state.currentPrice;

      const nextNow = wallClockNow + state.serverTimeOffset;
      nowRef.current = nextNow;

      // Animate each real tick across most of the gap to the next tick so the
      // line keeps moving instead of snapping and then idling.
      const motion = priceMotionRef.current;
      if (motion && motion.durationMs > 0) {
        const elapsed = nextNow - motion.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / motion.durationMs));
        const easedProgress = easeOutCubic(progress);
        cameraPriceRef.current =
          motion.startPrice +
          (motion.targetPrice - motion.startPrice) * easedProgress;

        if (progress >= 1) {
          cameraPriceRef.current = motion.targetPrice;
          priceMotionRef.current = null;
        }
      } else if (cameraPriceRef.current === 0 && target !== 0) {
        cameraPriceRef.current = target;
      } else if (Math.abs(target - cameraPriceRef.current) < 1e-6) {
        cameraPriceRef.current = target;
      }

      // Check frequently so OPEN/SETTLED outcomes reveal right as the chart reaches the cell.
      if (loopNow - lastWinCheck > WIN_CHECK_INTERVAL_MS) {
        const hasOpenBetState =
          Object.keys(state.pendingBets).length > 0 ||
          Object.keys(state.bets).length > 0 ||
          Object.keys(state.pendingWins).length > 0 ||
          Object.keys(state.settledOutcomes).length > 0;
        if (hasOpenBetState) {
          const chartTime = getLatestChartTime(state.history, nowRef.current);
          state.checkWinEffects(chartTime);
        }
        lastWinCheck = loopNow;
      }

      draw();
      const nextTargets = shareTargetsRef.current;
      syncShareOverlayPositions(nextTargets);
      const nextIdsHash = nextTargets
        .map(
          (item) =>
            `${item.cellId}:${item.isHumanVerified ? 1 : 0}:${item.totalPayout.toFixed(6)}:${item.basePayout.toFixed(6)}:${item.bonusPayout.toFixed(6)}:${Math.round(item.cellEdge)}`,
        )
        .join("|");
      if (nextIdsHash !== shareTargetIdsHashRef.current) {
        shareTargetIdsHashRef.current = nextIdsHash;
        setShareOverlayTargets(nextTargets);
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, syncShareOverlayPositions]);

  // ── Interaction ────────────────────────────────────────────────────────────
  const {
    isDragging,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    endDrag,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleClick,
    clearPreviewCell,
    resetTransform,
  } = useGridInteraction({
    canvasRef,
    sizeRef,
    transformRef,
    nowRef,
    storeRef,
    previewCellIdRef,
    hitTest,
    hitTestAnyCell: hitTestAny,
    placeBet,
    getMinZoom,
  });

  // Attach wheel and touchmove as non-passive so preventDefault() works
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, [handleWheel, handleTouchMove]);

  // ── Loading state ──────────────────────────────────────────────────────────
  const hasLiveData =
    cells.length > 0 || history.length > 0 || currentPrice > 0;
  const showLoadingState = !hasLiveData;
  const loadingLabel = socket
    ? "Loading live market grid, please wait..."
    : isLoggingIn
      ? "Authenticating wallet, please wait..."
      : address
        ? "Reconnecting to market feed, please wait..."
        : "Connect wallet to load the market feed";
  const displayPrice =
    currentPrice > 0 ? livePriceFormatter.format(currentPrice) : "--";
  const displayMarketPrice =
    displayPrice === "--" ? displayPrice : `~ ${displayPrice}`;
  const handleRecenterGrid = useCallback(() => {
    clearPreviewCell();
    resetTransform();
  }, [clearPreviewCell, resetTransform]);
  const handleOpenOverlaySheet = useCallback(() => {
    setSuggestedStrategyEnabledDraft(suggestedStrategyEnabled);
    setFollowTradeEnabledDraft(followTradeEnabled);
    setFollowTradeTargetEnabledDraft(followTradeTargetEnabled);
    setIsOverlaySheetOpen(true);
  }, [followTradeEnabled, followTradeTargetEnabled, suggestedStrategyEnabled]);
  const handleCloseOverlaySheet = useCallback(() => {
    setSuggestedStrategyEnabledDraft(suggestedStrategyEnabled);
    setFollowTradeEnabledDraft(followTradeEnabled);
    setFollowTradeTargetEnabledDraft(followTradeTargetEnabled);
    setIsOverlaySheetOpen(false);
  }, [followTradeEnabled, followTradeTargetEnabled, suggestedStrategyEnabled]);
  const handleSuggestedStrategyDraftChange = useCallback(
    (nextValue: boolean) => {
      setSuggestedStrategyEnabledDraft(nextValue);
    },
    [],
  );
  const handleFollowTradeDraftChange = useCallback((nextValue: boolean) => {
    setFollowTradeEnabledDraft(nextValue);
  }, []);
  const handleFollowTradeTargetDraftChange = useCallback(
    (targetUserId: string, nextValue: boolean) => {
      setFollowTradeTargetEnabledDraft((currentValue) => ({
        ...currentValue,
        [targetUserId]: nextValue,
      }));
    },
    [],
  );
  const handleApplyOverlayMode = useCallback(() => {
    const nextSuggestedStrategyEnabled = suggestedStrategyEnabledDraft;
    const nextFollowTradeEnabled = followTradeEnabledDraft;
    const nextFollowTradeTargetEnabled = ensureFollowTargetConfig(
      followTradeTargetEnabledDraft,
    );

    setSuggestedStrategyEnabled(nextSuggestedStrategyEnabled);
    setFollowTradeEnabled(nextFollowTradeEnabled);
    setFollowTradeTargetEnabled(nextFollowTradeTargetEnabled);
    if (!nextSuggestedStrategyEnabled) {
      setSuggestedStrategyCellIds([]);
    }
    setIsOverlaySheetOpen(false);
  }, [
    ensureFollowTargetConfig,
    followTradeEnabledDraft,
    followTradeTargetEnabledDraft,
    suggestedStrategyEnabledDraft,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background-grid relative flex flex-1 flex-col overflow-hidden font-mono">
      <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-3 sm:inset-x-3">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            className="bg-surface-control pointer-events-auto flex h-8 shrink-0 items-center gap-1 rounded-[8px] px-1 text-white"
          >
            <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/btc.png"
                alt=""
                className="h-full w-full object-contain"
              />
            </span>
            <span className="text-sm font-semibold tracking-[-0.01em]">
              {MARKET_SYMBOL}
            </span>
          </button>
          <span className="text-text-sub truncate text-xs font-semibold tracking-[-0.01em]">
            {displayMarketPrice}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <GridActionButton
            aria-label="Market info"
            onClick={() => setIsInfoSheetOpen(true)}
          >
            <Info className="size-4" strokeWidth={1.75} />
          </GridActionButton>
          <GridActionButton
            aria-label={
              isSuggestedStrategyVisible || isFollowTradeVisible
                ? "Overlay filters enabled. Open overlay settings"
                : "Open overlay settings"
            }
            aria-haspopup="dialog"
            active={isSuggestedStrategyVisible || isFollowTradeVisible}
            onClick={handleOpenOverlaySheet}
          >
            <Eye className="size-4" strokeWidth={1.75} />
          </GridActionButton>
          <GridActionButton
            aria-label="Recenter trading grid"
            onClick={handleRecenterGrid}
          >
            <LocateFixed className="size-4" strokeWidth={1.75} />
          </GridActionButton>
          {/* <GridActionButton aria-label="Change market region">
            <Globe className="size-4" strokeWidth={1.75} />
          </GridActionButton> */}
        </div>
      </div>

      {/* Canvas wrapper */}
      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden"
        style={{
          background: COLOR_BG,
          cursor: showLoadingState
            ? "wait"
            : isDragging
              ? "grabbing"
              : "crosshair",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={() => {
          endDrag();
          clearPreviewCell();
        }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          key={canvasInstanceKey}
          ref={handleCanvasRef}
          className="absolute inset-0"
          style={{ display: "block" }}
        />
        <div className="pointer-events-none fixed inset-0 z-[9999]">
          {shareOverlayTargets
            .filter((target) => activeWinEffectCellIdSet.has(target.cellId))
            .map((target) => (
              <div
                key={`${target.cellId}-win-icon-${activeWinEffectByCellId[target.cellId]?.startedAt ?? 0}`}
                ref={(node) => setWinEffectIconRef(target.cellId, node)}
                className="absolute top-0 left-0 h-[200px] w-[200px] will-change-transform"
                style={{
                  transform: `translate3d(${target.centerLeft}px, ${target.centerTop}px, 0) translate(-50%, -50%)`,
                }}
                aria-hidden
              >
                <BetWinEffect />
                {activeWinEffectByCellId[target.cellId]?.showTotal ? (
                  <div
                    key={`${target.cellId}-total-wrap-${activeWinEffectByCellId[target.cellId]?.startedAt ?? 0}`}
                    className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  >
                    <span
                      className="win-pop-total text-success-medium block font-extrabold tracking-[-0.03em] whitespace-nowrap drop-shadow-[0_0_14px_rgb(17_211_68_/_0.68)]"
                      style={{
                        fontSize: `${Math.max(11, Math.min(20, Math.round(target.cellEdge * 0.24)))}px`,
                      }}
                    >
                      +${winAmountFormatter.format(target.totalPayout)}
                    </span>
                  </div>
                ) : (
                  <div
                    key={`${target.cellId}-amounts-${activeWinEffectByCellId[target.cellId]?.startedAt ?? 0}`}
                    className="win-pop-amounts pointer-events-none absolute flex items-center gap-1.5 whitespace-nowrap"
                    style={{ top: "100px", left: "100px" }}
                  >
                    <span
                      className="text-success-medium font-extrabold tracking-[-0.03em] drop-shadow-[0_0_12px_rgb(17_211_68_/_0.66)]"
                      style={{
                        fontSize: `${Math.max(10, Math.min(18, Math.round(target.cellEdge * 0.2)))}px`,
                      }}
                    >
                      +${winAmountFormatter.format(target.basePayout)}
                    </span>
                    {target.isHumanVerified ? (
                      <Image
                        src="/onboarding/verified-badge.svg"
                        alt="Verified human"
                        width={20}
                        height={20}
                        unoptimized
                        loading="eager"
                        className="shrink-0"
                        style={{
                          width: `${Math.max(11, Math.min(16, Math.round(target.cellEdge * 0.18)))}px`,
                          height: `${Math.max(11, Math.min(16, Math.round(target.cellEdge * 0.18)))}px`,
                        }}
                      />
                    ) : null}
                    {target.bonusPayout > 0 ? (
                      <span
                        className="text-grid-accent font-extrabold tracking-[-0.03em] drop-shadow-[0_0_12px_rgb(18_221_255_/_0.72)]"
                        style={{
                          fontSize: `${Math.max(10, Math.min(18, Math.round(target.cellEdge * 0.2)))}px`,
                        }}
                      >
                        +${winAmountFormatter.format(target.bonusPayout)}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
        </div>
        <div className="pointer-events-none absolute inset-0 z-20">
          {shareOverlayTargets.map((target) => (
            <button
              key={target.cellId}
              ref={(node) => setShareOverlayButtonRef(target.cellId, node)}
              type="button"
              className="bg-background-main/90 border-border-main text-grid-accent pointer-events-auto absolute top-0 left-0 flex items-center justify-center rounded-md border shadow-[0_6px_18px_rgba(0,0,0,0.35)] will-change-transform"
              style={{
                transform: `translate3d(${target.left}px, ${target.top}px, 0)`,
                width: `${target.buttonSize}px`,
                height: `${target.buttonSize}px`,
              }}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenShareSheet(target.cellId);
              }}
              aria-label="Share winning cell"
            >
              <Share2 className="h-1/2 w-1/2 shrink-0" strokeWidth={2} />
            </button>
          ))}
        </div>

        {fakeWinToastData ? (
          <div className="pointer-events-none absolute top-11 left-3 z-20 sm:top-12 sm:left-4">
            <WinBetBanner data={fakeWinToastData} />
          </div>
        ) : null}

        {showLoadingState && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="border-grid-line-strong bg-background-grid text-grid-axis rounded-md border px-4 py-3 text-center text-xs shadow-[0_12px_32px_rgba(0,0,0,0.28)] sm:text-sm">
              <div className="font-semibold text-white">{loadingLabel}</div>
              <div className="mt-1 opacity-70">
                Canvas stays mounted while the first price ticks arrive.
              </div>
              {serverTimeOffset !== 0 && (
                <div className="mt-1 text-[11px] opacity-50">
                  Syncing with server time...
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-6 left-3 z-20 sm:bottom-4 sm:left-4">
          <BalanceChip balance={balance} />
        </div>
      </div>

      <Dialog
        open={isFollowReferralModalOpen}
        onOpenChange={handleFollowReferralModalOpenChange}
      >
        <DialogContent className="pointer-events-none">
          <div className="border-border-main pointer-events-auto w-full max-w-[540px] rounded-[20px] border bg-[linear-gradient(112deg,var(--background-main)_0%,var(--surface-card-strong)_62%,var(--background-main)_100%)] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col gap-4">
              <DialogTitle className="text-text-heading text-xl font-semibold tracking-[-0.01em]">
                Start Follow Trade
              </DialogTitle>
              <DialogDescription className="text-text-sub text-sm font-medium tracking-[-0.01em]">
                {followReferralCode
                  ? `Follow ${followReferralHandle ? `@${followReferralHandle}` : "this trader"} directly from this shared link.`
                  : "Follow this trader directly from the shared link."}
              </DialogDescription>

              <div className="bg-surface-overlay-subtle border-border-main rounded-[12px] border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-text-heading text-sm font-semibold tracking-[-0.01em]">
                    Trader Snapshot
                  </p>
                  <span
                    className={cn(
                      "rounded-[999px] border px-2 py-0.5 text-[11px] font-semibold tracking-[-0.01em]",
                      isFollowReferralAlreadyActive
                        ? "bg-success-background border-success-border text-success-medium"
                        : "bg-surface-overlay border-border-main text-text-sub",
                    )}
                  >
                    {isFollowReferralAlreadyActive ? "Following" : "New Follow"}
                  </span>
                </div>

                {resolvedFollowTargetWallet ? (
                  <p className="text-text-sub mb-3 flex items-center gap-1.5 text-xs tracking-[-0.01em]">
                    <Wallet className="size-3.5" aria-hidden="true" />
                    Trader wallet:{" "}
                    {formatWalletShort(resolvedFollowTargetWallet)}
                  </p>
                ) : null}

                <div className="flex items-center">
                  {followReferralStats.map((item, index) => (
                    <div
                      key={item.label}
                      className={cn(
                        "flex flex-1 flex-col gap-1 px-3 first:pl-0 last:pr-0",
                        index !== 0 && "border-border-main border-l",
                      )}
                    >
                      <p className="text-text-sub text-xs font-medium tracking-[-0.01em]">
                        {item.label}
                      </p>
                      <p
                        className={cn(
                          "text-sm font-semibold tracking-[-0.01em]",
                          item.color,
                        )}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseFollowReferralModal}
                  disabled={isSubmittingFollowReferral}
                  className="border-border-main text-text-inverse hover:text-text-inverse h-11 rounded-[10px] bg-white hover:bg-white/90 disabled:opacity-100"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleFollowByReferral()}
                  disabled={
                    isSubmittingFollowReferral || isFollowReferralAlreadyActive
                  }
                  className="bg-primary-medium text-text-inverse hover:bg-primary-light h-11 rounded-[10px]"
                >
                  {isSubmittingFollowReferral
                    ? "Processing..."
                    : isFollowReferralAlreadyActive
                      ? "Following"
                      : "Follow"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet
        isOpen={isInfoSheetOpen}
        onClose={() => setIsInfoSheetOpen(false)}
        detent="content"
        unstyled
      >
        <Sheet.Backdrop
          onTap={() => setIsInfoSheetOpen(false)}
          className="bg-background-main/55 backdrop-blur-[2px]"
        />
        <Sheet.Container className="pointer-events-none">
          <Sheet.Content
            disableDrag={false}
            className="border-border-main bg-background-main pointer-events-auto rounded-t-[16px] border-t px-5 pt-3 pb-5"
          >
            <TradeControlsPanel
              marketSymbol={MARKET_SYMBOL}
              displayPrice={displayPrice}
              showMarketHeader
              showHandle
              showCloseButton={false}
              onClose={() => setIsInfoSheetOpen(false)}
            />
          </Sheet.Content>
        </Sheet.Container>
      </Sheet>

      <Sheet
        isOpen={isOverlaySheetOpen}
        onClose={handleCloseOverlaySheet}
        detent="content"
        unstyled
      >
        <Sheet.Backdrop
          onTap={handleCloseOverlaySheet}
          className="bg-background-main/55 backdrop-blur-[2px]"
        />
        <Sheet.Container className="pointer-events-none">
          <Sheet.Content
            disableDrag={false}
            className="border-border-main bg-background-main pointer-events-auto rounded-t-[16px] border-t px-5 pt-3 pb-5"
          >
            <OverlayModePanel
              suggestedStrategyEnabled={suggestedStrategyEnabledDraft}
              followTradeEnabled={followTradeEnabledDraft}
              followTradeTargets={followTradeTargetsDraft}
              isFollowTradeLoading={isFollowingFetching}
              onSuggestedStrategyEnabledChange={
                handleSuggestedStrategyDraftChange
              }
              onFollowTradeEnabledChange={handleFollowTradeDraftChange}
              onFollowTradeTargetEnabledChange={
                handleFollowTradeTargetDraftChange
              }
              onApply={handleApplyOverlayMode}
            />
          </Sheet.Content>
        </Sheet.Container>
      </Sheet>

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
            {selectedShareCell ? (
              <div className="mx-auto w-full max-w-[400px]">
                <WinShareCard
                  marketSymbol={MARKET_SYMBOL}
                  multiplier={selectedShareCell.multiplier}
                  amount={selectedShareAmount}
                  openedAt={selectedShareTime}
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
                                ? `+$${winAmountFormatter.format(selectedShareProfit)}`
                                : `$${winAmountFormatter.format(selectedShareProfit)}`,
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
