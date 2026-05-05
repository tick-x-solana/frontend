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
import { Search } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { LeaderboardControllerGetLeaderboardWindow } from "@/src/services/models";

type LeaderboardWindowFilter = LeaderboardControllerGetLeaderboardWindow;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function LeaderboardRow({
  rank,
  initials,
  username,
  volume,
  pnl,
  isHumanVerified,
}: {
  rank: number;
  initials: string;
  username: string;
  volume: string;
  pnl: number;
  isHumanVerified: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-4 px-4 py-2">
      <div className="flex min-w-0 items-center gap-[10px]">
        <p className="w-4 shrink-0 text-[14px] tracking-[-0.14px] text-white">
          {rank}
        </p>

        <div className="bg-primary-light text-text-inverse flex size-8 shrink-0 items-center justify-center rounded-full px-[3px] text-[14px] font-medium tracking-[-0.14px]">
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
                width={16}
                height={16}
                className="h-4 w-4 shrink-0"
              />
            ) : null}
          </div>
          <p className="text-text-sub truncate text-[14px] tracking-[-0.14px]">
            {volume}
          </p>
        </div>
      </div>

      <p className="text-success-light text-right text-[14px] tracking-[-0.14px] tabular-nums">
        {currencyFormatter.format(pnl)}
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [windowFilter, setWindowFilter] =
    useState<LeaderboardWindowFilter>("all");

  const { entries, isLoading, isFetching, isError } =
    useLeaderboardData(windowFilter);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return entries;
    }

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

  return (
    <div className="bg-background-main h-dvh w-full overflow-hidden">
      <div className="relative mx-auto flex h-full w-full flex-col overflow-hidden">
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

        <section className="-top- relative z-10 shrink-0 px-4 pb-0">
          <div className="flex items-center gap-2">
            <label
              htmlFor="leaderboard-search"
              className="bg-surface-field/90 flex h-10 flex-1 items-center gap-2 rounded-[10px] px-3"
            >
              <Search className="text-hint h-5 w-5 shrink-0" strokeWidth={2} />
              <input
                id="leaderboard-search"
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
                setWindowFilter(value as LeaderboardWindowFilter)
              }
            >
              <SelectTrigger className="bg-surface-field/90 text-text-sub h-10 min-w-[92px] rounded-[10px] border-0 px-3 text-[14px] tracking-[-0.14px]">
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
                PNL
              </p>
              <span className="text-hint text-[16px]" aria-hidden>
                ↻
              </span>
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
                        <div className="bg-surface-overlay-subtle mt-2 h-3 w-24 rounded" />
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

            {!isError &&
            !isLoading &&
            !isFetching &&
            listEntries.length === 0 ? (
              <p className="text-hint px-4 py-4 text-[14px]">
                No leaderboard data found.
              </p>
            ) : null}

            {!isLoading &&
              !isFetching &&
              listEntries.map((entry) => (
                <LeaderboardRow key={entry.rank} {...entry} />
              ))}
            <div
              aria-hidden
              className="h-[calc(env(safe-area-inset-bottom)+88px)]"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
