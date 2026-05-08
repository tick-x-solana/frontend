"use client";

import LeaderboardRank from "@/src/features/leaderboard/components/LeaderboardRank";
import { useLeaderboardData } from "@/src/features/leaderboard/hooks/useLeaderboardData";
import { CheckIcon } from "@/src/assets/icons";
import { Search, Trophy } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  LeaderboardControllerGetLeaderboardWindow,
  LeaderboardControllerGetLeaderboardMetric,
} from "@/src/services/models";
import { Sheet } from "react-modal-sheet";
import {
  formatUsdCurrency,
  formatUsdCurrencyFixedTwo,
} from "@/src/utils/formatters";
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
      </div>
      <span
        className={`text-[13px] font-bold tracking-[0.02em] ${medalColors[entry.rank] ?? "text-hint"}`}
      >
        {medalLabel[entry.rank]}
      </span>
      <p className="text-text-heading w-full truncate text-[13px] font-semibold tracking-[-0.01em]">
        {entry.username}
      </p>
      <div className="border-border-main w-full border-t pt-2">
        <p className="text-success-light text-[15px] font-bold tracking-[-0.01em] tabular-nums">
          {metric === "volume"
            ? entry.volume
            : formatUsdCurrencyFixedTwo(entry.pnl)}
        </p>
        <p className="text-hint text-[11px] font-medium tracking-[0.04em] uppercase">
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

  const { entries } = useLeaderboardData(windowFilter, metric);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.username.toLowerCase().includes(q));
  }, [entries, searchQuery]);

  const topUsers = useMemo(
    () => filteredEntries.filter((e) => e.rank <= 3),
    [filteredEntries],
  );

  // Desktop table shows rank 4+
  const tableEntries = useMemo(
    () => filteredEntries.filter((e) => e.rank > 3),
    [filteredEntries],
  );

  // Podium order: 2nd left, 1st center, 3rd right
  const desktopPodiumOrder = useMemo(() => {
    const second = topUsers.find((u) => u.rank === 2);
    const first = topUsers.find((u) => u.rank === 1);
    const third = topUsers.find((u) => u.rank === 3);
    return [second, first, third].filter(Boolean) as typeof topUsers;
  }, [topUsers]);

  return (
    <div className="bg-background-main min-h-dvh w-full">
      {/* ───────────── MOBILE LAYOUT ───────────── */}
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

        {/* Title + filters */}
        <div className="absolute z-3 flex w-full items-center justify-between px-4 pt-4">
          <h1 className="text-[24px] font-semibold tracking-[-0.24px] text-white">
            Leaderboard
          </h1>
          <div className="flex items-center gap-2">
            <div className="bg-surface-overlay-subtle flex items-center gap-0.5 rounded-[10px] p-1">
              {VALID_WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => updateParams({ window: w })}
                  className={[
                    "rounded-[7px] px-2 py-1 text-[11px] font-semibold tracking-[-0.01em] transition-colors",
                    windowFilter === w
                      ? "bg-background-surface text-primary-medium"
                      : "text-hint",
                  ].join(" ")}
                >
                  {w === "all" ? "All" : w.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="bg-surface-overlay-subtle flex items-center gap-0.5 rounded-[10px] p-1">
              {VALID_METRICS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateParams({ mode: m })}
                  className={[
                    "rounded-[7px] px-2 py-1 text-[11px] font-semibold tracking-[-0.01em] transition-colors",
                    metric === m
                      ? "bg-background-surface text-primary-medium"
                      : "text-hint",
                  ].join(" ")}
                >
                  {METRIC_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Podium — rank 1–3 */}
        <section className="relative mt-1 w-full shrink-0 overflow-hidden rounded-2xl px-2 pt-16 pb-3">
          <div className="bg-podium-glow/55 absolute top-[-140px] left-1/2 h-[170px] w-[280px] -translate-x-1/2 rounded-[16px] blur-[80px]" />
          <div className="from-primary-light/45 to-primary-light/0 absolute top-[84px] left-1/2 h-[90px] w-[153px] -translate-x-1/2 rounded-[16px] blur-[80px]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(4,11,24,0)_70%,rgba(4,11,24,0.98)_100%)]" />
          <LeaderboardRank topUsers={topUsers} />
        </section>

        {/* Table — rank 4+ */}
        <div className="border-border-main bg-background-surface/50 relative z-10 mx-4 mb-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border backdrop-blur-sm">
          {/* Search */}
          <div className="border-border-main flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <label
              htmlFor="leaderboard-search-mobile"
              className="bg-background-main/70 flex h-8 flex-1 items-center gap-2 rounded-[8px] px-3"
            >
              <Search className="text-hint h-4 w-4 shrink-0" strokeWidth={2} />
              <input
                id="leaderboard-search-mobile"
                type="search"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-text-main placeholder:text-hint w-full bg-transparent text-[13px] tracking-[-0.14px] outline-none"
              />
            </label>
            <p className="text-hint text-[11px] font-medium tabular-nums">
              {tableEntries.length} traders
            </p>
          </div>

          {/* Column headers */}
          <div className="bg-surface-overlay-subtle/60 border-border-main grid grid-cols-[24px_minmax(0,1fr)_52px_36px_80px] items-center gap-2 border-b px-3 py-2">
            <p className="text-hint text-[10px] font-semibold tracking-wider uppercase">
              #
            </p>
            <p className="text-hint text-[10px] font-semibold tracking-wider uppercase">
              Trader
            </p>
            <p className="text-hint text-right text-[10px] font-semibold tracking-wider uppercase">
              Win %
            </p>
            <p className="text-hint text-right text-[10px] font-semibold tracking-wider uppercase">
              Trades
            </p>
            <p className="text-hint text-right text-[10px] font-semibold tracking-wider uppercase">
              {METRIC_LABELS[metric]}
            </p>
          </div>

          {tableEntries.length === 0 && (
            <p className="text-hint px-3 py-6 text-center text-[13px]">
              No results found.
            </p>
          )}

          <div className="divide-border-main min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
            {tableEntries.map((entry) => (
              <div
                key={entry.rank}
                className="grid grid-cols-[24px_minmax(0,1fr)_52px_36px_80px] items-center gap-2 px-3 py-2"
              >
                <p
                  className={`text-[13px] font-bold tabular-nums ${getRankBadgeStyle(entry.rank)}`}
                >
                  {entry.rank}
                </p>

                <div className="flex min-w-0 items-center gap-2">
                  <div className="bg-primary-light text-text-inverse flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium">
                    {entry.initials}
                  </div>
                  <p className="text-text-main truncate text-[13px] font-semibold tracking-[-0.01em]">
                    {entry.username}
                  </p>
                </div>

                <p className="text-success-medium text-right text-[12px] font-semibold tabular-nums">
                  {entry.winRate}%
                </p>

                <p className="text-text-sub text-right text-[12px] tabular-nums">
                  {entry.totalTrades}
                </p>

                <p className="text-success-light text-right text-[13px] font-semibold tabular-nums">
                  {metric === "volume"
                    ? entry.volume
                    : formatUsdCurrency(entry.pnl)}
                </p>
              </div>
            ))}
            <div
              aria-hidden
              className="h-[calc(env(safe-area-inset-bottom)+88px)]"
            />
          </div>
        </div>
      </div>

      {/* ───────────── DESKTOP LAYOUT ───────────── */}
      <div className="relative hidden h-dvh flex-col overflow-hidden md:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Image
            src="/line-background.png"
            alt=""
            fill
            loading="eager"
            fetchPriority="low"
            className="object-cover opacity-60 mix-blend-color-dodge"
          />
          <div className="from-background-main/80 to-background-main/30 absolute inset-0 bg-gradient-to-b" />
        </div>

        <div className="relative z-10 mx-auto flex h-full w-full max-w-[960px] flex-col px-6 pb-6">
          {/* ── Podium + glow section ── */}
          <section className="relative shrink-0 overflow-hidden pt-10 pb-0">
            <div className="bg-podium-glow/50 absolute top-[-60px] left-1/2 h-[180px] w-[340px] -translate-x-1/2 rounded-full blur-[90px]" />
            <div className="from-primary-light/40 to-primary-light/0 absolute top-[80px] left-1/2 h-[100px] w-[160px] -translate-x-1/2 rounded-full blur-[70px]" />

            {/* Title + filters */}
            <div className="relative z-10 mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary-light/15 flex size-9 items-center justify-center rounded-[9px]">
                  <Trophy
                    className="text-primary-light size-[18px]"
                    strokeWidth={1.8}
                  />
                </div>
                <div>
                  <h1 className="text-text-heading text-[24px] font-bold tracking-[-0.02em]">
                    Leaderboard
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-surface-overlay-subtle flex items-center gap-0.5 rounded-[10px] p-1">
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
                <div className="bg-surface-overlay-subtle flex items-center gap-0.5 rounded-[10px] p-1">
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

            {/* Podium graphic */}
            <div className="relative flex justify-center">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(4,11,24,0)_65%,rgba(4,11,24,1)_100%)]" />
              <LeaderboardRank topUsers={topUsers} />
            </div>
          </section>

          {/* ── Ranked table (rank 4+) — fills remaining height, rows scroll internally ── */}
          <div className="border-border-main bg-background-surface/50 mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border backdrop-blur-sm">
            {/* Search bar */}
            <div className="border-border-main flex shrink-0 items-center gap-3 border-b px-4 py-3">
              <label
                htmlFor="leaderboard-search-desktop"
                className="bg-background-main/70 flex h-9 flex-1 items-center gap-2 rounded-[8px] px-3"
              >
                <Search
                  className="text-hint h-4 w-4 shrink-0"
                  strokeWidth={2}
                />
                <input
                  id="leaderboard-search-desktop"
                  type="search"
                  placeholder="Search by wallet address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-text-main placeholder:text-hint w-full bg-transparent text-[13px] tracking-[-0.14px] outline-none"
                />
              </label>
              <p className="text-hint text-[12px] font-medium tabular-nums">
                {tableEntries.length} traders
              </p>
            </div>

            {/* Column headers */}
            <div className="bg-surface-overlay-subtle/60 border-border-main grid grid-cols-[32px_minmax(0,1fr)_90px_90px_120px_130px] items-center gap-4 border-b px-5 py-2.5">
              <p className="text-hint text-[11px] font-semibold tracking-wider uppercase">
                #
              </p>
              <p className="text-hint text-[11px] font-semibold tracking-wider uppercase">
                Trader
              </p>
              <p className="text-hint text-right text-[11px] font-semibold tracking-wider uppercase">
                Win Rate
              </p>
              <p className="text-hint text-right text-[11px] font-semibold tracking-wider uppercase">
                Trades
              </p>
              <p className="text-hint text-right text-[11px] font-semibold tracking-wider uppercase">
                Volume
              </p>
              <p className="text-hint text-right text-[11px] font-semibold tracking-wider uppercase">
                {METRIC_LABELS[metric]}
              </p>
            </div>

            {/* Rows — starting from rank 4 */}
            {tableEntries.length === 0 && (
              <p className="text-hint px-5 py-8 text-center text-[14px]">
                No results found.
              </p>
            )}

            <div className="divide-border-main min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
              {tableEntries.map((entry) => (
                <div
                  key={entry.rank}
                  className="hover:bg-surface-overlay-subtle/30 grid grid-cols-[32px_minmax(0,1fr)_90px_90px_120px_130px] items-center gap-4 px-5 py-3 transition-colors"
                >
                  <p
                    className={`text-[14px] font-bold tabular-nums ${getRankBadgeStyle(entry.rank)}`}
                  >
                    {entry.rank}
                  </p>

                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-primary-light text-text-inverse flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-medium">
                      {entry.initials}
                    </div>
                    <div className="flex min-w-0 items-center gap-1">
                      <p className="text-text-main truncate text-[14px] font-semibold tracking-[-0.01em]">
                        {entry.username}
                      </p>
                    </div>
                  </div>

                  <p className="text-success-medium text-right text-[13px] font-semibold tabular-nums">
                    {entry.winRate}%
                  </p>

                  <p className="text-text-sub text-right text-[13px] tabular-nums">
                    {entry.totalTrades}
                  </p>

                  <p className="text-text-sub text-right text-[13px] tabular-nums">
                    {entry.volume}
                  </p>

                  <p className="text-success-light text-right text-[14px] font-semibold tabular-nums">
                    {metric === "volume"
                      ? entry.volume
                      : formatUsdCurrency(entry.pnl)}
                  </p>
                </div>
              ))}
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
