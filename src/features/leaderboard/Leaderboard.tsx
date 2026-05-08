"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/shadcn/select";
import LeaderboardRank from "@/src/features/leaderboard/components/LeaderboardRank";
import { useLeaderboardData } from "@/src/features/leaderboard/hooks/useLeaderboardData";
import { CheckIcon, RefreshIcon } from "@/src/assets/icons";
import { Search, Trophy } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  LeaderboardControllerGetLeaderboardWindow,
  LeaderboardControllerGetLeaderboardMetric,
} from "@/src/services/models";
import { Sheet } from "react-modal-sheet";
import { formatUsdCurrencyFixedTwo } from "@/src/utils/formatters";
import type { LeaderboardViewEntry } from "@/src/features/leaderboard/hooks/useLeaderboardData";

type LeaderboardWindowFilter = LeaderboardControllerGetLeaderboardWindow;
type LeaderboardMetric = LeaderboardControllerGetLeaderboardMetric;

const VALID_WINDOWS: LeaderboardWindowFilter[] = ["all", "30d", "7d", "1d"];
const VALID_METRICS: LeaderboardMetric[] = ["pnl", "volume"];

const METRIC_LABELS: Record<LeaderboardMetric, string> = {
  pnl: "PNL",
  volume: "Volume",
};

const WINDOW_LABELS: Record<LeaderboardWindowFilter, string> = {
  all: "All Time",
  "30d": "30 Days",
  "7d": "7 Days",
  "1d": "24 Hours",
};

function getRankBadgeStyle(rank: number): string {
  if (rank === 1) return "text-[#FFD700] font-bold";
  if (rank === 2) return "text-[#C0C0C0] font-bold";
  if (rank === 3) return "text-[#CD7F32] font-bold";
  return "text-hint";
}

function LeaderboardRow({
  rank,
  initials,
  username,
  volume,
  pnl,
  winRate,
  totalTrades,
  isHumanVerified,
  metric,
}: LeaderboardViewEntry & { metric: LeaderboardMetric }) {
  const isTopThree = rank <= 3;
  return (
    <div
      className={[
        "grid items-center gap-4 px-4 py-2.5 transition-colors",
        "grid-cols-[28px_minmax(0,1fr)_80px]",
        "md:grid-cols-[28px_minmax(0,1fr)_80px_80px_120px]",
        isTopThree
          ? "bg-primary-light/4 hover:bg-primary-light/8"
          : "hover:bg-surface-overlay-subtle/40",
      ].join(" ")}
    >
      {/* Rank */}
      <p className={`text-[14px] tabular-nums tracking-[-0.14px] ${getRankBadgeStyle(rank)}`}>
        {rank}
      </p>

      {/* Identity */}
      <div className="flex min-w-0 items-center gap-[10px]">
        <div className="bg-primary-light text-text-inverse flex size-8 shrink-0 items-center justify-center rounded-full px-[3px] text-[13px] font-medium tracking-[-0.14px]">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <p className="text-text-main truncate text-[14px] font-semibold tracking-[-0.14px]">
              {username}
            </p>
            {isHumanVerified ? (
              <Image
                src="/onboarding/verified-badge.svg"
                alt="Verified human"
                width={15}
                height={15}
                className="h-[15px] w-[15px] shrink-0"
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Win Rate — desktop only */}
      {winRate > 0 ? (
        <p className="text-success-medium hidden text-right text-[13px] font-medium tabular-nums tracking-[-0.14px] md:block">
          {winRate}%
        </p>
      ) : (
        <p className="text-hint hidden text-right text-[13px] tabular-nums md:block">—</p>
      )}

      {/* Trades — desktop only */}
      {totalTrades > 0 ? (
        <p className="text-text-sub hidden text-right text-[13px] tabular-nums tracking-[-0.14px] md:block">
          {totalTrades}
        </p>
      ) : (
        <p className="text-hint hidden text-right text-[13px] tabular-nums md:block">—</p>
      )}

      {/* Primary metric */}
      <p className="text-success-light text-right text-[14px] font-semibold tracking-[-0.14px] tabular-nums">
        {metric === "volume" ? volume : formatUsdCurrencyFixedTwo(pnl)}
      </p>
    </div>
  );
}

function DesktopTopCard({
  entry,
  metric,
}: {
  entry: LeaderboardViewEntry;
  metric: LeaderboardMetric;
}) {
  const medalColors: Record<number, string> = {
    1: "text-[#FFD700]",
    2: "text-[#C0C0C0]",
    3: "text-[#CD7F32]",
  };
  const medalLabel: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };
  const avatarBg: Record<number, string> = {
    1: "bg-primary-light",
    2: "bg-[#56C5C5]",
    3: "bg-[#5A8FE5]",
  };

  return (
    <div className="border-border-main bg-background-surface flex flex-col items-center gap-2 rounded-[12px] border p-4 text-center">
      <div className="relative">
        <div
          className={`text-text-inverse flex size-12 items-center justify-center rounded-full text-[18px] font-semibold ${avatarBg[entry.rank] ?? "bg-primary-light"}`}
        >
          {entry.initials}
        </div>
        {entry.isHumanVerified ? (
          <Image
            src="/onboarding/verified-badge.svg"
            alt="Verified"
            width={16}
            height={16}
            className="absolute -right-1 -bottom-1 size-4"
          />
        ) : null}
      </div>
      <span className={`text-[13px] font-bold tracking-[0.02em] ${medalColors[entry.rank] ?? "text-hint"}`}>
        {medalLabel[entry.rank]}
      </span>
      <p className="text-text-heading w-full truncate text-[13px] font-semibold tracking-[-0.01em]">
        {entry.username}
      </p>
      <div className="border-border-main w-full border-t pt-2">
        <p className="text-success-light text-[15px] font-bold tabular-nums tracking-[-0.01em]">
          {metric === "volume" ? entry.volume : formatUsdCurrencyFixedTwo(entry.pnl)}
        </p>
        <p className="text-hint text-[11px] font-medium uppercase tracking-[0.04em]">
          {METRIC_LABELS[metric]}
        </p>
      </div>
      {entry.winRate > 0 && (
        <div className="bg-success-background/30 w-full rounded-[6px] px-2 py-1">
          <span className="text-success-medium text-[12px] font-semibold">
            {entry.winRate}% win rate
          </span>
        </div>
      )}
    </div>
  );
}

