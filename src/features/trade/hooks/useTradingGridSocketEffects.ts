import { useEffect } from "react";
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

type UseTradingGridSocketEffectsParams = {
  marketId: string;
  marketSocketPath: string;
  updatePrice: (price: number, ts?: number) => void;
  updateGrid: (cells: RemoteCell[]) => void;
  hydrateHistory: (history: Array<{ time: number; price: number }>) => void;
  setConnection: (socket: unknown, wssKey: string | null) => void;
  socket: unknown;
  isAuthenticated: boolean;
  resolvedUserAddress: string | null;
  setWssKey: (wssKey: string | null) => void;
  wssKey: string | null;
  isFollowTradeVisible: boolean;
  enabledFollowTargetIds: string[];
  enabledFollowTargetsKey: string;
  queueFollowOverlayActivities: (activities: FollowOverlayActivity[]) => void;
  isSuggestedStrategyVisible: boolean;
  queueSuggestedStrategyCellIds: (cellIds: string[]) => void;
  balanceResponse: unknown;
  userOrdersResponse: unknown;
  updateOrder: (payload: unknown) => void;
  storeRef: React.MutableRefObject<{ cells: CellData[] }>;
};

export function useTradingGridSocketEffects({
  marketId,
  marketSocketPath,
  updatePrice,
  updateGrid,
  hydrateHistory,
  setConnection,
  socket,
  isAuthenticated,
  resolvedUserAddress,
  setWssKey,
  wssKey,
  isFollowTradeVisible,
  enabledFollowTargetIds,
  enabledFollowTargetsKey,
  queueFollowOverlayActivities,
  isSuggestedStrategyVisible,
  queueSuggestedStrategyCellIds,
  balanceResponse,
  userOrdersResponse,
  updateOrder,
  storeRef,
}: UseTradingGridSocketEffectsParams) {
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
          throw new Error(`Binance history request failed (${response.status})`);
        }

        const payload: unknown = await response.json();
        const nextHistory = extractBinanceKlineHistory(payload);
        if (nextHistory.length > 0) hydrateHistory(nextHistory);
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error("[TradingGrid] Failed to load Binance chart history", error);
      }
    };

    void loadHistory();
    return () => abortController.abort();
  }, [hydrateHistory, marketId]);

  useEffect(() => {
    const liveSocket = io("https://api.tickx.finance", {
      path: marketSocketPath,
      transports: ["websocket"],
      reconnection: true,
    });

    liveSocket.on("price_now", (payload: unknown) => {
      const data = payload as number | { price?: number | string; ts?: number; time?: number };
      const priceRaw = typeof data === "number" ? data : data?.price;
      const price = Number(priceRaw);
      if (!Number.isFinite(price)) return;
      const ts = typeof data === "number" ? undefined : (data?.ts ?? data?.time);
      updatePrice(price, ts);
    });

    liveSocket.on("grid_update", (payload: unknown) => {
      let remoteCells: RemoteCell[] | null = null;
      if (Array.isArray(payload)) {
        remoteCells = payload as RemoteCell[];
      } else if (payload && typeof payload === "object") {
        const wrapped = payload as { data?: unknown; grids?: unknown };
        if (Array.isArray(wrapped.data)) remoteCells = wrapped.data as RemoteCell[];
        if (Array.isArray(wrapped.grids)) remoteCells = wrapped.grids as RemoteCell[];
      }

      if (remoteCells) updateGrid(remoteCells);
    });

    return () => {
      liveSocket.off("price_now");
      liveSocket.off("grid_update");
      liveSocket.disconnect();
    };
  }, [marketSocketPath, updateGrid, updatePrice]);

  useEffect(() => {
    const actionSocket = io("https://api.tickx.finance", {
      path: CORE_SOCKET_PATH,
      transports: ["websocket"],
      reconnection: true,
    });

    setConnection(actionSocket, null);
    return () => {
      actionSocket.disconnect();
      setConnection(null, null);
    };
  }, [setConnection]);

  useEffect(() => {
    if (!isSocketLike(socket)) return;
    const userAddress = resolvedUserAddress;
    if (!isAuthenticated || !userAddress) return;

    let isDisposed = false;

    const subscribeUser = async () => {
      const wssKeyResponse = await authControllerGetWssKey();
      const nextWssKey = extractWssKey(wssKeyResponse);
      if (!nextWssKey) throw new Error("Missing WSS key");

      setConnection(socket, nextWssKey);
      setWssKey(nextWssKey);

      const challengeResponse = await authControllerGetChallenge({ address: userAddress });
      const challenge = extractChallenge(challengeResponse);
      if (!challenge) throw new Error("Missing socket user challenge");

      const signature = await signWssMessage(nextWssKey, userAddress, challenge);
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
  }, [isAuthenticated, resolvedUserAddress, setConnection, setWssKey, socket]);

  useEffect(() => {
    if (!isSocketLike(socket)) return;
    if (!isFollowTradeVisible) return;
    if (!wssKey || enabledFollowTargetIds.length === 0 || !resolvedUserAddress) return;

    const userAddress = resolvedUserAddress;
    const activeWssKey = wssKey;
    let isDisposed = false;

    const getFollowSignature = async () => {
      const challengeResponse = await authControllerGetChallenge({ address: userAddress });
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
    wssKey,
    resolvedUserAddress,
    socket,
  ]);

  useEffect(() => {
    if (!isSocketLike(socket) || !isFollowTradeVisible || enabledFollowTargetIds.length === 0) return;

    const handleFollowedOrderUpdate = (payload: unknown) => {
      const activities = extractFollowedOrderActivities(payload, enabledFollowTargetIds)
        .map((activity) => {
          const resolvedCellId = resolveGridCellIdFromActivityCellId(activity.cellId, storeRef.current.cells);
          if (resolvedCellId === activity.cellId) return activity;
          return { ...activity, cellId: resolvedCellId };
        })
        .filter((activity) => activity.cellId !== null);

      queueFollowOverlayActivities(activities);
    };

    socket.on(FOLLOWED_ORDER_UPDATE_EVENT, handleFollowedOrderUpdate);
    return () => socket.off(FOLLOWED_ORDER_UPDATE_EVENT, handleFollowedOrderUpdate);
  }, [
    enabledFollowTargetIds,
    enabledFollowTargetsKey,
    isFollowTradeVisible,
    queueFollowOverlayActivities,
    socket,
    storeRef,
  ]);

  useEffect(() => {
    if (!isSocketLike(socket) || !isSuggestedStrategyVisible) return;

    const subscribe = () => socket.emit(SUBSCRIBE_SUGGESTED_STRATEGY_EVENT);
    if (socket.connected) subscribe();
    socket.on("connect", subscribe);
    return () => socket.off("connect", subscribe);
  }, [isSuggestedStrategyVisible, socket]);

  useEffect(() => {
    if (!isSocketLike(socket) || !isSuggestedStrategyVisible) return;

    const handleSuggestedStrategyUpdate = (payload: unknown) => {
      const nextCellIds = extractSuggestedStrategyCellIds(payload, storeRef.current.cells);
      if (nextCellIds === null) return;
      queueSuggestedStrategyCellIds(nextCellIds);
    };

    socket.on(SUGGESTED_STRATEGY_UPDATE_EVENT, handleSuggestedStrategyUpdate);
    return () => socket.off(SUGGESTED_STRATEGY_UPDATE_EVENT, handleSuggestedStrategyUpdate);
  }, [isSuggestedStrategyVisible, queueSuggestedStrategyCellIds, socket, storeRef]);

  useEffect(() => {
    const nextServerBalance = extractBalanceAmount(balanceResponse);
    if (nextServerBalance === null) return;

    useGameStore.setState({ serverBalance: nextServerBalance, balance: nextServerBalance });
  }, [balanceResponse]);

  useEffect(() => {
    if (!isSocketLike(socket)) return;

    const normalizedCurrentUser = parseAddress(resolvedUserAddress);

    const handleBalanceUpdate = (payload: unknown) => {
      const payloadUserId = parseAddress(extractBalanceUserId(payload));
      if (payloadUserId && (!normalizedCurrentUser || payloadUserId !== normalizedCurrentUser)) return;

      const nextServerBalance = extractBalanceAmount(payload);
      if (nextServerBalance === null) return;

      useGameStore.setState({ serverBalance: nextServerBalance, balance: nextServerBalance });
    };

    socket.on(BALANCE_UPDATE_EVENT, handleBalanceUpdate);
    return () => socket.off(BALANCE_UPDATE_EVENT, handleBalanceUpdate);
  }, [resolvedUserAddress, socket]);

  useEffect(() => {
    if (!isSocketLike(socket)) return;

    const handleOrderUpdate = (payload: unknown) => updateOrder(payload);
    socket.on(ORDER_UPDATE_EVENT, handleOrderUpdate);
    return () => socket.off(ORDER_UPDATE_EVENT, handleOrderUpdate);
  }, [socket, updateOrder]);

  useEffect(() => {
    const orders = extractUserOrders(userOrdersResponse);
    if (orders.length === 0) return;
    orders.forEach((orderPayload) => updateOrder(orderPayload));
  }, [updateOrder, userOrdersResponse]);

  useEffect(() => {
    if (!isSocketLike(socket) || !isFollowTradeVisible || enabledFollowTargetIds.length === 0) return;

    const handleFollowedOrder = (payload: unknown) => {
      const activities = extractFollowedOrderActivities(payload, enabledFollowTargetIds)
        .map((activity) => {
          const resolvedCellId = resolveGridCellIdFromActivityCellId(activity.cellId, storeRef.current.cells);
          if (resolvedCellId === activity.cellId) return activity;
          return { ...activity, cellId: resolvedCellId };
        })
        .filter((activity) => activity.cellId !== null);

      queueFollowOverlayActivities(activities);
    };

    FOLLOW_ORDER_EVENTS.forEach((event) => socket.on(event, handleFollowedOrder));
    return () => {
      FOLLOW_ORDER_EVENTS.forEach((event) => socket.off(event, handleFollowedOrder));
    };
  }, [
    enabledFollowTargetIds,
    enabledFollowTargetsKey,
    isFollowTradeVisible,
    queueFollowOverlayActivities,
    socket,
    storeRef,
  ]);
}
