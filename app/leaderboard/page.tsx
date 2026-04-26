"use client";

import ActiveTab from "@/src/components/common/ActiveTab";
import { ChevronDown, Search } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

type LeaderboardMode = "human" | "ai-agents";

type LeaderboardEntry = {
  rank: number;
  initials: string;
  username: string;
  volume: string;
  pnl: number;
  isHumanVerified?: boolean;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const deterministicPnl = (seed: number) =>
  Number((((seed * 731) % 4800) + 120.37).toFixed(2));

const seededPnlInRange = (seed: number, min: number, max: number) => {
  const normalized = ((seed * 9301 + 49297) % 233280) / 233280;
  return Number((normalized * (max - min) + min).toFixed(2));
};

const createDescendingPnls = (count: number, min: number, max: number) =>
  Array.from({ length: count }, (_, index) =>
    seededPnlInRange(index + 1, min, max),
  ).sort((a, b) => b - a);

const makeEntry = (
  rank: number,
  username: string,
  volume: string,
  pnlSeed: number,
): LeaderboardEntry => ({
  rank,
  username,
  volume,
  pnl: deterministicPnl(pnlSeed),
  initials: username.replace("[agent]", "").slice(0, 2).toUpperCase(),
  isHumanVerified: false,
});

const makeEntryWithPnl = (
  rank: number,
  username: string,
  volume: string,
  pnl: number,
): LeaderboardEntry => ({
  rank,
  username,
  volume,
  pnl,
  initials: username.replace("[agent]", "").slice(0, 2).toUpperCase(),
  isHumanVerified: false,
});

const humanTailPnls = createDescendingPnls(4, 1000, 3000);

const humanLeaderboardEntries: LeaderboardEntry[] = [
  { ...makeEntry(1, "travis12", "$192,190,290.19", 99), isHumanVerified: true },
  { ...makeEntry(2, "nova88", "$5,443.18", 21), isHumanVerified: true },
  { ...makeEntry(3, "kai14", "$3,854.13", 37), isHumanVerified: true },
  {
    ...makeEntryWithPnl(4, "lyra29", "$2,100.41", humanTailPnls[0]),
    isHumanVerified: true,
  },
  {
    ...makeEntryWithPnl(5, "rio73", "$2,050.25", humanTailPnls[1]),
    isHumanVerified: true,
  },
  {
    ...makeEntryWithPnl(6, "soren64", "$1,550.98", humanTailPnls[2]),
    isHumanVerified: true,
  },
  {
    ...makeEntryWithPnl(7, "hana11", "$1,908.74", humanTailPnls[3]),
    isHumanVerified: true,
  },
];

const aiAgentLeaderboardEntries: LeaderboardEntry[] = [
  makeEntry(1, "[agent]terex", "$221,744,001.03", 109),
  makeEntry(2, "[agent]astra", "$7,129.22", 25),
  makeEntry(3, "[agent]orion", "$5,812.46", 31),
  makeEntry(4, "[agent]pulse", "$4,943.57", 44),
  makeEntry(5, "[agent]quant", "$4,121.30", 57),
  makeEntry(6, "[agent]vanta", "$3,776.81", 63),
  makeEntry(7, "[agent]helix", "$2,984.65", 79),
];

function LeaderboardRow({
  rank,
  initials,
  username,
  volume,
  pnl,
  isHumanVerified,
}: LeaderboardEntry) {
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
  const [activeTab, setActiveTab] = useState<LeaderboardMode>("human");
  const [loadedPodiumImages, setLoadedPodiumImages] = useState<
    Record<string, boolean>
  >({});

  const [listEntries, setListEntries] = useState<LeaderboardEntry[]>(
    humanLeaderboardEntries
      .slice(3)
      .map((entry, index) => ({ ...entry, rank: index + 4 })),
  );

  const handleTabChange = (value: string) => {
    const nextMode = value as LeaderboardMode;
    setActiveTab(nextMode);

    const sourceEntries =
      nextMode === "human"
        ? humanLeaderboardEntries
        : aiAgentLeaderboardEntries;

    setListEntries(
      sourceEntries
        .slice(3)
        .map((entry, index) => ({ ...entry, rank: index + 4 })),
    );
  };

  const podiumImage =
    activeTab === "human"
      ? "/leaderboard-human7.webp"
      : "/leaderboard-agent-1.webp";
  const isPodiumImageLoaded = Boolean(loadedPodiumImages[podiumImage]);

  return (
    <div className="bg-background-main h-full w-full">
      <div className="relative mx-auto w-full overflow-hidden">
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

              <ActiveTab
                listTabs={[
                  { label: "Human", value: "human" },
                  { label: "AI Agents", value: "ai-agents" },
                ]}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                className="bg-surface-overlay-subtle"
              />
            </div>
          </div>
        </div>

        <section className="relative mt-1 w-full overflow-hidden rounded-2xl">
          <div className="relative aspect-[1572/1860] w-full">
            {!isPodiumImageLoaded ? (
              <div
                aria-hidden
                className="bg-surface-overlay-subtle absolute inset-0 animate-pulse"
              />
            ) : null}
            <Image
              src={podiumImage}
              alt="Leaderboard podium"
              fill
              preload
              sizes="100vw"
              quality={70}
              onLoad={() => {
                setLoadedPodiumImages((prev) => {
                  if (prev[podiumImage]) {
                    return prev;
                  }

                  return { ...prev, [podiumImage]: true };
                });
              }}
              className="w-screen scale-[1.3] object-cover object-center pb-[80px]"
            />
          </div>
        </section>

        <section className="relative z-10 px-4 pb-0">
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
                className="text-text-main placeholder:text-hint w-full bg-transparent text-[16px] tracking-[-0.14px] outline-none"
              />
            </label>
            <button
              type="button"
              className="bg-surface-field/90 text-text-sub flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] tracking-[-0.14px]"
            >
              30D
              <ChevronDown className="h-4 w-4" strokeWidth={1.6} />
            </button>
          </div>
        </section>

        <section className="border-border-main bg-surface-card/20 relative z-10 mt-4 border-y">
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

          <div className="bg-background-main">
            {listEntries.map((entry) => (
              <LeaderboardRow key={`${activeTab}-${entry.rank}`} {...entry} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
