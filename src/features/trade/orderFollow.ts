"use client";

import { getAddress } from "viem";

export interface OrderFollowingItem {
  id?: string;
  subscriberUserId: string | null;
  targetUserId: string;
  targetUsername?: string | null;
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

function parseAddress(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;

  try {
    return getAddress(raw);
  } catch {
    return null;
  }
}

function normalizeUsername(value: string | null): string | null {
  if (!value) return null;

  const parts = value
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  const firstNonAddressPart = parts.find((part) => parseAddress(part) === null);
  return firstNonAddressPart ?? parts[0];
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

function normalizeTsToMsString(value: unknown): string | null {
  const numeric = asNumber(value);
  if (numeric === null) return null;
  const normalized = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  if (!Number.isFinite(normalized)) return null;
  return Math.trunc(normalized).toString();
}

function normalizeCellId(cell: UnknownRecord | null): string | null {
  if (!cell) return null;

  const startTs = normalizeTsToMsString(cell.startTs);
  const endTs = normalizeTsToMsString(cell.endTs);
  const lowerPrice =
    asString(cell.lowerPrice) ?? asNumber(cell.lowerPrice)?.toString();
  const upperPrice =
    asString(cell.upperPrice) ?? asNumber(cell.upperPrice)?.toString();

  if (!startTs || !endTs || !lowerPrice || !upperPrice) return null;
  return `${startTs}:${endTs}:${lowerPrice}:${upperPrice}`;
}

function normalizeCellIdString(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;

  const parts = raw.split(":");
  if (parts.length < 4) return null;

  const startTs = normalizeTsToMsString(parts[parts.length - 4]);
  const endTs = normalizeTsToMsString(parts[parts.length - 3]);
  const lowerPrice = asString(parts[parts.length - 2]);
  const upperPrice = asString(parts[parts.length - 1]);

  if (!startTs || !endTs || !lowerPrice || !upperPrice) return null;
  return `${startTs}:${endTs}:${lowerPrice}:${upperPrice}`;
}

function normalizeCellIdFromRecord(
  record: UnknownRecord | null,
): string | null {
  if (!record) return null;

  const startTs = normalizeTsToMsString(record.startTs ?? record.cellTimeStart);
  const endTs = normalizeTsToMsString(record.endTs ?? record.cellTimeEnd);
  const lowerPrice =
    asString(record.lowerPrice) ?? asNumber(record.lowerPrice)?.toString();
  const upperPrice =
    asString(record.upperPrice) ?? asNumber(record.upperPrice)?.toString();

  if (!startTs || !endTs || !lowerPrice || !upperPrice) return null;
  return `${startTs}:${endTs}:${lowerPrice}:${upperPrice}`;
}

export function extractWssKey(response: unknown): string | null {
  if (typeof response === "string") return response;

  const record = asRecord(response);
  if (!record) return null;

  return (
    asString(record.key) ??
    asString(record.signature) ??
    asString(record.key) ??
    asString(record.token) ??
    asString(record.data) ??
    asString(readNestedRecord(record, "data")?.wssKey) ??
    asString(readNestedRecord(record, "data")?.signature) ??
    null
  );
}

function readFollowingUsername(record: UnknownRecord): string | null {
  const targetUser = asRecord(record.targetUser);
  const user = asRecord(record.user);
  const rawUsername =
    asString(record.targetUsername) ??
    asString(record.username) ??
    asString(record.targetUserName) ??
    asString(targetUser?.username) ??
    asString(targetUser?.displayName) ??
    asString(targetUser?.name) ??
    asString(user?.username) ??
    null;

  return normalizeUsername(rawUsername);
}

function toFollowingItem(value: unknown): OrderFollowingItem | null {
  const record = asRecord(value);
  if (!record) return null;

  const subscriberUserId =
    parseAddress(record.subscriberUserId) ??
    parseAddress(record.userId) ??
    parseAddress(record.subscriberAddress) ??
    null;
  const targetUserId =
    parseAddress(record.targetUserId) ??
    parseAddress(record.target_user_id) ??
    parseAddress(record.targetAddress) ??
    parseAddress(record.targetWalletAddress);

  if (!targetUserId) return null;

  return {
    id: asString(record.id) ?? undefined,
    subscriberUserId,
    targetUserId,
    targetUsername: readFollowingUsername(record),
    status: asString(record.status),
    eligibilityStatus: asString(record.eligibilityStatus),
    eligibilityReason: asString(record.eligibilityReason),
    source: asString(record.source),
    expiresAt: asString(record.expiresAt),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
}

export function extractOrderFollowings(
  response: unknown,
): OrderFollowingItem[] {
  const responseRecord = asRecord(response);
  const nestedData = readNestedRecord(responseRecord, "data");

  const rawItems = Array.isArray(response)
    ? response
    : Array.isArray(responseRecord?.data)
      ? (responseRecord?.data as unknown[])
      : Array.isArray(responseRecord?.items)
        ? (responseRecord?.items as unknown[])
        : Array.isArray(responseRecord?.results)
          ? (responseRecord?.results as unknown[])
          : Array.isArray(responseRecord?.followings)
            ? (responseRecord?.followings as unknown[])
            : Array.isArray(nestedData?.items)
              ? (nestedData?.items as unknown[])
              : Array.isArray(nestedData?.results)
                ? (nestedData?.results as unknown[])
                : Array.isArray(nestedData?.followings)
                  ? (nestedData?.followings as unknown[])
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
    parseAddress(record.targetUserId) ??
    parseAddress(record.target_user_id) ??
    parseAddress(record.targetAddress) ??
    parseAddress(record.targetWalletAddress) ??
    parseAddress(record.traderUserId) ??
    parseAddress(record.trader_user_id) ??
    parseAddress(record.followedUserId) ??
    parseAddress(nestedOrder?.targetUserId) ??
    parseAddress(nestedOrder?.target_user_id) ??
    parseAddress(nestedData?.targetUserId);

  const sourceUserId =
    parseAddress(record.userId) ??
    parseAddress(record.walletAddress) ??
    parseAddress(record.address) ??
    parseAddress(record.traderAddress) ??
    parseAddress(record.traderWalletAddress) ??
    parseAddress(nestedOrder?.userId) ??
    parseAddress(nestedOrder?.walletAddress) ??
    parseAddress(nestedOrder?.address) ??
    parseAddress(nestedData?.userId);

  const targetUserId =
    directTargetUserId ??
    (sourceUserId && followedTargetIds.has(sourceUserId) ? sourceUserId : null);

  if (!targetUserId || !followedTargetIds.has(targetUserId)) return null;

  return {
    subscriberUserId:
      parseAddress(record.subscriberUserId) ??
      parseAddress(nestedOrder?.subscriberUserId) ??
      parseAddress(nestedData?.subscriberUserId),
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
      normalizeCellIdFromRecord(record) ??
      normalizeCellIdFromRecord(nestedOrder) ??
      normalizeCellIdFromRecord(nestedData) ??
      normalizeCellIdString(record.cellId) ??
      normalizeCellIdString(nestedOrder?.cellId) ??
      normalizeCellIdString(nestedData?.cellId),
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
