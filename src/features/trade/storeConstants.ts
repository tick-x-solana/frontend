export const MODE_INTERVAL_SECONDS = 5;
export const MODE_PRICE_STEP = 25;
export const DEFAULT_BET_AMOUNT_WLD = 1;
export const MAX_FOLLOWED_ORDER_ACTIVITIES = 200;

// Very slow smoothing (2%) so each price tick moves serverTimeOffset by at most
// ~120ms — shift of ~0.8px at typical zoom. Faster convergence would cause
// nowRef to jump each tick, shifting the entire viewport.
export const SERVER_OFFSET_SMOOTHING = 0.02;

// Snap server time offset when divergence exceeds this threshold (e.g. after reconnect).
export const SERVER_OFFSET_SNAP_THRESHOLD_MS = 30_000;
