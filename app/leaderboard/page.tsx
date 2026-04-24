import ActiveTab from "@/src/components/common/ActiveTab";
import { ChevronDown, Search } from "lucide-react";
import Image from "next/image";

type LeaderboardEntry = {
  rank: number;
  initials: string;
  wallet: string;
  volume: string;
  pnl: string;
};

const leaderboardEntries: LeaderboardEntry[] = [
  {
    rank: 1,
    initials: "AS",
    wallet: "0x4891...281nbvm1",
    volume: "$192,190,290.19",
    pnl: "$621,224,168.29",
  },
  {
    rank: 2,
    initials: "BS",
    wallet: "0x8723...fgh54jkl",
    volume: "$150,250,172.45",
    pnl: "$513,145,989.75",
  },
  {
    rank: 3,
    initials: "CS",
    wallet: "0x2345...mno67pqr",
    volume: "$320,185,405.67",
    pnl: "$740,998,115.00",
  },
  {
    rank: 4,
    initials: "DS",
    wallet: "0x6789...stu12vwx",
    volume: "$250,490,845.90",
    pnl: "$890,335,760.12",
  },
  {
    rank: 5,
    initials: "ES",
    wallet: "0x4567...yzab34cde",
    volume: "$198,765,432.10",
    pnl: "$634,123,456.78",
  },
];

function LeaderboardRow({
  rank,
  initials,
  wallet,
  volume,
  pnl,
}: LeaderboardEntry) {
  return (
    <div className="flex items-center gap-[10px] px-4 py-2">
      <p className="w-4 shrink-0 text-[14px] tracking-[-0.14px] text-white">
        {rank}
      </p>

      <div className="bg-primary-light text-text-inverse flex size-8 shrink-0 items-center justify-center rounded-full px-[3px] text-[14px] font-medium tracking-[-0.14px]">
        {initials}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-text-main truncate text-[14px] font-semibold tracking-[-0.14px]">
          {wallet}
        </p>
        <p className="text-text-sub truncate text-[14px] tracking-[-0.14px]">
          {volume}
        </p>
      </div>

      <p className="text-success-light shrink-0 text-right text-[14px] tracking-[-0.14px]">
        {pnl}
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <div className="bg-background-main h-full w-full">
      <div className="relative mx-auto w-full overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="bg-background-main absolute inset-0" />
          <Image
            src="/line-background.png"
            alt=""
            fill
            priority
            className="object-cover opacity-95 mix-blend-color-dodge"
          />
          <div className="from-background-main/70 to-background-main absolute inset-0 bg-gradient-to-b to-[32.5%]" />
        </div>

        <div className="absolute px-4 pt-4">
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
                activeTab="human"
                className="bg-surface-overlay-subtle"
              />
            </div>
          </div>
        </div>

        <section className="relative mt-1 w-full overflow-hidden rounded-2xl">
          <div className="relative aspect-[1572/1860] w-full">
            <Image
              src="/leaderboard.png"
              alt="Leaderboard podium"
              fill
              priority
              className="w-screen object-cover object-center"
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
                placeholder="Search by wallet address"
                className="text-text-main placeholder:text-hint w-full bg-transparent text-[14px] tracking-[-0.14px] outline-none"
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
          <div className="bg-surface-overlay-subtle border-border-main flex h-8 items-center border-b">
            <div className="w-[244px] px-4">
              <p className="text-text-sub text-[14px] tracking-[-0.14px]">
                Account
              </p>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
              <p className="text-text-sub text-[14px] tracking-[-0.14px]">
                PNL
              </p>
              <span className="text-hint text-[16px]" aria-hidden>
                ↻
              </span>
            </div>
          </div>

          <div className="bg-background-main">
            {leaderboardEntries.map((entry) => (
              <LeaderboardRow key={entry.rank} {...entry} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
