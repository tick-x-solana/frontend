import { SERVER_OFFSET_SMOOTHING, SERVER_OFFSET_SNAP_THRESHOLD_MS } from "./storeConstants";
import type { CellData, RemoteCell } from "./store";

// ─── ID helpers ────────────────────────────────────────────────────────────────

export function toCellId(
  startTs: number,
  endTs: number,
  lowerPrice: string,
  upperPrice: string,
): string {
  return `${startTs}:${endTs}:${lowerPrice}:${upperPrice}`;
}

// ─── Type coercions ────────────────────────────────────────────────────────────

/** Returns ms timestamp, converting seconds-epoch if needed. Falls back to Date.now(). */
export function normalizeTs(ts?: number): number {
  if (!ts || !Number.isFinite(ts)) return Date.now();
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

/** Converts a timestamp to ms, returning null for invalid inputs. */
export function toMsIfFinite(ts: number | null | undefined): number | null {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

/** Parses a number from a string or number value, returning null for non-finite results. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Like toFiniteNumber but also rejects negative values. */
export function toNonNegativeFiniteNumber(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  return parsed >= 0 ? parsed : null;
}

/** Returns the trimmed string or null if empty/non-string. */
export function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ─── Server clock ──────────────────────────────────────────────────────────────

/** Returns estimated server time using the locally-tracked offset. */
export function getServerNow(serverTimeOffset: number): number {
  return Date.now() + serverTimeOffset;
}

/**
 * Blends a new observed server-time offset into the running estimate using a slow EMA.
 * Snaps immediately on large divergence (e.g. after reconnect) to avoid stale state.
 * Also snaps on the very first observation (previousOffset === 0) to avoid slow convergence from zero.
 */
export function blendServerOffset(
  previousOffset: number,
  nextObservedOffset: number,
  isFirstObservation = false,
): number {
  if (!Number.isFinite(nextObservedOffset)) return previousOffset;
  if (!Number.isFinite(previousOffset)) return nextObservedOffset;

  // Snap immediately on first real observation or large divergence (e.g. reconnect)
  if (isFirstObservation) return nextObservedOffset;

  const delta = nextObservedOffset - previousOffset;
  if (Math.abs(delta) > SERVER_OFFSET_SNAP_THRESHOLD_MS) return nextObservedOffset;

  return previousOffset + delta * SERVER_OFFSET_SMOOTHING;
}

/**
 * Computes the clock offset from a server timestamp, compensating for one-way
 * network latency using the elapsed time since the request was initiated (rttMs / 2).
 *
 * observedOffset = serverTs - clientNow  (includes clock drift + one-way latency)
 * correctedOffset = serverTs + rttMs/2 - clientNow  (removes latency bias)
 */
export function computeOffsetWithLatency(serverTs: number, requestStartMs: number): number {
  const clientNow = Date.now();
  const rttMs = clientNow - requestStartMs;
  const halfRtt = Math.max(0, rttMs / 2);
  return serverTs + halfRtt - clientNow;
}

// ─── Cell status ───────────────────────────────────────────────────────────────

/** Derives a cell's display status from the current time relative to its window. */
export function statusForWindow(
  now: number,
  startTs: number,
  endTs: number,
): CellData["status"] {
  if (now > endTs) return "past";
  return "active";
}

// ─── Grid helpers ──────────────────────────────────────────────────────────────

/**
 * Maps raw server cells to normalized CellData objects.
 * Invalid cells (non-finite prices or timestamps) are dropped.
 */
export function mapRemoteCells(remoteCells: RemoteCell[], now: number): CellData[] {
  return remoteCells
    .map((remote) => {
      const lower = Number(remote.lowerPrice);
      const upper = Number(remote.upperPrice);
      if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;

      const startTs = toMsIfFinite(remote.startTs);
      const endTs = toMsIfFinite(remote.endTs);
      if (startTs === null || endTs === null) return null;

      const priceLevel = (lower + upper) / 2;
      const multiplier = Number(remote.rewardRate);
      const id = toCellId(startTs, endTs, remote.lowerPrice, remote.upperPrice);

      return {
        id,
        timeWindowStart: startTs,
        timeWindowEnd: endTs,
        priceLevel,
        multiplier: Number.isFinite(multiplier) ? multiplier : 0,
        status: statusForWindow(now, startTs, endTs),
        original: remote,
      };
    })
    .filter((cell): cell is CellData => cell !== null);
}

/**
 * Reconstructs a RemoteCell from order payload fields so settled/open orders can
 * still be rendered even after the live grid snapshot has moved past that cell.
 */
export function resolveRemoteCellFromOrderPayload(payload: unknown): RemoteCell | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const cell =
    record.cell && typeof record.cell === "object" && !Array.isArray(record.cell)
      ? (record.cell as Record<string, unknown>)
      : null;
  const orderIdParts = parseOrderIdCellParts(record.orderId);

  const startRaw =
    record.cellTimeStart ?? record.startTs ?? cell?.startTs ?? orderIdParts?.start;
  const endRaw =
    record.cellTimeEnd ?? record.endTs ?? cell?.endTs ?? orderIdParts?.end;
  const lowerPrice =
    toNonEmptyString(record.lowerPrice) ??
    toNonEmptyString(cell?.lowerPrice) ??
    orderIdParts?.lower ??
    null;
  const upperPrice =
    toNonEmptyString(record.upperPrice) ??
    toNonEmptyString(cell?.upperPrice) ??
    orderIdParts?.upper ??
    null;

  const startTs = toMsIfFinite(toFiniteNumber(startRaw));
  const endTs = toMsIfFinite(toFiniteNumber(endRaw));
  if (startTs === null || endTs === null || !lowerPrice || !upperPrice) {
    return null;
  }

  const rewardRate = resolveRewardRate(payload) ?? "0";
  const gridTs =
    toMsIfFinite(
      toFiniteNumber(record.gridTs ?? record.cellGridTs ?? cell?.gridTs),
    ) ?? startTs;
  const gridSignature =
    toNonEmptyString(record.gridSignature) ??
    toNonEmptyString(cell?.gridSignature) ??
    `order:${startTs}:${endTs}:${lowerPrice}:${upperPrice}`;

  return {
    gridTs,
    startTs,
    endTs,
    lowerPrice,
    upperPrice,
    rewardRate,
    gridSignature,
  };
}

/**
 * When a backend burst includes cells from multiple grid snapshots, keeps only
 * the newest snapshot to avoid mixing old/new windows after fast price moves.
 */
export function keepLatestGridSnapshot(remoteCells: RemoteCell[]): RemoteCell[] {
  if (remoteCells.length <= 1) return remoteCells;

  let latestGridTs: number | null = null;
  for (const cell of remoteCells) {
    const gridTsMs = toMsIfFinite(cell.gridTs);
    if (gridTsMs === null) continue;
    if (latestGridTs === null || gridTsMs > latestGridTs) {
      latestGridTs = gridTsMs;
    }
  }

  if (latestGridTs === null) return remoteCells;
  return remoteCells.filter((cell) => toMsIfFinite(cell.gridTs) === latestGridTs);
}

/** Sorts cells by time window start ascending, then price level descending. */
export function sortGridCells(a: CellData, b: CellData): number {
  if (a.timeWindowStart !== b.timeWindowStart) {
    return a.timeWindowStart - b.timeWindowStart;
  }
  return b.priceLevel - a.priceLevel;
}

/** Extracts the price step (row height) from the first valid cell in the list. */
export function extractPriceStepFromCells(
  cells: Array<{ lowerPrice: string; upperPrice: string }>,
): number | null {
  for (const cell of cells) {
    const lower = Number(cell.lowerPrice);
    const upper = Number(cell.upperPrice);
    if (!Number.isFinite(lower) || !Number.isFinite(upper)) continue;
    const step = Math.abs(upper - lower);
    if (step > 0) return step;
  }
  return null;
}

// ─── Order payload parsers ─────────────────────────────────────────────────────

function parseOrderIdCellParts(orderId: unknown) {
  if (typeof orderId !== "string") return null;
  const parts = orderId.split(":");
  if (parts.length < 5) return null;
  const start = parts[parts.length - 4];
  const end = parts[parts.length - 3];
  const lower = parts[parts.length - 2];
  const upper = parts[parts.length - 1];
  return { start, end, lower, upper };
}

/** Derives the cell ID from an order update payload, trying multiple field paths. */
export function resolveOrderCellId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const cell =
    record.cell && typeof record.cell === "object" && !Array.isArray(record.cell)
      ? (record.cell as Record<string, unknown>)
      : null;
  const orderIdParts = parseOrderIdCellParts(record.orderId);

  const startRaw =
    record.cellTimeStart ?? record.startTs ?? cell?.startTs ?? orderIdParts?.start;
  const endRaw =
    record.cellTimeEnd ?? record.endTs ?? cell?.endTs ?? orderIdParts?.end;
  const lowerRaw = record.lowerPrice ?? cell?.lowerPrice ?? orderIdParts?.lower;
  const upperRaw = record.upperPrice ?? cell?.upperPrice ?? orderIdParts?.upper;

  const startMs = toMsIfFinite(toFiniteNumber(startRaw));
  const endMs = toMsIfFinite(toFiniteNumber(endRaw));
  const lower = toNonEmptyString(lowerRaw);
  const upper = toNonEmptyString(upperRaw);

  if (startMs === null || endMs === null || !lower || !upper) return null;
  return toCellId(startMs, endMs, lower, upper);
}

/** Extracts the rewardRate string from an order update payload, checking nested cell object too. */
export function resolveRewardRate(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const cell =
    record.cell && typeof record.cell === "object" && !Array.isArray(record.cell)
      ? (record.cell as Record<string, unknown>)
      : null;
  return toNonEmptyString(record.rewardRate) ?? toNonEmptyString(cell?.rewardRate);
}
