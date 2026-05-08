"use client";

import { useEffect, useState } from "react";
import {
  WIN_BET_BANNER_VISIBLE_MS,
  WIN_NOTIFICATION_EVENT,
} from "@/src/features/trade/components/tradingGrid.constants";
import {
  formatWalletShort,
  type WinBetBannerData,
} from "@/src/features/trade/components/tradingGrid.utils";

type SocketLike = {
  on: (event: string, handler: (payload: unknown) => void) => void;
  off: (event: string, handler: (payload: unknown) => void) => void;
};

export interface WinNotificationMessage {
  userId: string;
  displayName: string;
  humanVerified: boolean;
  payoutAmount: string;
  marketId: string;
  timestamp: number;
}

function isSocketLike(value: unknown): value is SocketLike {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.on === "function" && typeof record.off === "function";
}

/** Returns true for Solana base58 addresses and EVM 0x addresses. */
function isWalletAddress(value: string): boolean {
  if (value.startsWith("0x") && value.length === 42) return true;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function extractWinNotificationMessage(
  payload: unknown,
): WinNotificationMessage | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const {
    userId,
    displayName,
    humanVerified,
    payoutAmount,
    marketId,
    timestamp,
  } = record;

  if (
    typeof userId !== "string" ||
    typeof displayName !== "string" ||
    typeof humanVerified !== "boolean" ||
    typeof payoutAmount !== "string" ||
    typeof marketId !== "string" ||
    typeof timestamp !== "number" ||
    !Number.isFinite(timestamp)
  ) {
    return null;
  }

  console.log("displayName: ", displayName);
  return {
    userId,
    displayName: isWalletAddress(displayName)
      ? formatWalletShort(displayName)
      : displayName,
    humanVerified,
    payoutAmount,
    marketId: marketId.trim().toUpperCase(),
    timestamp,
  };
}

function toWinBetBannerData(
  payload: WinNotificationMessage,
  solUsdPrice: number | null,
): WinBetBannerData | null {
  const payoutAmountSol = Number(payload.payoutAmount);
  if (
    !Number.isFinite(payoutAmountSol) ||
    payoutAmountSol <= 0 ||
    typeof solUsdPrice !== "number" ||
    !Number.isFinite(solUsdPrice) ||
    solUsdPrice <= 0
  ) {
    return null;
  }

  const username = payload.displayName.trim();
  if (!username) {
    return null;
  }

  return {
    username,
    amount: payoutAmountSol * solUsdPrice,
    humanVerified: payload.humanVerified,
  };
}

type UseWinNotificationToastParams = {
  socket: unknown;
  marketId: string;
  solUsdPrice: number | null;
};

export default function useWinNotificationToast({
  socket,
  marketId,
  solUsdPrice,
}: UseWinNotificationToastParams) {
  const [winToastData, setWinToastData] = useState<WinBetBannerData | null>(
    null,
  );

  useEffect(() => {
    if (!isSocketLike(socket)) {
      return;
    }

    let hideToastTimerId: ReturnType<typeof setTimeout> | null = null;
    const normalizedMarketId = marketId.trim().toUpperCase();

    const handleWinNotification = (payload: unknown) => {
      const notification = extractWinNotificationMessage(payload);
      if (!notification || notification.marketId !== normalizedMarketId) {
        return;
      }

      const nextToastData = toWinBetBannerData(notification, solUsdPrice);
      if (!nextToastData) {
        return;
      }

      setWinToastData(nextToastData);

      if (hideToastTimerId) {
        clearTimeout(hideToastTimerId);
      }

      hideToastTimerId = setTimeout(() => {
        setWinToastData(null);
      }, WIN_BET_BANNER_VISIBLE_MS);
    };

    socket.on(WIN_NOTIFICATION_EVENT, handleWinNotification);

    return () => {
      socket.off(WIN_NOTIFICATION_EVENT, handleWinNotification);
      if (hideToastTimerId) {
        clearTimeout(hideToastTimerId);
      }
    };
  }, [marketId, socket, solUsdPrice]);

  return winToastData;
}
