"use client";

export interface OrderFollowingItem {
  id?: string;
  subscriberUserId: string;
  targetUserId: string;
  status?: string | null;
  eligibilityStatus?: string | null;
  eligibilityReason?: string | null;
  source?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface FollowedOrderActivity {
  subscriberUserId: string | null;
  targetUserId: string;
  multiplier: number | null;
  amount: string | null;
  cellId: string | null;
  observedAt: number;
  raw: unknown;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readNestedRecord(
  value: UnknownRecord | null,
  key: string,
): UnknownRecord | null {
  return asRecord(value?.[key]);
}

function readTimestamp(value: unknown): number | null {
  const numeric = asNumber(value);
  if (numeric !== null) {
    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeCellId(cell: UnknownRecord | null): string | null {
  if (!cell) return null;

  const startTs = asString(cell.startTs) ?? asNumber(cell.startTs)?.toString();
  const endTs = asString(cell.endTs) ?? asNumber(cell.endTs)?.toString();
  const lowerPrice = asString(cell.lowerPrice);
  const upperPrice = asString(cell.upperPrice);

  if (!startTs || !endTs || !lowerPrice || !upperPrice) return null;
  return `${startTs}:${endTs}:${lowerPrice}:${upperPrice}`;
}

export function extractWssKey(response: unknown): string | null {
  if (typeof response === "string") return response;

  const record = asRecord(response);
  if (!record) return null;

  return (
    asString(record.wssKey) ??
    asString(record.signature) ??
    asString(record.key) ??
    asString(record.token) ??
    asString(record.data) ??
    asString(readNestedRecord(record, "data")?.wssKey) ??
    asString(readNestedRecord(record, "data")?.signature) ??
    null
  );
}

function toFollowingItem(value: unknown): OrderFollowingItem | null {
  const record = asRecord(value);
  if (!record) return null;

  const subscriberUserId = asString(record.subscriberUserId);
  const targetUserId = asString(record.targetUserId);

  if (!subscriberUserId || !targetUserId) return null;

  return {
    id: asString(record.id) ?? undefined,
    subscriberUserId,
    targetUserId,
    status: asString(record.status),
    eligibilityStatus: asString(record.eligibilityStatus),
    eligibilityReason: asString(record.eligibilityReason),
    source: asString(record.source),
    expiresAt: asString(record.expiresAt),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
}

export function extractOrderFollowings(response: unknown): OrderFollowingItem[] {
  const rawItems = Array.isArray(response)
    ? response
    : Array.isArray(asRecord(response)?.data)
      ? (asRecord(response)?.data as unknown[])
      : Array.isArray(readNestedRecord(asRecord(response), "data")?.items)
        ? (readNestedRecord(asRecord(response), "data")?.items as unknown[])
        : [];

  return rawItems
    .map(toFollowingItem)
    .filter((item): item is OrderFollowingItem => item !== null);
}

function toActivity(
  value: unknown,
  followedTargetIds: Set<string>,
): FollowedOrderActivity | null {
  const record = asRecord(value);
  if (!record) return null;

  const nestedOrder = readNestedRecord(record, "order");
  const nestedData = readNestedRecord(record, "data");
  const cell =
    readNestedRecord(record, "cell") ??
    readNestedRecord(nestedOrder, "cell") ??
    readNestedRecord(nestedData, "cell");

  const directTargetUserId =
    asString(record.targetUserId) ??
    asString(record.traderUserId) ??
    asString(record.followedUserId) ??
    asString(nestedOrder?.targetUserId) ??
    asString(nestedData?.targetUserId);

  const sourceUserId =
    asString(record.userId) ??
    asString(record.walletAddress) ??
    asString(nestedOrder?.userId) ??
    asString(nestedData?.userId);

  const targetUserId =
    directTargetUserId ??
    (sourceUserId && followedTargetIds.has(sourceUserId) ? sourceUserId : null);

  if (!targetUserId || !followedTargetIds.has(targetUserId)) return null;

  return {
    subscriberUserId:
      asString(record.subscriberUserId) ??
      asString(nestedOrder?.subscriberUserId) ??
      asString(nestedData?.subscriberUserId),
    targetUserId,
    multiplier:
      asNumber(record.multiplier) ??
      asNumber(record.rewardRate) ??
      asNumber(cell?.rewardRate) ??
      asNumber(nestedOrder?.rewardRate) ??
      null,
    amount:
      asString(record.amount) ??
      asString(nestedOrder?.amount) ??
      asString(nestedData?.amount),
    cellId:
      normalizeCellId(cell) ??
      asString(record.cellId) ??
      asString(nestedOrder?.cellId) ??
      asString(nestedData?.cellId),
    observedAt:
      readTimestamp(record.createdAt) ??
      readTimestamp(record.ts) ??
      readTimestamp(record.timestamp) ??
      Date.now(),
    raw: value,
  };
}

export function extractFollowedOrderActivities(
  payload: unknown,
  followedTargetIds: Iterable<string>,
): FollowedOrderActivity[] {
  const targetIds = new Set(followedTargetIds);
  if (targetIds.size === 0) return [];

  const record = asRecord(payload);
  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(record?.data)
      ? (record?.data as unknown[])
      : Array.isArray(record?.orders)
        ? (record?.orders as unknown[])
        : Array.isArray(record?.items)
          ? (record?.items as unknown[])
          : [payload];

  return rawItems
    .map((item) => toActivity(item, targetIds))
    .filter((item): item is FollowedOrderActivity => item !== null);
}

export function getUserInitials(userId: string): string {
  const trimmed = userId.trim();
  if (!trimmed) return "--";

  if (trimmed.startsWith("0x")) {
    return trimmed.slice(2, 4).toUpperCase();
  }

  const segments = trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (segments.length === 0) {
    return trimmed.slice(0, 2).toUpperCase();
  }

  return segments
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}
