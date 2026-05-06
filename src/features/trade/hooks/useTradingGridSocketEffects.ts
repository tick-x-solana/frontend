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
  FOLLOW_ORDER_EVENTS,
  FOLLOWED_ORDER_UPDATE_EVENT,
  ORDER_UPDATE_EVENT,
  SUBSCRIBE_ORDER_FOLLOWS_EVENT,
  SUBSCRIBE_SUGGESTED_STRATEGY_EVENT,
  SUBSCRIBE_USER_EVENT,
  SUGGESTED_STRATEGY_UPDATE_EVENT,
  UNSUBSCRIBE_ORDER_FOLLOWS_EVENT,
  WSS_KEY_REFRESH_BEFORE_EXPIRY_MS,
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
  on: (event: string, handler: (payload: any) => void) => void;
  off: (event: string, handler?: (payload: any) => void) => void;
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
  wssKeyExpiresAt: number | null;
  storeRef: React.MutableRefObject<{ cells: CellData[] }>;
};

export function useTradingGridSocketEffects({
  marketId,
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
  wssKeyExpiresAt,
  storeRef,
}: UseTradingGridSocketEffectsParams) {
  const socketRef = useRef<SocketLike | null>(null);
  const scheduledWssExpiryRef = useRef<number | null>(null);
  // 1) Load initial price history (Binance 1s candles) to hydrate the chart.
  useEffect(() => {
    const abortController = new AbortController();

    const loadHistory = async () => {
      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${marketId}&interval=1s&limit=600`,
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

  // 2) Connect a dedicated market socket for realtime price + grid state.
  useEffect(() => {
    const liveSocket = io("https://api.tickx.finance", {
      path: marketSocketPath,
      transports: ["websocket"],
      reconnection: true,
    });

    liveSocket.on("price_now", (payload: unknown) => {
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

      if (remoteCells) updateGrid(remoteCells);
    });

    return () => {
      liveSocket.off("price_now");
      liveSocket.off("grid_update");
      liveSocket.disconnect();
    };
  }, [marketSocketPath, updateGrid, updatePrice]);

  // 3) Connect the core/action socket for user/order-related events.
  // Stored in a ref (not Zustand) so it never triggers re-renders or effect loops.
  useEffect(() => {
    const actionSocket = io("https://api.tickx.finance", {
      path: CORE_SOCKET_PATH,
      transports: ["websocket"],
      reconnection: true,
    });

    socketRef.current = actionSocket;
    useGameStore.getState().setConnection(actionSocket, null);

    return () => {
      actionSocket.disconnect();
      socketRef.current = null;
      useGameStore.getState().setConnection(null, null);
    };
  }, []);

  // 4) When the user is authenticated: fetch wssKey + challenge + signature to subscribe to the user channel.
  // Re-subscribe every time the socket reconnects.
  useEffect(() => {
    const socket = socketRef.current;
    if (!isSocketLike(socket)) return;
    const userAddress = resolvedUserAddress;
    if (!isAuthenticated || !userAddress) return;

    let isDisposed = false;

    const subscribeUser = async () => {
      const wssKeyResponse = await authControllerGetWssKey();
      const nextWssKey = extractWssKey(wssKeyResponse);
      const nextExpiresAt = extractWssKeyExpiry(wssKeyResponse);
      if (!nextWssKey) throw new Error("Missing WSS key");

      useGameStore.getState().setConnection(socketRef.current, nextWssKey);
      useGameStore.getState().setWssKey(nextWssKey, nextExpiresAt);

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
    };

    const handleConnect = () => {
      void subscribeUser().catch((error) => {
        console.error("Failed to subscribe user:", error);
      });
    };

    if (socket.connected) handleConnect();
    socket.on("connect", handleConnect);

    return () => {
      isDisposed = true;
      socket.off("connect", handleConnect);
    };
  }, [isAuthenticated, resolvedUserAddress]);

  // 5) Subscribe/unsubscribe follow targets (copy-trade) while the Follow panel is visible.
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

  // 6) Receive followed-order update events and push them to the overlay queue (cellId remapped to the current grid).
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

  // 7) Subscribe to the suggested strategy channel when the strategy panel is visible.
  useEffect(() => {
    const socket = socketRef.current;
    if (!isSocketLike(socket) || !isSuggestedStrategyVisible) return;

    const subscribe = () => socket.emit(SUBSCRIBE_SUGGESTED_STRATEGY_EVENT);
    if (socket.connected) subscribe();
    socket.on("connect", subscribe);
    return () => socket.off("connect", subscribe);
  }, [isSuggestedStrategyVisible]);

  // 8) Receive suggested strategy updates and convert them to a list of valid cellIds.
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
  }, [
    isSuggestedStrategyVisible,
    queueSuggestedStrategyCellIds,
    storeRef,
  ]);

  // 9) Sync the initial balance from the query response into the store.
  useEffect(() => {
    const nextServerBalance = extractBalanceAmount(balanceResponse);
    if (nextServerBalance === null) return;

    useGameStore.setState({
      serverBalance: nextServerBalance,
      balance: nextServerBalance,
    });
  }, [balanceResponse]);

  // 10) Listen for realtime balance updates; apply only to the current user (if payload has userId).
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

  // 11) Listen for realtime order updates and forward them to the reducer/update handler.
  useEffect(() => {
    const socket = socketRef.current;
    if (!isSocketLike(socket)) return;

    const handleOrderUpdate = (payload: unknown) => updateOrder(payload);
    socket.on(ORDER_UPDATE_EVENT, handleOrderUpdate);
    return () => socket.off(ORDER_UPDATE_EVENT, handleOrderUpdate);
  }, [updateOrder]);

  // 12) Backfill orders from the query response to sync the initial state.
  useEffect(() => {
    const orders = extractUserOrders(userOrdersResponse);
    if (orders.length === 0) return;
    orders.forEach((orderPayload) => updateOrder(orderPayload));
  }, [updateOrder, userOrdersResponse]);

  // 13) Listen to additional follow-order events and handle them the same way as overlay follow updates.
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

  // 14) Handle "Invalid wss signature" errors: re-fetch wssKey and re-subscribe the user channel.
  useEffect(() => {
    const socket = socketRef.current;
    if (!isSocketLike(socket) || !isAuthenticated || !resolvedUserAddress)
      return;

    const userAddress = resolvedUserAddress;
    let isDisposed = false;

    const resubscribe = async () => {
      const wssKeyResponse = await authControllerGetWssKey();
      const nextWssKey = extractWssKey(wssKeyResponse);
      const nextExpiresAt = extractWssKeyExpiry(wssKeyResponse);
      if (!nextWssKey || isDisposed) return;

      useGameStore.getState().setConnection(socketRef.current, nextWssKey);
      useGameStore.getState().setWssKey(nextWssKey, nextExpiresAt);

      const challengeResponse = await authControllerGetChallenge({
        address: userAddress,
      });
      const challenge = extractChallenge(challengeResponse);
      if (!challenge || isDisposed) return;

      const signature = await signWssMessage(nextWssKey, userAddress, challenge);
      if (isDisposed) return;

      socket.emit(SUBSCRIBE_USER_EVENT, { userId: userAddress, signature });
    };

    const isInvalidWssSignature = (payload: unknown): boolean => {
      if (typeof payload === "string") {
        return payload.toLowerCase().includes("invalid wss signature");
      }
      if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        const msg = record.message ?? record.msg ?? record.error;
        return typeof msg === "string" && msg.toLowerCase().includes("invalid wss signature");
      }
      return false;
    };

    const handleInvalidSignature = (payload: unknown) => {
      if (!isInvalidWssSignature(payload)) return;
      void resubscribe().catch((error) => {
        console.error("[TradingGrid] Failed to re-subscribe after invalid wss signature:", error);
      });
    };

    // The server sends "Invalid wss signature" as a named "message" event.
    // Also guard "error" and "exception" for other transports.
    socket.on("message", handleInvalidSignature);
    socket.on("error", handleInvalidSignature);
    socket.on("exception", handleInvalidSignature);
    return () => {
      isDisposed = true;
      socket.off("message", handleInvalidSignature);
      socket.off("error", handleInvalidSignature);
      socket.off("exception", handleInvalidSignature);
    };
  }, [isAuthenticated, resolvedUserAddress]);

  // 15) Cancel pending bets that have not been confirmed by socket within 3 seconds.
  useEffect(() => {
    const pendingCellIds = Object.keys(pendingBets);
    if (pendingCellIds.length === 0) return;

    const timers = pendingCellIds.map((cellId) =>
      setTimeout(() => cancelPendingBet(cellId), PENDING_BET_TIMEOUT_MS),
    );

    return () => timers.forEach(clearTimeout);
  }, [cancelPendingBet, pendingBets]);

  // 16) Proactively refresh the wssKey shortly before it expires so the connection
  //     never goes invalid mid-session (complements the reactive socket message handler).
  //     Guard with a ref so updating wssKeyExpiresAt after refresh doesn't re-trigger this effect.
  useEffect(() => {
    if (!isAuthenticated || !resolvedUserAddress || !wssKeyExpiresAt) return;

    // Skip re-scheduling if we already have a timer for this exact expiry.
    if (scheduledWssExpiryRef.current === wssKeyExpiresAt) return;
    scheduledWssExpiryRef.current = wssKeyExpiresAt;

    const msUntilExpiry = wssKeyExpiresAt - Date.now();
    // If the key is already expired or expires within the configured refresh window, skip scheduling —
    // the reactive handler (effect #14) covers the invalid-signature case.
    if (msUntilExpiry <= WSS_KEY_REFRESH_BEFORE_EXPIRY_MS) return;
    const refreshAfterMs =
      msUntilExpiry - WSS_KEY_REFRESH_BEFORE_EXPIRY_MS;

    const userAddress = resolvedUserAddress;
    let isDisposed = false;

    const timer = setTimeout(async () => {
      if (isDisposed) return;
      const socket = socketRef.current;
      if (!isSocketLike(socket)) return;
      try {
        const wssKeyResponse = await authControllerGetWssKey();
        const nextWssKey = extractWssKey(wssKeyResponse);
        const nextExpiresAt = extractWssKeyExpiry(wssKeyResponse);
        if (!nextWssKey || isDisposed) return;

        // Only update the store if the new expiry is genuinely in the future
        // to avoid scheduling another immediate refresh.
        if (
          nextExpiresAt !== null &&
          nextExpiresAt - Date.now() > WSS_KEY_REFRESH_BEFORE_EXPIRY_MS
        ) {
          useGameStore.getState().setConnection(socketRef.current, nextWssKey);
          useGameStore.getState().setWssKey(nextWssKey, nextExpiresAt);
        } else {
          useGameStore.getState().setConnection(socketRef.current, nextWssKey);
          useGameStore.getState().setWssKey(nextWssKey, null);
        }

        const challengeResponse = await authControllerGetChallenge({ address: userAddress });
        const challenge = extractChallenge(challengeResponse);
        if (!challenge || isDisposed) return;

        const signature = await signWssMessage(nextWssKey, userAddress, challenge);
        if (isDisposed) return;

        socket.emit(SUBSCRIBE_USER_EVENT, { userId: userAddress, signature });
      } catch (error) {
        console.error("[TradingGrid] Failed to proactively refresh wssKey:", error);
      }
    }, refreshAfterMs);

    return () => {
      isDisposed = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated, resolvedUserAddress, wssKeyExpiresAt]);
}