function AttributeSheet({
  isOpen,
  onClose,
  metric,
  onMetricChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  metric: LeaderboardMetric;
  onMetricChange: (metric: LeaderboardMetric) => void;
}) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content">
      <Sheet.Backdrop onClick={onClose} />
      <Sheet.Container className="bg-background-main! rounded-t-[20px]! border-t border-[#1E3550]">
        <Sheet.Header>
          <div className="flex justify-center pt-3 pb-3">
            <div className="bg-border-main h-1 w-10 rounded-full" />
          </div>
        </Sheet.Header>
        <Sheet.Content>
          <div className="px-4 pb-2">
            <p className="text-text-main mb-4 text-center text-[16px] font-semibold tracking-[-0.16px]">
              Select attribute
            </p>

            <div className="border-border-main flex flex-col divide-y divide-(--color-border-main)">
              {VALID_METRICS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onMetricChange(m);
                    onClose();
                  }}
                  className="flex items-center justify-between py-4 outline-none"
                >
                  <span className="text-text-main text-[16px] tracking-[-0.16px]">
                    {METRIC_LABELS[m]}
                  </span>
                  {metric === m ? (
                    <CheckIcon className="text-primary-light h-5 w-5" />
                  ) : null}
                </button>
              ))}
            </div>

            <div
              aria-hidden
              className="h-[calc(env(safe-area-inset-bottom)+8px)]"
            />
          </div>
        </Sheet.Content>
      </Sheet.Container>
    </Sheet>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const windowParam = searchParams.get(
    "window",
  ) as LeaderboardWindowFilter | null;
  const metricParam = searchParams.get("mode") as LeaderboardMetric | null;

  const windowFilter: LeaderboardWindowFilter =
    windowParam && VALID_WINDOWS.includes(windowParam) ? windowParam : "all";
  const metric: LeaderboardMetric =
    metricParam && VALID_METRICS.includes(metricParam) ? metricParam : "pnl";

  const [searchQuery, setSearchQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const updateParams = useCallback(
    (
      updates: Partial<{
        window: LeaderboardWindowFilter;
        mode: LeaderboardMetric;
      }>,
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.window !== undefined) params.set("window", updates.window);
      if (updates.mode !== undefined) params.set("mode", updates.mode);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const { entries, isLoading, isFetching, isError } = useLeaderboardData(
    windowFilter,
    metric,
  );

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return entries;
    return entries.filter((entry) =>
      entry.username.toLowerCase().includes(normalizedSearch),
    );
  }, [entries, searchQuery]);

  const topUsers = useMemo(
    () => filteredEntries.filter((entry) => entry.rank <= 3),
    [filteredEntries],
  );

  const listEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.rank > 3),
    [filteredEntries],
  );

  // Sorted podium order for desktop cards: 2nd, 1st, 3rd
  const desktopPodiumOrder = useMemo(() => {
    const second = topUsers.find((u) => u.rank === 2);
    const first = topUsers.find((u) => u.rank === 1);
    const third = topUsers.find((u) => u.rank === 3);
    return [second, first, third].filter(Boolean) as typeof topUsers;
  }, [topUsers]);

  return (
    <div className="bg-background-main min-h-dvh w-full">
      {/* ───────────── MOBILE LAYOUT (unchanged) ───────────── */}
      <div className="relative flex h-dvh w-full flex-col overflow-hidden md:hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="bg-background-main absolute inset-0" />
          <Image
            src="/line-background.png"
            alt=""
            fill
            loading="eager"
            fetchPriority="low"
            className="object-cover opacity-95 mix-blend-color-dodge"
          />
          <div className="from-background-main/70 to-background-main absolute inset-0 bg-gradient-to-b to-[32.5%]" />
        </div>

        <div className="absolute z-3 px-4 pt-4">
          <div className="relative w-[100vw] pr-4">
            <div className="flex items-center justify-between">
              <h1 className="text-[24px] font-semibold tracking-[-0.24px] text-white">
                Leaderboard
              </h1>
            </div>
          </div>
        </div>

        <section className="relative mt-1 w-full shrink-0 overflow-hidden rounded-2xl px-2 pt-16 pb-3">
          <div className="bg-podium-glow/55 absolute top-[-140px] left-1/2 h-[170px] w-[280px] -translate-x-1/2 rounded-[16px] blur-[80px]" />
          <div className="from-primary-light/45 to-primary-light/0 absolute top-[84px] left-1/2 h-[90px] w-[153px] -translate-x-1/2 rounded-[16px] blur-[80px]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(4,11,24,0)_70%,rgba(4,11,24,0.98)_100%)]" />

          <LeaderboardRank topUsers={topUsers} />
        </section>

        <section className="relative z-10 shrink-0 px-4 pb-0">
          <div className="flex items-center gap-2">
            <label
              htmlFor="leaderboard-search-mobile"
              className="bg-surface-field/90 flex h-10 flex-1 items-center gap-2 rounded-[10px] px-3"
            >
              <Search className="text-hint h-5 w-5 shrink-0" strokeWidth={2} />
              <input
                id="leaderboard-search-mobile"
                type="search"
                placeholder="Search by username"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="text-text-main placeholder:text-hint w-full bg-transparent text-[14px] tracking-[-0.14px] outline-none"
              />
            </label>
            <Select
              value={windowFilter}
              onValueChange={(value) =>
                updateParams({ window: value as LeaderboardWindowFilter })
              }
            >
              <SelectTrigger className="bg-surface-field/90 text-text-sub h-10 min-w-[92px] rounded-[10px] border-0 px-3 text-[14px] tracking-[-0.14px] focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-field border-border-main text-text-main">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="30d">30D</SelectItem>
                <SelectItem value="7d">7D</SelectItem>
                <SelectItem value="1d">1D</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="border-border-main bg-surface-card/20 relative z-10 mt-4 flex min-h-0 flex-1 flex-col border-y">
          <div className="bg-surface-overlay-subtle border-border-main grid h-8 grid-cols-[minmax(0,1fr)_150px] items-center gap-4 border-b px-4">
            <div>
              <p className="text-text-sub text-[14px] tracking-[-0.14px]">
                Account
              </p>
            </div>
            <div className="flex min-w-0 items-center justify-end gap-2">
              <p className="text-text-sub text-[14px] tracking-[-0.14px]">
                {METRIC_LABELS[metric]}
              </p>
              <button
                type="button"
                aria-label="Select attribute"
                onClick={() => setSheetOpen(true)}
              >
                <RefreshIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="bg-background-main min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-[calc(env(safe-area-inset-bottom))]">
            {!isError && (isLoading || isFetching) ? (
              <>
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`leaderboard-skeleton-${index}`}
                    className="grid animate-pulse grid-cols-[minmax(0,1fr)_150px] items-center gap-4 px-4 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-[10px]">
                      <div className="bg-surface-overlay-subtle h-4 w-4 rounded" />
                      <div className="bg-surface-overlay-subtle size-8 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <div className="bg-surface-overlay-subtle h-4 w-32 rounded" />
                      </div>
                    </div>
                    <div className="bg-surface-overlay-subtle ml-auto h-4 w-20 rounded" />
                  </div>
                ))}
              </>
            ) : null}

            {isError ? (
              <p className="text-hint px-4 py-4 text-[14px]">
                Failed to load leaderboard.
              </p>
            ) : null}

            {!isError && !isLoading && !isFetching && listEntries.length === 0 ? (
              <p className="text-hint px-4 py-4 text-center text-[14px]">
                No leaderboard data found.
              </p>
            ) : null}

            {!isLoading &&
              !isFetching &&
              listEntries.map((entry) => (
                <div
                  key={entry.rank}
                  className="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-4 px-4 py-2"
                >
                  <div className="flex min-w-0 items-center gap-[10px]">
                    <p className="w-4 shrink-0 text-[14px] tracking-[-0.14px] text-white">
                      {entry.rank}
                    </p>
                    <div className="bg-primary-light text-text-inverse flex size-8 shrink-0 items-center justify-center rounded-full px-[3px] text-[14px] font-medium tracking-[-0.14px]">
                      {entry.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1">
                        <p className="text-text-main truncate text-[14px] font-semibold tracking-[-0.14px]">
                          {entry.username}
                        </p>
                        {entry.isHumanVerified ? (
                          <Image
                            src="/onboarding/verified-badge.svg"
                            alt="Verified human"
                            width={16}
                            height={16}
                            className="h-4 w-4 shrink-0"
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <p className="text-success-light text-right text-[14px] tracking-[-0.14px] tabular-nums">
                    {metric === "volume" ? entry.volume : formatUsdCurrencyFixedTwo(entry.pnl)}
                  </p>
                </div>
              ))}
            <div
              aria-hidden
              className="h-[calc(env(safe-area-inset-bottom)+88px)]"
            />
          </div>
        </section>
      </div>

      {/* ───────────── DESKTOP LAYOUT ───────────── */}
      <div className="relative hidden min-h-screen md:flex md:flex-col">
        {/* Background */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Image
            src="/line-background.png"
            alt=""
            fill
            loading="eager"
            fetchPriority="low"
            className="object-cover opacity-60 mix-blend-color-dodge"
          />
          <div className="from-background-main/80 to-background-main/30 absolute inset-0 bg-gradient-to-br" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-col px-6 py-8">
          {/* Page header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary-light/15 flex size-10 items-center justify-center rounded-[10px]">
                <Trophy className="text-primary-light size-5" strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="text-text-heading text-[28px] font-bold tracking-[-0.02em]">
                  Leaderboard
                </h1>
                <p className="text-hint text-[13px] tracking-[-0.01em]">
                  Top traders by {METRIC_LABELS[metric].toLowerCase()} · {WINDOW_LABELS[windowFilter]}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              {/* Window filter tabs */}
              <div className="bg-surface-overlay-subtle flex items-center gap-1 rounded-[10px] p-1">
                {VALID_WINDOWS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => updateParams({ window: w })}
                    className={[
                      "rounded-[7px] px-3 py-1.5 text-[13px] font-semibold tracking-[-0.01em] transition-colors",
                      windowFilter === w
                        ? "bg-background-surface text-primary-medium"
                        : "text-hint hover:text-text-sub",
                    ].join(" ")}
                  >
                    {w === "all" ? "All" : w.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Metric toggle */}
              <div className="bg-surface-overlay-subtle flex items-center gap-1 rounded-[10px] p-1">
                {VALID_METRICS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateParams({ mode: m })}
                    className={[
                      "rounded-[7px] px-3 py-1.5 text-[13px] font-semibold tracking-[-0.01em] transition-colors",
                      metric === m
                        ? "bg-background-surface text-primary-medium"
                        : "text-hint hover:text-text-sub",
                    ].join(" ")}
                  >
                    {METRIC_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2-column body */}
          <div className="flex gap-6">
            {/* ── LEFT: Podium + Top-3 cards ── */}
            <div className="flex w-[340px] shrink-0 flex-col gap-4">
              {/* Podium graphic */}
              <div className="relative overflow-hidden rounded-[16px] px-2 pt-12 pb-0">
                <div className="bg-podium-glow/40 absolute top-[-80px] left-1/2 h-[140px] w-[260px] -translate-x-1/2 rounded-[16px] blur-[70px]" />
                <div className="from-primary-light/30 to-primary-light/0 absolute top-[60px] left-1/2 h-[70px] w-[130px] -translate-x-1/2 rounded-[16px] blur-[60px]" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(4,11,24,0)_60%,rgba(4,11,24,0.95)_100%)]" />
                <LeaderboardRank topUsers={topUsers} />
              </div>

              {/* Top-3 cards */}
              <div className="grid grid-cols-3 gap-2">
                {desktopPodiumOrder.map((entry) => (
                  <DesktopTopCard key={entry.rank} entry={entry} metric={metric} />
                ))}
              </div>

              {/* Quick stats summary */}
              <div className="border-border-main bg-background-surface rounded-[12px] border p-4">
                <p className="text-hint mb-3 text-[11px] font-semibold uppercase tracking-[0.05em]">
                  Global Stats
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-text-sub text-[12px] font-medium">Total Traders</p>
                    <p className="text-text-heading text-[18px] font-bold tabular-nums">
                      {filteredEntries.length}+
                    </p>
                  </div>
                  <div>
                    <p className="text-text-sub text-[12px] font-medium">Total Volume</p>
                    <p className="text-text-heading text-[18px] font-bold tabular-nums">
                      $3.2M+
                    </p>
                  </div>
                  <div>
                    <p className="text-text-sub text-[12px] font-medium">Avg Win Rate</p>
                    <p className="text-success-medium text-[18px] font-bold tabular-nums">
                      61%
                    </p>
                  </div>
                  <div>
                    <p className="text-text-sub text-[12px] font-medium">Total Trades</p>
                    <p className="text-text-heading text-[18px] font-bold tabular-nums">
                      4,820+
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Full ranked list ── */}
            <div className="border-border-main bg-background-surface/60 flex min-w-0 flex-1 flex-col rounded-[16px] border backdrop-blur-sm">
              {/* Search + column headers */}
              <div className="border-border-main border-b px-4 py-3">
                <label
                  htmlFor="leaderboard-search-desktop"
                  className="bg-background-main/60 flex h-9 items-center gap-2 rounded-[8px] px-3"
                >
                  <Search className="text-hint h-4 w-4 shrink-0" strokeWidth={2} />
                  <input
                    id="leaderboard-search-desktop"
                    type="search"
                    placeholder="Search by username..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="text-text-main placeholder:text-hint w-full bg-transparent text-[13px] tracking-[-0.14px] outline-none"
                  />
                </label>
              </div>

              {/* Column header */}
              <div className="bg-surface-overlay-subtle/50 border-border-main grid items-center gap-4 border-b px-4 py-2 grid-cols-[28px_minmax(0,1fr)_80px_80px_120px]">
                <p className="text-hint text-[12px] font-semibold uppercase tracking-[0.04em]">#</p>
                <p className="text-hint text-[12px] font-semibold uppercase tracking-[0.04em]">Trader</p>
                <p className="text-hint text-right text-[12px] font-semibold uppercase tracking-[0.04em]">Win Rate</p>
                <p className="text-hint text-right text-[12px] font-semibold uppercase tracking-[0.04em]">Trades</p>
                <div className="flex items-center justify-end gap-1.5">
                  <p className="text-hint text-[12px] font-semibold uppercase tracking-[0.04em]">
                    {METRIC_LABELS[metric]}
                  </p>
                  <button
                    type="button"
                    aria-label="Switch metric"
                    onClick={() => setSheetOpen(true)}
                    className="text-hint hover:text-text-sub md:hidden"
                  >
                    <RefreshIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* List body */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {!isError && (isLoading || isFetching) ? (
                  <div className="flex flex-col divide-y divide-white/5">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div
                        key={`skeleton-${index}`}
                        className="grid animate-pulse grid-cols-[28px_minmax(0,1fr)_80px_80px_120px] items-center gap-4 px-4 py-3"
                      >
                        <div className="bg-surface-overlay-subtle h-4 w-5 rounded" />
                        <div className="flex items-center gap-2.5">
                          <div className="bg-surface-overlay-subtle size-8 rounded-full" />
                          <div className="bg-surface-overlay-subtle h-4 w-28 rounded" />
                        </div>
                        <div className="bg-surface-overlay-subtle ml-auto h-4 w-12 rounded" />
                        <div className="bg-surface-overlay-subtle ml-auto h-4 w-10 rounded" />
                        <div className="bg-surface-overlay-subtle ml-auto h-4 w-20 rounded" />
                      </div>
                    ))}
                  </div>
                ) : null}

                {isError ? (
                  <p className="text-hint px-6 py-8 text-[14px]">
                    Failed to load leaderboard.
                  </p>
                ) : null}

                {!isError && !isLoading && !isFetching && filteredEntries.length === 0 ? (
                  <p className="text-hint px-6 py-8 text-center text-[14px]">
                    No leaderboard data found.
                  </p>
                ) : null}

                {!isLoading && !isFetching && (
                  <div className="divide-border-main divide-y">
                    {filteredEntries.map((entry) => (
                      <LeaderboardRow key={entry.rank} {...entry} metric={metric} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AttributeSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        metric={metric}
        onMetricChange={(m) => updateParams({ mode: m })}
      />
    </div>
  );
}
