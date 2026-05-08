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
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { MiniKit } from "@worldcoin/minikit-js";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { MOBILE_VIEWPORT_BREAKPOINT_PX } from "@/src/constants";
import { extractOrderFollowings } from "@/src/features/trade/orderFollow";
import { getLatestChartTime } from "@/src/features/trade/gridTiming";
import { useGameStore } from "@/src/features/trade/store";
import { appToast } from "@/src/features/trade/toast";
import {
  getOrderFollowControllerListFollowingQueryKey,
  useAccountControllerGetBalance,
  useOrderControllerGetUserOrders,
  useOrderFollowControllerListFollowing,
  useOrderFollowControllerRegister,
} from "@/src/services/queries";
import {
  clampTransformToDataBounds,
  computeLayout,
  getGridViewportChrome,
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
import useWldUsdPrice from "@/src/hooks/useWldUsdPrice";
import {
  DEFAULT_DESKTOP_ZOOM,
  DEFAULT_MOBILE_ZOOM,
  DESKTOP_ZOOM_MIN,
  FOLLOW_OVERLAY_SOCKET_UPDATE_MIN_INTERVAL_MS,
  FOLLOW_REFERRAL_STATS,
  LARGE_MOVE_DURATION_FACTOR_MIN,
  LARGE_MOVE_STEPS_FULL,
  LARGE_MOVE_STEPS_START,
  livePriceFormatter,
  MAX_PRICE_MOTION_MS,
  MIN_PRICE_MOTION_MS,
  MOBILE_ZOOM_MIN,
  RESIZE_COMMIT_DEBOUNCE_MS,
  SUGGESTED_STRATEGY_MIN_HOLD_MS,
  TICK_CADENCE_SMOOTHING,
} from "./tradingGrid.constants";
import { BalanceChip, WinBetBanner } from "./tradingGrid.ui";
import {
  FollowReferralDialog,
  TradingGridTopBar,
  TradingInfoSheet,
  TradingOrdersSheet,
  TradingOverlaySheet,
  TradingShareSheet,
} from "./tradingGrid.panels";
import {
  ShareButtonsLayer,
  WinEffectsLayer,
} from "./tradingGrid.canvasOverlays";
import {
  areBooleanMapsEqual,
  buildDisplayHistory,
  easeOutCubic,
  FollowOverlayActivity,
  formatWalletShort,
  isCellIdStillAheadOfChart,
  normalizeReferralCode,
  parseAddress,
  ShareOverlayTarget,
} from "./tradingGrid.utils";
import { useTradingGridSocketEffects } from "@/src/features/trade/hooks/useTradingGridSocketEffects";
import { useMarketSelector } from "@/src/features/trade/hooks/useMarketSelector";
import { useShareSheetData } from "@/src/features/trade/hooks/useShareSheetData";
import { useShareOverlayPositioning } from "@/src/features/trade/hooks/useShareOverlayPositioning";
import { useWinEffectTracking } from "@/src/features/trade/hooks/useWinEffectTracking";
import useWinNotificationToast from "@/src/features/trade/hooks/useWinNotificationToast";

type TradingGridProps = {
  initialFollowRefCode?: string | null;
};

const SHARE_BUTTON_HIDE_ZOOM_THRESHOLD = 0.3;

function isMobileViewport(width: number): boolean {
  return width < MOBILE_VIEWPORT_BREAKPOINT_PX;
}

function getViewportDefaultZoom(isMobile: boolean): number {
  return isMobile ? DEFAULT_MOBILE_ZOOM : DEFAULT_DESKTOP_ZOOM;
}

export const TradingGrid: React.FC<TradingGridProps> = ({
  initialFollowRefCode = null,
}) => {
  const queryClient = useQueryClient();
  const { data: wldUsdPrice } = useWldUsdPrice();
  // ── Store selectors ────────────────────────────────────────────────────────
  // Read-only slices from zustand store for render + side-effects.
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
  const upsertFollowedOrderActivity = useGameStore(
    (s) => s.upsertFollowedOrderActivity,
  );
  const updatePrice = useGameStore((s) => s.updatePrice);
  const hydrateHistory = useGameStore((s) => s.hydrateHistory);
  const updateGrid = useGameStore((s) => s.updateGrid);
  const updateOrder = useGameStore((s) => s.updateOrder);
  const cancelPendingBet = useGameStore((s) => s.cancelPendingBet);
  const resetGridData = useGameStore((s) => s.resetGridData);
  const isDesktopOrdersVisible = useGameStore((s) => s.isDesktopOrdersVisible);
  const setDesktopOrdersPanel = useGameStore((s) => s.setDesktopOrdersPanel);

  // Market selector drives REST/socket endpoints and resets grid state on change.
  // onMarketReset is wired after refs/setters are declared (see useCallback below).
  // We use a stable ref so useMarketSelector's useCallback dep doesn't need the full
  // closure — the ref is updated each render.
  const onMarketResetRef = useRef<() => void>(() => {});
  const {
    selectedMarketSymbol,
    selectedMarketId,
    marketSocketPath,
    handleMarketChange,
  } = useMarketSelector({
    resetGridData,
    onMarketReset: useCallback(() => onMarketResetRef.current(), []),
  });

  const betAmount = useGameStore((s) => s.betAmount);
  const balance = useGameStore((s) => s.balance);
  const serverTimeOffset = useGameStore((s) => s.serverTimeOffset);
  const priceStepChangedAt = useGameStore((s) => s.priceStepChangedAt);
  const { address } = useAccount();
  const { isAuthenticated, isLoggingIn, username, walletAddress } = useAuth();
  // Resolve the active user wallet from World App first, then auth provider, then wagmi.
  const isMiniApp = MiniKit.isInWorldApp();
  const miniKitWalletAddress = isMiniApp
    ? (MiniKit.user?.walletAddress ?? null)
    : null;
  const resolvedUserAddress = useMemo(
    () =>
      parseAddress(miniKitWalletAddress ?? walletAddress ?? address ?? null),
    [address, miniKitWalletAddress, walletAddress],
  );
  // Queries used by grid auth, follow trade and user balance/order hydration.
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
  const { data: userOrdersResponse, isFetched: isUserOrdersFetched } =
    useOrderControllerGetUserOrders(
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

  // Derived follow-trade options after status normalization + wallet de-duplication.
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
  // Imperative canvas DOM handles and remount key (used after major resize/market reset).
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canvasInstanceKey, setCanvasInstanceKey] = useState(0);
  const [isCompactZoomForShare, setIsCompactZoomForShare] = useState(false);
  const [overlayPlotBounds, setOverlayPlotBounds] = useState({
    width: 0,
    height: 0,
  });

  // Live values in refs keep the animation loop stable without hook dependency churn.
  const initialIsMobile =
    typeof window !== "undefined" ? isMobileViewport(window.innerWidth) : false;
  const initialDefaultZoom = getViewportDefaultZoom(initialIsMobile);
  const nowRef = useRef(0);
  const cameraPriceRef = useRef(currentPrice || 0);
  const isMobileRef = useRef(initialIsMobile);
  const sizeRef = useRef({ w: 0, h: 0 });
  const getDefaultZoom = useCallback(
    () => getViewportDefaultZoom(isMobileRef.current),
    [],
  );
  const getMinZoom = useCallback(
    () => (isMobileRef.current ? MOBILE_ZOOM_MIN : DESKTOP_ZOOM_MIN),
    [],
  );
  const transformRef = useRef<Transform>({
    offsetX: 0,
    offsetY: 0,
    zoom: initialDefaultZoom,
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
  const compactZoomForShareRef = useRef(false);
  const previewCellIdRef = useRef<string | null>(null);
  // Keep backing store size in sync with DPR for sharp rendering on high-density screens.
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
      // Draw immediately after mount so the first frame appears without waiting for next rAF tick.
      if (node) drawRef.current();
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
    marketId: selectedMarketId,
    betAmount,
    balance,
    socket,
    wssKey,
    address: resolvedUserAddress,
    wldUsdPrice:
      typeof wldUsdPrice === "number" && Number.isFinite(wldUsdPrice)
        ? wldUsdPrice
        : null,
    followedOrderActivities,
    suggestedStrategyCellIds: [],
    dims: null,
  });
  useEffect(() => {
    if (priceStepChangedAt === null) return;
    appToast.warning(
      "Price range updated — your bets are cleared from view, but will still settle normally.",
    );
    // Win-effect ref resets on price-step change are handled inside useWinEffectTracking.
  }, [priceStepChangedAt]);

  useLayoutEffect(() => {
    // Recompute dims only when cells change — avoids Map/sort allocation every frame.
    const prevCells = storeRef.current.cells;
    const nextDims =
      cells !== prevCells
        ? computeGridDimensions(
            cells
              .filter((c) => c.status !== "hit" && c.status !== "lose")
              .map((c) => ({
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
      marketId: selectedMarketId,
      betAmount,
      balance,
      socket,
      wssKey,
      address: resolvedUserAddress,
      wldUsdPrice:
        typeof wldUsdPrice === "number" && Number.isFinite(wldUsdPrice)
          ? wldUsdPrice
          : null,
      followedOrderActivities,
      suggestedStrategyCellIds: storeRef.current.suggestedStrategyCellIds,
      dims: nextDims,
    };
  });

  // `isReady` gates data layers so the user does not see partially hydrated frames.
  const [isReady, setIsReady] = useState(false);

  // Clear stale store data from the previous mount so the loading gate
  // waits for a fresh grid_update from the socket, not leftover cells.
  useEffect(() => {
    resetGridData();
  }, [resetGridData]);

  // Overlay mode toggles. Suggested strategy and follow trade are mutually exclusive.
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
  const [isOrdersSheetOpen, setIsOrdersSheetOpen] = useState(false);
  const [ordersSheetQueryAnchorTime, setOrdersSheetQueryAnchorTime] =
    useState<number | null>(null);
  // ── Share sheet data (amounts / profit / ROI / win-rate) ──────────────────
  const {
    shareCellId,
    setShareCellId,
    isShareSheetOpen,
    setIsShareSheetOpen,
    handleOpenShareSheet,
    selectedShareCell,
    selectedShareAmount,
    selectedShareAmountUsd,
    selectedShareProfit,
    selectedShareProfitUsd,
    selectedShareTime,
    selectedShareRoi,
    shareWinRate,
    selectedShareProfitApproxUsd: _selectedShareProfitApproxUsd,
  } = useShareSheetData({
    cells,
    bets,
    pendingBets,
    betAmount,
    settledOutcomes,
    wldUsdPrice: typeof wldUsdPrice === "number" ? wldUsdPrice : null,
  });

  // ── Share overlay positioning (button + win-effect icon refs / positions) ──
  const {
    shareOverlayTargets,
    setShareOverlayTargets,
    shareTargetsRef,
    shareTargetIdsHashRef,
    setShareOverlayButtonRef,
    setWinEffectIconRef,
    syncShareOverlayPositions,
  } = useShareOverlayPositioning();

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
  // Throttle refs for follow overlay and suggested strategy updates.
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
  const isReadyRef = useRef(false);
  const dataReadyAtRef = useRef<number | null>(null);

  const isFollowTradeVisible = followTradeEnabled;
  const isSuggestedStrategyVisible = suggestedStrategyEnabled;
  const isFollowTradeConfigVisibleDraft =
    isOverlaySheetOpen && followTradeEnabledDraft;
  const winToastData = useWinNotificationToast({
    socket,
    marketId: selectedMarketId,
    wldUsdPrice:
      typeof wldUsdPrice === "number" && Number.isFinite(wldUsdPrice)
        ? wldUsdPrice
        : null,
  });

  const enabledFollowTargetIds = useMemo(
    () =>
      availableFollowTargetIds.filter(
        (targetUserId) => followTradeTargetEnabled[targetUserId] === true,
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
  const canTrackWinEffects = !isAuthenticated || isUserOrdersFetched;

  // ── Win-effect tracking ───────────────────────────────────────────────────
  const {
    activeWinEffectByCellId,
    setActiveWinEffectByCellId,
    activeWinEffectCellIdSet,
    previousWinningCellIdsRef,
    hasInitializedWinEffectTrackingRef,
  } = useWinEffectTracking({
    cells,
    bets,
    pendingBets,
    pendingWins,
    settledOutcomes,
    canTrackWinEffects,
    priceStepChangedAt,
  });
  // Follow-trade currently supports selecting exactly one target at a time.
  const ensureSingleFollowTargetConfig = useCallback(
    (source: Record<string, boolean>) => {
      const nextConfig: Record<string, boolean> = {};
      const hasAnyExplicitValue = availableFollowTargetIds.some(
        (targetUserId) => source[targetUserId] !== undefined,
      );
      let selectedTargetUserId =
        availableFollowTargetIds.find(
          (targetUserId) => source[targetUserId] === true,
        ) ?? null;

      if (!selectedTargetUserId && !hasAnyExplicitValue) {
        selectedTargetUserId = availableFollowTargetIds[0] ?? null;
      }

      availableFollowTargetIds.forEach((targetUserId) => {
        nextConfig[targetUserId] = selectedTargetUserId === targetUserId;
      });
      return nextConfig;
    },
    [availableFollowTargetIds],
  );
  useEffect(() => {
    setFollowTradeTargetEnabled((currentValue) => {
      const nextValue = ensureSingleFollowTargetConfig(currentValue);
      return areBooleanMapsEqual(currentValue, nextValue)
        ? currentValue
        : nextValue;
    });
    setFollowTradeTargetEnabledDraft((currentValue) => {
      const nextValue = ensureSingleFollowTargetConfig(currentValue);
      return areBooleanMapsEqual(currentValue, nextValue)
        ? currentValue
        : nextValue;
    });
  }, [ensureSingleFollowTargetConfig]);
  // Sheet-ready follow target options (label/subtitle/enabled) for UI rendering.
  const followTradeTargetsDraft = useMemo(
    () =>
      availableFollowTargets.map((target) => ({
        id: target.targetUserId,
        label: target.targetUsername ?? formatWalletShort(target.targetUserId),
        subtitle: formatWalletShort(target.targetUserId),
        enabled: followTradeTargetEnabledDraft[target.targetUserId] === true,
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
  const followReferralStats = FOLLOW_REFERRAL_STATS;

  // Resolve referral input to a canonical wallet address (address literal or @username).
  const resolveFollowTargetWallet = useCallback(async (refCode: string) => {
    const normalizedRefCode = normalizeReferralCode(refCode);
    if (!normalizedRefCode) {
      throw new Error("Missing referral code");
    }

    const directWalletAddress = parseAddress(normalizedRefCode);
    if (directWalletAddress) {
      return directWalletAddress;
    }

    const normalizedUsername = normalizedRefCode.replace(/^@/, "").trim();
    if (!normalizedUsername) {
      throw new Error("Missing referral username");
    }

    const user = await MiniKit.getUserByUsername(normalizedUsername);
    const walletAddressFromUsername = parseAddress(user.walletAddress);
    if (!walletAddressFromUsername) {
      throw new Error("Cannot resolve target wallet from referral code");
    }

    const userByAddress = await MiniKit.getUserByAddress(
      walletAddressFromUsername,
    );
    return (
      parseAddress(userByAddress.walletAddress) ?? walletAddressFromUsername
    );
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

  // Confirm flow for referral modal:
  // 1) ensure signed-in state
  // 2) resolve wallet target
  // 3) register follow relation
  // 4) refresh following list + enable follow-trade mode
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
      const targetUserId =
        resolvedFollowTargetWallet ??
        (await resolveFollowTargetWallet(followReferralCode));

      if (activeFollowingTargetIds.has(targetUserId)) {
        setSuggestedStrategyEnabled(false);
        setSuggestedStrategyEnabledDraft(false);
        setFollowTradeEnabled(true);
        setFollowTradeEnabledDraft(true);
        setFollowTradeTargetEnabled((prev) =>
          ensureSingleFollowTargetConfig({
            ...prev,
            [targetUserId]: true,
          }),
        );
        setFollowTradeTargetEnabledDraft((prev) =>
          ensureSingleFollowTargetConfig({
            ...prev,
            [targetUserId]: true,
          }),
        );
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

      setSuggestedStrategyEnabled(false);
      setSuggestedStrategyEnabledDraft(false);
      setFollowTradeEnabled(true);
      setFollowTradeEnabledDraft(true);
      setFollowTradeTargetEnabled((prev) =>
        ensureSingleFollowTargetConfig({
          ...prev,
          [targetUserId]: true,
        }),
      );
      setFollowTradeTargetEnabledDraft((prev) =>
        ensureSingleFollowTargetConfig({
          ...prev,
          [targetUserId]: true,
        }),
      );
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
    ensureSingleFollowTargetConfig,
    followReferralCode,
    handleCloseFollowReferralModal,
    isAuthenticated,
    isLoggingIn,
    queryClient,
    refetchFollowing,
    registerOrderFollow,
    resolveFollowTargetWallet,
    resolvedFollowTargetWallet,
  ]);

  // Keep storeRef overlay data in sync with UI toggles so draw() can read directly from refs.
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

  // Apply follow overlay activities with throttling to avoid high-frequency socket churn.
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

  // Merge current + incoming suggested cells and remove cells that are already behind chart head.
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

  // Reset queue state when follow-trade overlay is hidden.
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

  // Reset queue state when suggested-strategy overlay is hidden.
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

  // Cleanup pending timers on unmount.
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

  // Lazy-refresh following list only when any follow-related UI is visible.
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

  // Socket hook hydrates grid/history, order state, follow activities and strategy suggestions.
  useTradingGridSocketEffects({
    marketId: selectedMarketId,
    marketSocketPath,
    updatePrice,
    updateGrid,
    hydrateHistory,
    isAuthenticated,
    resolvedUserAddress,
    isFollowTradeVisible,
    enabledFollowTargetIds,
    enabledFollowTargetsKey,
    queueFollowOverlayActivities,
    isSuggestedStrategyVisible,
    queueSuggestedStrategyCellIds,
    balanceResponse,
    userOrdersResponse,
    updateOrder,
    cancelPendingBet,
    pendingBets,
    storeRef,
  });

  // Convert incoming history ticks into smooth price-motion segments for the line renderer.
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

    const applySize = (w: number, h: number) => {
      sizeRef.current = { w, h };
      isMobileRef.current = isMobileViewport(window.innerWidth);
      const chrome = getGridViewportChrome(w);
      setOverlayPlotBounds({
        width: Math.max(0, w - chrome.priceAxisWidth),
        height: Math.max(0, h - chrome.timeAxisHeight),
      });
      const minZoom = getMinZoom();
      if (transformRef.current.zoom < minZoom) {
        transformRef.current = { ...transformRef.current, zoom: minZoom };
      }
      transformRef.current = clampTransformToDataBounds(
        transformRef.current,
        sizeRef.current,
        nowRef.current,
        cameraPriceRef.current,
        storeRef.current,
      );
      const cv = canvasRef.current;
      if (cv) syncCanvasSize(cv);
    };

    let initialised = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const rect = entry.contentRect;
      const w = rect.width;
      const h = rect.height;
      if (w === 0 && h === 0) return;

      if (!initialised) {
        // First fire: real dimensions available — apply and mount canvas.
        // isReady starts false; handleCanvasRef will set it true after first draw.
        initialised = true;
        applySize(w, h);
        setCanvasInstanceKey((k) => k + 1);
        return;
      }

      // Subsequent fires (user resizes window): debounce then reset canvas.
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        applySize(w, h);
        isReadyRef.current = false;
        setIsReady(false);
        setCanvasInstanceKey((k) => k + 1);
      }, RESIZE_COMMIT_DEBOUNCE_MS);
    });

    ro.observe(el);

    return () => {
      ro.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [getMinZoom, syncCanvasSize]);

  // ── Hit-test ───────────────────────────────────────────────────────────────
  // Strict hit-test for betting: only returns a currently valid/interactive cell.
  // This is used by click/tap handlers before calling placeBet.
  const hitTest = useCallback((cx: number, cy: number) => {
    const boundedTransform = clampTransformToDataBounds(
      transformRef.current,
      sizeRef.current,
      nowRef.current,
      cameraPriceRef.current,
      storeRef.current,
    );
    const layout = computeLayout(
      boundedTransform,
      sizeRef.current,
      nowRef.current,
      cameraPriceRef.current,
      storeRef.current,
    );
    return hitTestCell(cx, cy, layout, storeRef.current, nowRef.current);
  }, []);

  // Broad hit-test for hover/preview UX: returns any cell under pointer
  // (even when it cannot be bet right now).
  const hitTestAny = useCallback((cx: number, cy: number) => {
    const boundedTransform = clampTransformToDataBounds(
      transformRef.current,
      sizeRef.current,
      nowRef.current,
      cameraPriceRef.current,
      storeRef.current,
    );
    const layout = computeLayout(
      boundedTransform,
      sizeRef.current,
      nowRef.current,
      cameraPriceRef.current,
      storeRef.current,
    );
    return hitTestAnyCell(cx, cy, layout, storeRef.current);
  }, []);

  // ── Draw ───────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const tf = clampTransformToDataBounds(
      transformRef.current,
      sizeRef.current,
      nowRef.current,
      cameraPriceRef.current,
      storeRef.current,
    );
    if (tf !== transformRef.current) {
      transformRef.current = tf;
    }
    const layout = computeLayout(
      tf,
      sizeRef.current,
      nowRef.current,
      cameraPriceRef.current,
      storeRef.current,
    );
    const store = storeRef.current;
    const isMobile = isMobileRef.current;
    // Render-time store projection:
    // - smooth display history while animating line
    // - filter follow activities by enabled target
    // - optionally include suggested cells
    const animatedPriceStore = {
      ...store,
      history: buildDisplayHistory(
        store.history,
        nowRef.current,
        cameraPriceRef.current,
        priceMotionRef.current !== null,
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
    const shouldHideShareButtons = tf.zoom < SHARE_BUTTON_HIDE_ZOOM_THRESHOLD;
    if (compactZoomForShareRef.current !== shouldHideShareButtons) {
      compactZoomForShareRef.current = shouldHideShareButtons;
      setIsCompactZoomForShare(shouldHideShareButtons);
    }
    // Compute share/win overlay anchor positions from currently visible winning cells.
    const nextShareTargets: ShareOverlayTarget[] = [];
    for (const cell of store.cells) {
      if (cell.status !== "hit") continue;
      const hasTrackedStake =
        (store.bets[cell.id] || 0) > 0 ||
        (store.pendingBets[cell.id] || 0) > 0 ||
        store.pendingWins[cell.id] !== undefined ||
        store.settledOutcomes[cell.id] !== undefined;
      if (!hasTrackedStake) continue;

      const xRaw = layout.toCanvasX(cell.timeWindowStart);
      const y = layout.toCellY(cell.priceLevel + layout.effectivePriceStep / 2);
      const w = layout.cellW;
      const h = layout.cellH;
      if (
        xRaw > layout.plotRight ||
        xRaw + w < 0 ||
        y + h < 0 ||
        y > layout.plotBottom
      ) {
        continue;
      }
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
        left: xRaw + w - buttonSize - inset,
        top: Math.max(0, Math.min(layout.plotBottom - buttonSize, y + inset)),
        centerLeft: xRaw + w / 2,
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
    // While loading, keep only the background grid visible. Data-driven layers
    // (cells/line/axes) render after readiness gate opens.
    if (!isReadyRef.current) {
      ctx.restore();
      return;
    }

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

  // Keep drawRef in sync so the resize observer always calls the latest draw.
  useEffect(() => {
    drawRef.current = draw;
  });

  // ── Animation loop ─────────────────────────────────────────────────────────
  // Keep `nowRef` aligned whenever server offset changes.
  useEffect(() => {
    nowRef.current = Date.now() + serverTimeOffset;
  }, [serverTimeOffset]);

  // On visibility resume: snap animation state to present so the line never
  // replays the hidden-tab gap. Store data (cells, history) is kept as-is —
  // no reload needed, the rAF loop will continue rendering from current state.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const { serverTimeOffset: offset, currentPrice: target } =
        useGameStore.getState();
      nowRef.current = Date.now() + offset;
      if (target !== 0) cameraPriceRef.current = target;
      priceMotionRef.current = null;
      lastHistoryPointRef.current = null;
      dataReadyAtRef.current = null;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    // Main render loop:
    // advances time, animates camera price, checks win transitions and paints canvas.
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

      // Page hidden: skip draw and animation to avoid accumulating a gap that
      // would replay as a sudden jump when the user returns.
      if (document.visibilityState !== "visible") {
        if (target !== 0) cameraPriceRef.current = target;
        priceMotionRef.current = null;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

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

      // Reveal the grid once canvas has size, grid cells and price history have
      // both arrived from the socket, and 300 ms have passed since that moment.
      // The delay lets the canvas paint 2-3 complete frames so there is no
      // flash of partial data when the overlay lifts.
      if (!isReadyRef.current) {
        const hasData =
          sizeRef.current.w > 0 &&
          state.cells.length > 0 &&
          state.history.length > 0 &&
          target !== 0;

        if (hasData) {
          if (dataReadyAtRef.current === null) {
            dataReadyAtRef.current = loopNow;
          } else if (loopNow - dataReadyAtRef.current >= 300) {
            isReadyRef.current = true;
            setIsReady(true);
          }
        } else {
          dataReadyAtRef.current = null;
        }
      }

      // Sync HTML overlays to latest canvas geometry.
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
  // Centralized pointer/touch interaction for the grid:
  // - resolve pointer -> cell via hitTest/hitTestAny
  // - trigger placeBet on click/tap when target cell is eligible
  // - manage preview, drag-pan and zoom state
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
    getDefaultZoom,
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

  // Top-bar display helpers.
  const displayPrice =
    currentPrice > 0 ? livePriceFormatter.format(currentPrice) : "--";
  const displayMarketPrice =
    displayPrice === "--" ? displayPrice : `~ ${displayPrice}`;
  const latestGridTime = useMemo(
    () => getLatestChartTime(history, Date.now()),
    [history],
  );
  const handleRecenterGrid = useCallback(() => {
    clearPreviewCell();
    resetTransform();
  }, [clearPreviewCell, resetTransform]);
  const handleOpenOrders = useCallback(() => {
    if (isMobileRef.current) {
      setOrdersSheetQueryAnchorTime(latestGridTime);
      setIsOrdersSheetOpen(true);
      return;
    }

    if (isDesktopOrdersVisible) {
      setDesktopOrdersPanel(false);
      return;
    }

    setDesktopOrdersPanel(true, latestGridTime);
  }, [isDesktopOrdersVisible, latestGridTime, setDesktopOrdersPanel]);
  // Wire the market-reset callback so useMarketSelector can trigger it.
  // Keep a stable ref so the hook's useCallback dep doesn't churn; the ref is
  // updated via useEffect after each render so it always calls the latest closure.
  const doMarketReset = useCallback(() => {
    cameraPriceRef.current = 0;
    priceMotionRef.current = null;
    lastHistoryPointRef.current = null;
    tickCadenceMsRef.current = 1000;
    previousWinningCellIdsRef.current = new Set();
    hasInitializedWinEffectTrackingRef.current = false;
    isReadyRef.current = false;
    dataReadyAtRef.current = null;
    previewCellIdRef.current = null;
    setActiveWinEffectByCellId({});
    setSuggestedStrategyCellIds([]);
    setIsReady(false);
    setCanvasInstanceKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    onMarketResetRef.current = doMarketReset;
  }, [doMarketReset]);
  // Open overlay sheet from current committed mode into editable draft state.
  const handleOpenOverlaySheet = useCallback(() => {
    const nextSuggestedStrategyEnabled = suggestedStrategyEnabled;
    const nextFollowTradeEnabled =
      followTradeEnabled && !nextSuggestedStrategyEnabled;
    setSuggestedStrategyEnabledDraft(nextSuggestedStrategyEnabled);
    setFollowTradeEnabledDraft(nextFollowTradeEnabled);
    setFollowTradeTargetEnabledDraft(followTradeTargetEnabled);
    setIsOverlaySheetOpen(true);
  }, [followTradeEnabled, followTradeTargetEnabled, suggestedStrategyEnabled]);

  // Close overlay sheet and discard draft-only changes.
  const handleCloseOverlaySheet = useCallback(() => {
    const nextSuggestedStrategyEnabled = suggestedStrategyEnabled;
    const nextFollowTradeEnabled =
      followTradeEnabled && !nextSuggestedStrategyEnabled;
    setSuggestedStrategyEnabledDraft(nextSuggestedStrategyEnabled);
    setFollowTradeEnabledDraft(nextFollowTradeEnabled);
    setFollowTradeTargetEnabledDraft(followTradeTargetEnabled);
    setIsOverlaySheetOpen(false);
  }, [followTradeEnabled, followTradeTargetEnabled, suggestedStrategyEnabled]);

  const handleSuggestedStrategyDraftChange = useCallback(
    (nextValue: boolean) => {
      setSuggestedStrategyEnabledDraft(nextValue);
      if (nextValue) {
        setFollowTradeEnabledDraft(false);
      }
    },
    [],
  );
  const handleFollowTradeDraftChange = useCallback((nextValue: boolean) => {
    setFollowTradeEnabledDraft(nextValue);
    if (nextValue) {
      setSuggestedStrategyEnabledDraft(false);
    }
  }, []);
  const handleFollowTradeTargetDraftChange = useCallback(
    (targetUserId: string, nextValue: boolean) => {
      setFollowTradeTargetEnabledDraft((currentValue) =>
        ensureSingleFollowTargetConfig({
          ...currentValue,
          [targetUserId]: nextValue,
        }),
      );
    },
    [ensureSingleFollowTargetConfig],
  );
  // Commit draft settings to active overlay mode.
  const handleApplyOverlayMode = useCallback(() => {
    const nextSuggestedStrategyEnabled = suggestedStrategyEnabledDraft;
    const nextFollowTradeEnabled =
      followTradeEnabledDraft && !nextSuggestedStrategyEnabled;
    const nextFollowTradeTargetEnabled = ensureSingleFollowTargetConfig(
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
    ensureSingleFollowTargetConfig,
    followTradeEnabledDraft,
    followTradeTargetEnabledDraft,
    suggestedStrategyEnabledDraft,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background-grid relative flex flex-1 flex-col overflow-hidden font-mono">
      <TradingGridTopBar
        selectedMarketSymbol={selectedMarketSymbol}
        displayMarketPrice={displayMarketPrice}
        isSuggestedStrategyVisible={isSuggestedStrategyVisible}
        isFollowTradeVisible={isFollowTradeVisible}
        isOrdersVisible={isMobileRef.current ? isOrdersSheetOpen : isDesktopOrdersVisible}
        onMarketChange={handleMarketChange}
        onOpenInfo={() => setIsInfoSheetOpen(true)}
        onOpenOrders={handleOpenOrders}
        onOpenOverlay={handleOpenOverlaySheet}
        onRecenter={handleRecenterGrid}
      />

      {/* Canvas wrapper */}
      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden"
        style={{
          background: COLOR_BG,
          cursor: isDragging ? "grabbing" : "crosshair",
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
        <WinEffectsLayer
          shareOverlayTargets={shareOverlayTargets}
          activeWinEffectCellIdSet={activeWinEffectCellIdSet}
          activeWinEffectByCellId={activeWinEffectByCellId}
          setWinEffectIconRef={setWinEffectIconRef}
          wldUsdPrice={wldUsdPrice}
          plotWidth={overlayPlotBounds.width}
          plotHeight={overlayPlotBounds.height}
        />
        {!isCompactZoomForShare ? (
          <ShareButtonsLayer
            shareOverlayTargets={shareOverlayTargets}
            setShareOverlayButtonRef={setShareOverlayButtonRef}
            handleOpenShareSheet={handleOpenShareSheet}
            plotWidth={overlayPlotBounds.width}
            plotHeight={overlayPlotBounds.height}
          />
        ) : null}

        {winToastData ? (
          <div className="pointer-events-none absolute top-11 left-3 z-20 sm:top-12 sm:left-4">
            <WinBetBanner data={winToastData} />
          </div>
        ) : null}

        {!isReady && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="border-grid-line-strong bg-background-grid/80 flex items-center gap-2.5 rounded-sm border px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
              <div className="border-grid-accent/40 border-t-grid-accent h-4 w-4 shrink-0 animate-spin rounded-full border-2" />
              <span className="text-text-sub font-mono text-xs font-medium tracking-wide">
                Preparing market grid...
              </span>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-6 left-3 z-20 sm:bottom-4 sm:left-4">
          <BalanceChip balance={balance} />
        </div>
      </div>

      <FollowReferralDialog
        isOpen={isFollowReferralModalOpen}
        onOpenChange={handleFollowReferralModalOpenChange}
        followReferralCode={followReferralCode}
        followReferralHandle={followReferralHandle}
        isFollowReferralAlreadyActive={isFollowReferralAlreadyActive}
        resolvedFollowTargetWallet={resolvedFollowTargetWallet}
        followReferralStats={followReferralStats}
        formatWalletShort={formatWalletShort}
        isSubmittingFollowReferral={isSubmittingFollowReferral}
        onCancel={handleCloseFollowReferralModal}
        onConfirm={() => void handleFollowByReferral()}
      />

      <TradingInfoSheet
        isOpen={isInfoSheetOpen}
        onClose={() => setIsInfoSheetOpen(false)}
        marketSymbol={selectedMarketSymbol}
        displayPrice={displayPrice}
      />

      <TradingOverlaySheet
        isOpen={isOverlaySheetOpen}
        onClose={handleCloseOverlaySheet}
        suggestedStrategyEnabledDraft={suggestedStrategyEnabledDraft}
        followTradeEnabledDraft={followTradeEnabledDraft}
        followTradeTargetsDraft={followTradeTargetsDraft}
        isFollowingFetching={isFollowingFetching}
        onSuggestedStrategyDraftChange={handleSuggestedStrategyDraftChange}
        onFollowTradeDraftChange={handleFollowTradeDraftChange}
        onFollowTradeTargetDraftChange={handleFollowTradeTargetDraftChange}
        onApplyOverlayMode={handleApplyOverlayMode}
      />

      <TradingOrdersSheet
        isOpen={isOrdersSheetOpen}
        onClose={() => setIsOrdersSheetOpen(false)}
        marketSymbol={selectedMarketSymbol}
        queryAnchorTime={ordersSheetQueryAnchorTime}
      />

      <TradingShareSheet
        isOpen={isShareSheetOpen}
        onClose={() => setIsShareSheetOpen(false)}
        marketSymbol={selectedMarketSymbol}
        selectedShareCell={selectedShareCell}
        selectedShareAmountUsd={selectedShareAmountUsd}
        selectedShareTime={selectedShareTime}
        selectedShareProfitUsd={selectedShareProfitUsd}
        shareUrl={shareUrl}
        copyShareLink={copyShareLink}
        isSharing={isSharing}
        share={share}
        shareToWorldChat={shareToWorldChat}
        shareWinRate={shareWinRate}
        selectedShareRoi={selectedShareRoi}
      />
    </div>
  );
};
