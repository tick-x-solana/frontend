import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  authControllerGetChallenge,
  authControllerGetWssKey,
} from "@/src/services/queries";
import { signWssMessage } from "@/src/features/trade/socketSignature";
import { useGameStore } from "@/src/features/trade/store";
import type { CellData, RemoteCell } from "@/src/features/trade/store";
import {
  extractFollowedOrderActivities,
  extractWssKey,
  extractWssKeyExpiry,
} from "@/src/features/trade/orderFollow";
import {
  BALANCE_UPDATE_EVENT,
  CORE_SOCKET_PATH,
  FORTRESS_MC_DIAGNOSTICS_EVENT,
  FOLLOW_ORDER_EVENTS,
  FOLLOWED_ORDER_UPDATE_EVENT,
  ORDER_UPDATE_EVENT,
  SUBSCRIBE_ORDER_FOLLOWS_EVENT,
  SUBSCRIBE_SUGGESTED_STRATEGY_EVENT,
  SUBSCRIBE_USER_EVENT,
  SUGGESTED_STRATEGY_UPDATE_EVENT,
  TRADE_SOCKET_BASE_URL,
  UNSUBSCRIBE_ORDER_FOLLOWS_EVENT,
} from "@/src/features/trade/components/tradingGrid.constants";
import {
  extractBalanceAmount,
  extractBalanceUserId,
  extractBinanceKlineHistory,
  extractChallenge,
  extractSuggestedStrategyCellIds,
  extractUserOrders,
  parseAddress,
  resolveGridCellIdFromActivityCellId,
  type FollowOverlayActivity,
} from "@/src/features/trade/components/tradingGrid.utils";

type SocketLike = {
  connected: boolean;
  emit: (event: string, payload?: unknown) => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
  off: (event: string, handler?: (payload: unknown) => void) => void;
};

function isSocketLike(value: unknown): value is SocketLike {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.connected === "boolean" &&
    typeof record.emit === "function" &&
    typeof record.on === "function" &&
    typeof record.off === "function"
  );
}

const PENDING_BET_TIMEOUT_MS = 3000;

type UseTradingGridSocketEffectsParams = {
  marketId: string;
  marketSocketPath: string;
  updatePrice: (price: number, ts?: number, receivedAt?: number) => void;
  updateGrid: (cells: RemoteCell[]) => void;
  hydrateHistory: (history: Array<{ time: number; price: number }>) => void;
  isAuthenticated: boolean;
  resolvedUserAddress: string | null;
  isFollowTradeVisible: boolean;
  enabledFollowTargetIds: string[];
  enabledFollowTargetsKey: string;
  queueFollowOverlayActivities: (activities: FollowOverlayActivity[]) => void;
  isSuggestedStrategyVisible: boolean;
  queueSuggestedStrategyCellIds: (cellIds: string[]) => void;
  balanceResponse: unknown;
  userOrdersResponse: unknown;
  updateOrder: (payload: unknown) => void;
  cancelPendingBet: (cellId: string) => void;
  pendingBets: Record<string, number>;
  storeRef: React.MutableRefObject<{ cells: CellData[] }>;
  onFortressMcDiagnostics?: (payload: unknown) => void;
};

