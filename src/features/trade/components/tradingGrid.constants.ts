import {
  compactNumberFormatter,
  fixedTwoDecimalFormatter,
  oneDecimalFormatter,
} from "@/src/utils/formatters";
import { SOLANA_SOCKET_BASE_URL } from "@/src/constants";

export const DESKTOP_ZOOM_MIN = 0.1;
export const DEFAULT_DESKTOP_ZOOM = 0.4;
export const DEFAULT_MOBILE_ZOOM = 1;
export const MOBILE_ZOOM_MIN = 0.2;
export const MIN_PRICE_MOTION_MS = 250;
export const MAX_PRICE_MOTION_MS = 5000;
export const TICK_CADENCE_SMOOTHING = 0.2;
export const LARGE_MOVE_STEPS_START = 2;
export const LARGE_MOVE_STEPS_FULL = 12;
export const LARGE_MOVE_DURATION_FACTOR_MIN = 0.38;
export const RESIZE_COMMIT_DEBOUNCE_MS = 180;
export const FOLLOW_OVERLAY_SOCKET_UPDATE_MIN_INTERVAL_MS = 250;
export const SUGGESTED_STRATEGY_MIN_HOLD_MS = 3000;
// Refresh the socket auth key shortly before expiry so the user channel can
// re-subscribe without waiting for an invalid-signature error from the server.
export const WSS_KEY_REFRESH_BEFORE_EXPIRY_MS = 5000;
export const FOLLOW_ORDER_EVENTS = [
  "order_follow",
  "order_follow_update",
  "order_follows",
  "follow_order_placed",
  "place_bet",
] as const;
export const SUBSCRIBE_USER_EVENT = "subscribe_user";
export const FOLLOWED_ORDER_UPDATE_EVENT = "followed_order_update";
export const ORDER_UPDATE_EVENT = "order_update";
export const BALANCE_UPDATE_EVENT = "balance_update";
export const SUBSCRIBE_ORDER_FOLLOWS_EVENT = "subscribe_order_follows";
export const UNSUBSCRIBE_ORDER_FOLLOWS_EVENT = "unsubscribe_order_follows";
export const SUBSCRIBE_SUGGESTED_STRATEGY_EVENT =
  "subscribe_suggested_strategy";
export const SUGGESTED_STRATEGY_UPDATE_EVENT = "suggested_strategy_update";
// Realtime socket event that announces a user's winning payout.
export const WIN_NOTIFICATION_EVENT = "win_notification";
// Keep the win banner visible briefly so users can read the payout.
export const WIN_BET_BANNER_VISIBLE_MS = 1000;
export const WIN_EFFECT_VISIBLE_MS = 2000;
export const WIN_EFFECT_AMOUNTS_VISIBLE_MS = 1300;
export const WIN_EFFECT_INIT_GRACE_MS = 5000;

export const MARKET_SYMBOL = "SOL/USDT";
export const CORE_SOCKET_PATH = "/socket.io";
export const TRADE_SOCKET_BASE_URL = SOLANA_SOCKET_BASE_URL;
export const MARKET_OPTIONS = [
  {
    symbol: "SOL/USDT",
    shortLabel: "S",
    iconSrc: "/sol.png",
    enabled: true,
  },
] as const;

export const FOLLOW_REFERRAL_STATS = [
  { label: "Win rate", value: "68%", color: "text-success-medium" },
  { label: "ROI", value: "+24.5%", color: "text-text-heading" },
  { label: "7D PnL", value: "+343.5", color: "text-text-heading" },
] as const;

export const livePriceFormatter = fixedTwoDecimalFormatter;

export const shareTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

export const winAmountFormatter = fixedTwoDecimalFormatter;

export const percentageFormatter = oneDecimalFormatter;

export const balanceFormatter = compactNumberFormatter;

export const approxUsdFormatter = fixedTwoDecimalFormatter;
