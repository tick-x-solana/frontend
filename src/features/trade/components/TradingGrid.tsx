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
import { WalletIcon } from "@/src/assets/icons";
import { Button } from "@/src/components/shadcn/button";
import { cn } from "@/lib/utils";
import { Copy, Eye, Info, LocateFixed, Share2 } from "lucide-react";
import { Sheet } from "react-modal-sheet";
import { io } from "socket.io-client";
import { useAccount } from "wagmi";
import { MiniKit } from "@worldcoin/minikit-js";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { buildMiniAppReferralLink } from "@/src/features/referrals/constants";
import OverlayModePanel from "@/src/features/trade/components/OverlayModePanel";
import TradeControlsPanel from "@/src/features/trade/components/TradeControlsPanel";
import { WinShareCard } from "@/src/features/trade/components/WinShareCard";
import {
  extractFollowedOrderActivities,
  extractOrderFollowings,
  extractWssKey,
} from "@/src/features/trade/orderFollow";
import { getLatestChartTime } from "@/src/features/trade/gridTiming";
import type { RemoteCell } from "@/src/features/trade/store";
import { BACKEND_URL } from "@/src/features/trade/constant";
import { useGameStore } from "@/src/features/trade/store";
import { appToast } from "@/src/features/trade/toast";
import {
  authControllerGetWssKey,
  authControllerGetChallenge,
  useAccountControllerGetBalance,
  useAuthControllerGetWssKey,
  useOrderControllerGetUserOrders,
  useOrderFollowControllerListFollowing,
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
import { getAddress } from "viem";

// ─── Constants ────────────────────────────────────────────────────────────────

const DESKTOP_ZOOM_MIN = 0.5;
const MOBILE_ZOOM_MIN = 1.3;
const MIN_PRICE_MOTION_MS = 250;
const MAX_PRICE_MOTION_MS = 5000;
const TICK_CADENCE_SMOOTHING = 0.2;
const RESIZE_COMMIT_DEBOUNCE_MS = 180;
const OVERLAY_SOCKET_UPDATE_MIN_INTERVAL_MS = 4000;
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
const MARKET_SYMBOL = "BTC/USD";
type ShareOverlayTarget = {
  cellId: string;
  left: number;
  top: number;
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

function normalizeTimestampToMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value > 1_000_000_000_000 ? value : value * 1000;
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

function extractSuggestedStrategyCellIds(payload: unknown): string[] {
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
  rawCells.forEach((rawCell) => {
    if (!rawCell || typeof rawCell !== "object" || Array.isArray(rawCell)) {
      return;
    }

    const cell = rawCell as Record<string, unknown>;
    const startTs = normalizeTimestampToMs(cell.startTs);
    const endTs = normalizeTimestampToMs(cell.endTs);
    const lowerPrice = normalizePriceString(cell.lowerPrice);
    const upperPrice = normalizePriceString(cell.upperPrice);

    if (
      startTs === null ||
      endTs === null ||
      lowerPrice === null ||
      upperPrice === null
    ) {
      return;
    }

    cellIds.add(`${startTs}:${endTs}:${lowerPrice}:${upperPrice}`);
  });

  return [...cellIds];
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
// ─── Component ────────────────────────────────────────────────────────────────

export const TradingGrid: React.FC = () => {
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
  const updateGrid = useGameStore((s) => s.updateGrid);
  const updateOrder = useGameStore((s) => s.updateOrder);
  const betAmount = useGameStore((s) => s.betAmount);
  const balance = useGameStore((s) => s.balance);
  const serverTimeOffset = useGameStore((s) => s.serverTimeOffset);
  const { address } = useAccount();
  const { isAuthenticated, isLoggingIn, walletAddress } = useAuth();
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
      extractOrderFollowings(followingResponse).filter(
        (item) => item.status === "ACTIVE",
      ),
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
  const triggeredWinsRef = useRef<Set<string>>(new Set());
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
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [shareCellId, setShareCellId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
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
  const shareOverlayButtonRefs = useRef(
    new Map<string, HTMLButtonElement | null>(),
  );

  const isFollowTradeVisible = followTradeEnabled;
  const isSuggestedStrategyVisible = suggestedStrategyEnabled;
  const isFollowTradeConfigVisibleDraft =
    isOverlaySheetOpen && followTradeEnabledDraft;

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

  useEffect(() => {
    storeRef.current.suggestedStrategyCellIds = isSuggestedStrategyVisible
      ? suggestedStrategyCellIds
      : [];
  }, [isSuggestedStrategyVisible, suggestedStrategyCellIds]);

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

      if (elapsed >= OVERLAY_SOCKET_UPDATE_MIN_INTERVAL_MS) {
        applyFollowOverlayActivities(activities);
        return;
      }

      followOverlayPendingActivitiesRef.current = activities;
      if (followOverlayFlushTimerRef.current) return;

      const waitMs = OVERLAY_SOCKET_UPDATE_MIN_INTERVAL_MS - elapsed;
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

  const applySuggestedStrategyCellIds = useCallback((nextCellIds: string[]) => {
    lastSuggestedStrategyUpdateAtRef.current = Date.now();
    setSuggestedStrategyCellIds(nextCellIds);
  }, []);

  const queueSuggestedStrategyCellIds = useCallback(
    (nextCellIds: string[]) => {
      const now = Date.now();
      const elapsed = now - lastSuggestedStrategyUpdateAtRef.current;

      if (elapsed >= OVERLAY_SOCKET_UPDATE_MIN_INTERVAL_MS) {
        applySuggestedStrategyCellIds(nextCellIds);
        return;
      }

      suggestedStrategyPendingCellIdsRef.current = nextCellIds;
      if (suggestedStrategyFlushTimerRef.current) return;

      const waitMs = OVERLAY_SOCKET_UPDATE_MIN_INTERVAL_MS - elapsed;
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
      (!isFollowTradeVisible && !isFollowTradeConfigVisibleDraft)
    ) {
      return;
    }

    void refetchFollowing();
  }, [
    isAuthenticated,
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
      !resolvedWssKey ||
      enabledFollowTargetIds.length === 0 ||
      !resolvedUserAddress
    ) {
      return;
    }
    const userAddress = resolvedUserAddress;

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

      return signWssMessage(resolvedWssKey, userAddress, challenge);
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
    resolvedWssKey,
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
      );
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
      queueSuggestedStrategyCellIds(extractSuggestedStrategyCellIds(payload));
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
      );
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

  // ── Track wins (avoid repeated effects for the same cell id) ──────────────
  useEffect(() => {
    cells.forEach((cell) => {
      if (cell.status !== "hit") return;
      const hasBet =
        (bets[cell.id] || 0) > 0 || (pendingBets[cell.id] || 0) > 0;
      if (hasBet) triggeredWinsRef.current.add(cell.id);
    });
  }, [cells, bets, pendingBets]);

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

    priceMotionRef.current = {
      startPrice: cameraPriceRef.current,
      targetPrice: lastPoint.price,
      startTime:
        nowRef.current > 0 ? nowRef.current : Date.now() + serverTimeOffset,
      durationMs,
    };
    lastHistoryPointRef.current = {
      time: lastPoint.time,
      price: lastPoint.price,
    };
  }, [history, serverTimeOffset]);

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
  const selectedShareProfit = useMemo(
    () =>
      selectedShareAmount *
      Math.max((selectedShareCell?.multiplier ?? 0) - 1, 0),
    [selectedShareAmount, selectedShareCell?.multiplier],
  );
  const selectedShareTime = useMemo(() => {
    if (!selectedShareCell) return "--:--:--";
    return shareTimeFormatter.format(
      new Date(selectedShareCell.timeWindowStart),
    );
  }, [selectedShareCell]);
  const shareUrl = buildMiniAppReferralLink(MiniKit.user?.username);

  const handleOpenShareSheet = useCallback((cellId: string) => {
    setShareCellId(cellId);
    setIsShareSheetOpen(true);
  }, []);

  const handleCopyShareLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      appToast.success("Copied share link", { icon: "🔗" });
    } catch (error) {
      console.error("Failed to copy share link", error);
      appToast.error("Failed to copy share link", { icon: "⚠️" });
    }
  }, [shareUrl]);

  const handleShare = useCallback(async () => {
    try {
      setIsSharing(true);
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({
          title: "Join TickX",
          text: "Use my referral link to join TickX on World App.",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        appToast.success("Copied share link", { icon: "🔗" });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to share", error);
        appToast.error("Failed to share", { icon: "⚠️" });
      }
    } finally {
      setIsSharing(false);
    }
  }, [shareUrl]);

  const handleShareToWorldChat = useCallback(async () => {
    try {
      if (!MiniKit.isInWorldApp()) {
        appToast.error("WorldChat share is only available in World App", {
          icon: "⚠️",
        });
        return;
      }

      const resolvedAddress =
        MiniKit.user?.walletAddress ?? walletAddress ?? resolvedUserAddress;
      const miniAppUsername =
        MiniKit.user?.username?.trim() ??
        (resolvedAddress
          ? (await MiniKit.getUserByAddress(resolvedAddress)).username?.trim()
          : undefined);

      if (!miniAppUsername) {
        appToast.error("Missing World username", { icon: "⚠️" });
        return;
      }

      const referralLink = buildMiniAppReferralLink(miniAppUsername);
      const message = [
        "Use my referral to follow trade on TickX.",
        `Referral code: ${miniAppUsername}`,
        `Link: ${referralLink}`,
      ].join("\n");

      await MiniKit.chat({ message });
    } catch (error) {
      console.error("Failed to share to WorldChat", error);
      appToast.error("Failed to share to WorldChat", { icon: "⚠️" });
    }
  }, [resolvedUserAddress, walletAddress]);

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

  const syncShareOverlayPositions = useCallback(
    (targets: ShareOverlayTarget[]) => {
      const targetById = new Map(
        targets.map((target) => [target.cellId, target]),
      );
      for (const [cellId, node] of shareOverlayButtonRefs.current.entries()) {
        if (!node) continue;
        const nextTarget = targetById.get(cellId);
        if (!nextTarget) continue;
        node.style.transform = `translate3d(${nextTarget.left}px, ${nextTarget.top}px, 0)`;
      }
    },
    [],
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
      const hasAnyBet =
        (store.bets[cell.id] || 0) > 0 || (store.pendingBets[cell.id] || 0) > 0;
      if (!hasAnyBet) continue;

      const x = layout.toCanvasX(cell.timeWindowStart);
      const y = layout.toCellY(cell.priceLevel + layout.effectivePriceStep / 2);
      const w = layout.cellW;
      const h = layout.cellH;
      if (x + w < 0 || x > layout.w || y + h < 0 || y > layout.h) continue;

      nextShareTargets.push({
        cellId: cell.id,
        left: Math.max(4, Math.min(layout.w - 34, x + w - 30)),
        top: Math.max(4, Math.min(layout.h - 34, y + 4)),
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
    );
    drawPriceLine(ctx, layout, animatedPriceStore);
    drawPriceAxis(ctx, layout, animatedPriceStore, isMobile);
    drawTimeAxis(ctx, layout, isMobile);
    drawZoomIndicator(ctx, layout, tf.zoom);

    ctx.restore();
  }, [
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
        cameraPriceRef.current =
          motion.startPrice +
          (motion.targetPrice - motion.startPrice) * progress;

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
      const nextIdsHash = nextTargets.map((item) => item.cellId).join("|");
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
    ? "Waiting for live market grid..."
    : isLoggingIn
      ? "Authenticating wallet..."
      : address
        ? "Reconnecting to market feed..."
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
        <div className="pointer-events-none absolute inset-0 z-20">
          {shareOverlayTargets.map((target) => (
            <button
              key={target.cellId}
              ref={(node) => setShareOverlayButtonRef(target.cellId, node)}
              type="button"
              className="bg-background-main/90 border-border-main text-grid-accent pointer-events-auto absolute top-0 left-0 flex size-7 items-center justify-center rounded-md border shadow-[0_6px_18px_rgba(0,0,0,0.35)] will-change-transform"
              style={{
                transform: `translate3d(${target.left}px, ${target.top}px, 0)`,
              }}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenShareSheet(target.cellId);
              }}
              aria-label="Share winning cell"
            >
              <Share2 className="size-3.5" strokeWidth={2} />
            </button>
          ))}
        </div>

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
                          onClick={handleCopyShareLink}
                          aria-label="Copy share link"
                        >
                          <Copy className="size-4" strokeWidth={1.9} />
                        </button>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="bg-primary-medium text-text-inverse hover:bg-primary-light h-11 rounded-[8px] text-base font-medium tracking-[-0.01em]"
                      onClick={handleShare}
                      disabled={isSharing}
                    >
                      <Share2 className="mr-2 size-4" strokeWidth={1.9} />
                      {isSharing ? "Sharing..." : "Share"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-primary-light text-text-heading hover:bg-surface-overlay-subtle h-11 rounded-[8px] bg-transparent text-base font-medium tracking-[-0.01em]"
                      onClick={handleShareToWorldChat}
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