export function useTradingGridSocketEffects({
  marketId,
  marketSocketPath: _marketSocketPath,
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
  onFortressMcDiagnostics,
}: UseTradingGridSocketEffectsParams) {
  void _marketSocketPath;
  const socketRef = useRef<SocketLike | null>(null);
  // 1) Load initial price history (Binance 1s candles) to hydrate the chart.
  useEffect(() => {
    const abortController = new AbortController();

    const loadHistory = async () => {
      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${marketId}&interval=1s&limit=1200`,
          {
            method: "GET",
            cache: "no-store",
            signal: abortController.signal,
          },
        );
        if (!response.ok) {
          throw new Error(
            `Binance history request failed (${response.status})`,
          );
        }

        const payload: unknown = await response.json();
        const nextHistory = extractBinanceKlineHistory(payload);
        if (nextHistory.length > 0) hydrateHistory(nextHistory);
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error(
          "[TradingGrid] Failed to load Binance chart history",
          error,
        );
      }
    };

    void loadHistory();
    return () => abortController.abort();
  }, [hydrateHistory, marketId]);

  // 2) Connect one Solana socket for both market + user/order actions.
  useEffect(() => {
    const unifiedSocket = io(TRADE_SOCKET_BASE_URL, {
      path: CORE_SOCKET_PATH,
      transports: ["websocket"],
      reconnection: true,
    });

    const handlePricePayload = (payload: unknown) => {
      const receivedAt = Date.now();
      const data = payload as
        | number
        | { price?: number | string; ts?: number; time?: number };
      const priceRaw = typeof data === "number" ? data : data?.price;
      const price = Number(priceRaw);
      if (!Number.isFinite(price)) return;
      const ts =
        typeof data === "number" ? undefined : (data?.ts ?? data?.time);
      updatePrice(price, ts, receivedAt);
    };

    // Keep both handlers for transition safety while backend migrates names.
    unifiedSocket.on("price_update", handlePricePayload);
    unifiedSocket.on("price_now", handlePricePayload);

    unifiedSocket.on("grid_update", (payload: unknown) => {
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

      if (remoteCells) updateGrid(remoteCells);
    });

    const handleFortressMcDiagnostics = (payload: unknown) => {
      console.log("[TradingGrid] fortress_mc_diagnostics", payload);
      onFortressMcDiagnostics?.(payload);
    };
    unifiedSocket.on(
      FORTRESS_MC_DIAGNOSTICS_EVENT,
      handleFortressMcDiagnostics,
    );

    socketRef.current = unifiedSocket;
    useGameStore.getState().setConnection(unifiedSocket, null);

    return () => {
      unifiedSocket.off("price_update", handlePricePayload);
      unifiedSocket.off("price_now", handlePricePayload);
      unifiedSocket.off("grid_update");
      unifiedSocket.off(
        FORTRESS_MC_DIAGNOSTICS_EVENT,
        handleFortressMcDiagnostics,
      );
      unifiedSocket.disconnect();
      socketRef.current = null;
      useGameStore.getState().setConnection(null, null);
    };
  }, [onFortressMcDiagnostics, updateGrid, updatePrice]);

  // 3) When the user is authenticated: fetch wssKey + challenge + signature to subscribe to the user channel.
  // Re-subscribes on reconnect, before key expiry (3s early), and on "Invalid wss signature" errors.
  useEffect(() => {
    const socket = socketRef.current;
    if (!isSocketLike(socket)) return;
    const userAddress = resolvedUserAddress;
    if (!isAuthenticated || !userAddress) return;

    let isDisposed = false;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;

    const clearExpiryTimer = () => {
      if (expiryTimer !== null) {
        clearTimeout(expiryTimer);
        expiryTimer = null;
      }
    };

    const subscribeUser = async () => {
      clearExpiryTimer();

      const wssKeyResponse = await authControllerGetWssKey();
      const nextWssKey = extractWssKey(wssKeyResponse);
      if (!nextWssKey) throw new Error("Missing WSS key");
      const expiresAt = extractWssKeyExpiry(wssKeyResponse);

      useGameStore.getState().setConnection(socketRef.current, nextWssKey);

      const challengeResponse = await authControllerGetChallenge({
        address: userAddress,
      });
      const challenge = extractChallenge(challengeResponse);
      if (!challenge) throw new Error("Missing socket user challenge");

      const signature = await signWssMessage(
        nextWssKey,
        userAddress,
        challenge,
      );
      if (isDisposed) return;

      socket.emit(SUBSCRIBE_USER_EVENT, { userId: userAddress, signature });

      // Schedule a re-subscribe 5 seconds before the key expires.
      if (expiresAt !== null) {
        const msUntilRefresh = expiresAt - Date.now() - 5000;
        if (msUntilRefresh > 0) {
          expiryTimer = setTimeout(() => {
            if (!isDisposed) {
              void subscribeUser().catch((error) => {
                console.error("Failed to refresh WSS key:", error);
              });
            }
          }, msUntilRefresh);
        }
      }
    };

    const handleConnect = () => {
      void subscribeUser().catch((error) => {
        console.error("Failed to subscribe user:", error);
      });
    };

    const handleError = (payload: unknown) => {
      const msg =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>).message
          : payload;
      if (
        typeof msg === "string" &&
        msg.toLowerCase().includes("invalid wss signature")
      ) {
        void subscribeUser().catch((error) => {
          console.error(
            "Failed to re-subscribe after invalid WSS signature:",
            error,
          );
        });
      }
    };

    if (socket.connected) handleConnect();
    socket.on("connect", handleConnect);
    socket.on("error", handleError);
    socket.on("exception", handleError);

    return () => {
      isDisposed = true;
      clearExpiryTimer();
      socket.off("connect", handleConnect);
      socket.off("error", handleError);
      socket.off("exception", handleError);
    };
  }, [isAuthenticated, resolvedUserAddress]);

  // 4) Subscribe/unsubscribe follow targets (copy-trade) while the Follow panel is visible.
  // Unsubscribe in cleanup to avoid leaking subscriptions after closing the panel/changing targets.
  useEffect(() => {
    const socket = socketRef.current;
    if (!isSocketLike(socket)) return;
    if (!isFollowTradeVisible) return;
    const wssKey = useGameStore.getState().wssKey;
    if (!wssKey || enabledFollowTargetIds.length === 0 || !resolvedUserAddress)
      return;

    const userAddress = resolvedUserAddress;
    const activeWssKey = wssKey;
    let isDisposed = false;

    const getFollowSignature = async () => {
      const challengeResponse = await authControllerGetChallenge({
        address: userAddress,
      });
      const challenge = extractChallenge(challengeResponse);
      if (!challenge) throw new Error("Missing socket follow challenge");
      return signWssMessage(activeWssKey, userAddress, challenge);
    };

    const subscribeToFollows = async () => {
      const signature = await getFollowSignature();
      if (isDisposed) return;

      enabledFollowTargetIds.forEach((targetUserId) => {
        socket.emit(SUBSCRIBE_ORDER_FOLLOWS_EVENT, {
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

    if (socket.connected) handleConnect();
    socket.on("connect", handleConnect);

    return () => {
      isDisposed = true;
      void getFollowSignature()
        .then((signature) => {
          enabledFollowTargetIds.forEach((targetUserId) => {
            socket.emit(UNSUBSCRIBE_ORDER_FOLLOWS_EVENT, {
              userId: userAddress,
              targetUserId,
              signature,
            });
          });
        })
        .catch((error) => {
          console.error("Failed to unsubscribe from followed orders:", error);
        });
      socket.off("connect", handleConnect);
    };
  }, [
    enabledFollowTargetIds,
    enabledFollowTargetsKey,
    isFollowTradeVisible,
    resolvedUserAddress,
  ]);

  // 5) Receive followed-order update events and push them to the overlay queue (cellId remapped to the current grid).
  useEffect(() => {
    const socket = socketRef.current;
    if (
      !isSocketLike(socket) ||
      !isFollowTradeVisible ||
      enabledFollowTargetIds.length === 0
    )
      return;

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
          return { ...activity, cellId: resolvedCellId };
        })
        .filter((activity) => activity.cellId !== null);

      queueFollowOverlayActivities(activities);
    };

    socket.on(FOLLOWED_ORDER_UPDATE_EVENT, handleFollowedOrderUpdate);
    return () =>
      socket.off(FOLLOWED_ORDER_UPDATE_EVENT, handleFollowedOrderUpdate);
  }, [
    enabledFollowTargetIds,
    enabledFollowTargetsKey,
    isFollowTradeVisible,
    queueFollowOverlayActivities,
    storeRef,
  ]);

  // 6) Subscribe to the suggested strategy channel when the strategy panel is visible.
  useEffect(() => {
    const socket = socketRef.current;
    if (!isSocketLike(socket) || !isSuggestedStrategyVisible) return;

    const subscribe = () => socket.emit(SUBSCRIBE_SUGGESTED_STRATEGY_EVENT);
    if (socket.connected) subscribe();
    socket.on("connect", subscribe);
    return () => socket.off("connect", subscribe);
  }, [isSuggestedStrategyVisible]);

  // 7) Receive suggested strategy updates and convert them to a list of valid cellIds.
  useEffect(() => {
    const socket = socketRef.current;
    if (!isSocketLike(socket) || !isSuggestedStrategyVisible) return;

    const handleSuggestedStrategyUpdate = (payload: unknown) => {
      const nextCellIds = extractSuggestedStrategyCellIds(
        payload,
        storeRef.current.cells,
      );
      if (nextCellIds === null) return;
      queueSuggestedStrategyCellIds(nextCellIds);
    };

    socket.on(SUGGESTED_STRATEGY_UPDATE_EVENT, handleSuggestedStrategyUpdate);
    return () =>
      socket.off(
        SUGGESTED_STRATEGY_UPDATE_EVENT,
        handleSuggestedStrategyUpdate,
      );
  }, [isSuggestedStrategyVisible, queueSuggestedStrategyCellIds, storeRef]);

  // 8) Sync the initial balance from the query response into the store.
  useEffect(() => {
    const nextServerBalance = extractBalanceAmount(balanceResponse);
    if (nextServerBalance === null) return;

    useGameStore.setState({
      serverBalance: nextServerBalance,
      balance: nextServerBalance,
    });
  }, [balanceResponse]);

  // 9) Listen for realtime balance updates; apply only to the current user (if payload has userId).
  useEffect(() => {
    const socket = socketRef.current;
    if (!isSocketLike(socket)) return;

    const normalizedCurrentUser = parseAddress(resolvedUserAddress);

    const handleBalanceUpdate = (payload: unknown) => {
      const payloadUserId = parseAddress(extractBalanceUserId(payload));
      if (
        payloadUserId &&
        (!normalizedCurrentUser || payloadUserId !== normalizedCurrentUser)
      )
        return;

      const nextServerBalance = extractBalanceAmount(payload);
      if (nextServerBalance === null) return;

      useGameStore.setState({
        serverBalance: nextServerBalance,
        balance: nextServerBalance,
      });
    };

    socket.on(BALANCE_UPDATE_EVENT, handleBalanceUpdate);
    return () => socket.off(BALANCE_UPDATE_EVENT, handleBalanceUpdate);
  }, [resolvedUserAddress]);

  // 10) Listen for realtime order updates and forward them to the reducer/update handler.
  useEffect(() => {
    const socket = socketRef.current;
    if (!isSocketLike(socket)) return;

    const handleOrderUpdate = (payload: unknown) => updateOrder(payload);
    socket.on(ORDER_UPDATE_EVENT, handleOrderUpdate);
    return () => socket.off(ORDER_UPDATE_EVENT, handleOrderUpdate);
  }, [updateOrder]);

  // 11) Backfill orders from the query response to sync the initial state.
  useEffect(() => {
    const orders = extractUserOrders(userOrdersResponse);
    if (orders.length === 0) return;
    orders.forEach((orderPayload) => updateOrder(orderPayload));
  }, [updateOrder, userOrdersResponse]);

  // 12) Listen to additional follow-order events and handle them the same way as overlay follow updates.
  useEffect(() => {
    const socket = socketRef.current;
    if (
      !isSocketLike(socket) ||
      !isFollowTradeVisible ||
      enabledFollowTargetIds.length === 0
    )
      return;

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
          return { ...activity, cellId: resolvedCellId };
        })
        .filter((activity) => activity.cellId !== null);

      queueFollowOverlayActivities(activities);
    };

    FOLLOW_ORDER_EVENTS.forEach((event) =>
      socket.on(event, handleFollowedOrder),
    );
    return () => {
      FOLLOW_ORDER_EVENTS.forEach((event) =>
        socket.off(event, handleFollowedOrder),
      );
    };
  }, [
    enabledFollowTargetIds,
    enabledFollowTargetsKey,
    isFollowTradeVisible,
    queueFollowOverlayActivities,
    storeRef,
  ]);

  // 13) Cancel pending bets that have not been confirmed by socket within 3 seconds.
  useEffect(() => {
    const pendingCellIds = Object.keys(pendingBets);
    if (pendingCellIds.length === 0) return;

    const timers = pendingCellIds.map((cellId) =>
      setTimeout(() => cancelPendingBet(cellId), PENDING_BET_TIMEOUT_MS),
    );

    return () => timers.forEach(clearTimeout);
  }, [cancelPendingBet, pendingBets]);
}
