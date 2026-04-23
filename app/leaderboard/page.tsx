import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import Image from "next/image";

type LeaderboardEntry = {
  rank: number;
  initials: string;
  wallet: string;
  volume: string;
  pnl: string;
  avatarClassName: string;
};

type PodiumEntry = {
  placement: "1st" | "2nd" | "3rd";
  initials: string;
  displayName: string;
  volume: string;
  avatarClassName: string;
  className: string;
  panelClassName: string;
  avatarSizeClassName: string;
  badgeClassName: string;
  titleClassName: string;
};

const leaderboardEntries: LeaderboardEntry[] = [
  {
    rank: 1,
    initials: "AS",
    wallet: "0x4891...28inbvm1",
    volume: "$192,190,290.19",
    pnl: "$621,224,168.29",
    avatarClassName: "bg-primary-light text-text-inverse",
  },
  {
    rank: 2,
    initials: "BS",
    wallet: "0x8723...fgh54jkl",
    volume: "$150,250,172.45",
    pnl: "$513,145,989.75",
    avatarClassName: "bg-primary-light text-text-inverse",
  },
  {
    rank: 3,
    initials: "CS",
    wallet: "0x2345...mno67pqr",
    volume: "$320,185,405.67",
    pnl: "$740,998,115.00",
    avatarClassName: "bg-primary-light text-text-inverse",
  },
  {
    rank: 4,
    initials: "DS",
    wallet: "0x6789...stu12vwx",
    volume: "$250,490,845.90",
    pnl: "$890,335,760.12",
    avatarClassName: "bg-primary-light text-text-inverse",
  },
  {
    rank: 5,
    initials: "ES",
    wallet: "0x4567...yzab34cde",
    volume: "$198,765,432.10",
    pnl: "$634,123,456.78",
    avatarClassName: "bg-primary-light text-text-inverse",
  },
];

const podiumEntries: PodiumEntry[] = [
  {
    placement: "2nd",
    initials: "MP",
    displayName: "myphuo7ng_",
    volume: "$122,190,290.19",
    avatarClassName: "bg-avatar-cyan text-text-inverse",
    className: "left-0 top-[146px] z-10 w-[144px]",
    panelClassName:
      "h-[206px] bg-[linear-gradient(180deg,rgba(10,20,37,0.95)_0%,rgba(5,13,26,0.98)_100%)]",
    avatarSizeClassName: "size-12 text-[21px] tracking-[-0.21px]",
    badgeClassName: "size-5 -bottom-1 -right-1 text-[11px]",
    titleClassName:
      "bottom-[31px] text-[64px] tracking-[-2.56px] opacity-[0.08]",
  },
  {
    placement: "1st",
    initials: "AS",
    displayName: "paullaverick_",
    volume: "$192,190,290.19",
    avatarClassName: "bg-primary-light text-text-inverse",
    className: "left-1/2 top-[88px] z-20 w-[162px] -translate-x-1/2",
    panelClassName:
      "h-[244px] bg-[linear-gradient(180deg,rgba(18,31,52,0.94)_0%,rgba(7,16,31,0.98)_100%)] shadow-[0_0_24px_rgba(208,247,220,0.08)]",
    avatarSizeClassName: "size-14 text-[25px] tracking-[-0.25px]",
    badgeClassName: "size-7 -bottom-[7px] -right-[7px] text-sm",
    titleClassName:
      "bottom-[24px] text-[72px] tracking-[-3.84px] opacity-[0.11] bg-gradient-to-b from-primary-light/18 to-primary-light/0 bg-clip-text text-transparent",
  },
  {
    placement: "3rd",
    initials: "NN",
    displayName: "nphunghucan",
    volume: "$152,190,290.19",
    avatarClassName: "bg-avatar-blue text-text-inverse",
    className: "right-0 top-[146px] z-10 w-[144px]",
    panelClassName:
      "h-[206px] bg-[linear-gradient(180deg,rgba(10,20,37,0.95)_0%,rgba(5,13,26,0.98)_100%)]",
    avatarSizeClassName: "size-12 text-[21px] tracking-[-0.21px]",
    badgeClassName: "size-5 -bottom-1 -right-1 text-[11px]",
    titleClassName:
      "bottom-[31px] text-[64px] tracking-[-2.56px] opacity-[0.08]",
  },
];

const heroParticles = [
  "left-[16px] top-[184px] size-1",
  "left-[50px] top-[214px] size-[3px]",
  "left-[66px] top-[170px] size-[3px]",
  "left-[79px] top-[201px] size-[10px]",
  "left-[98px] top-[138px] size-[2px]",
  "left-[106px] top-[193px] size-1.5",
  "left-[111px] top-[160px] size-[5px]",
  "left-[129px] top-[125px] size-[3px]",
  "left-[148px] top-[145px] size-[5px]",
  "left-[182px] top-[130px] size-[4px]",
  "left-[194px] top-[165px] size-[8px]",
  "left-[227px] top-[183px] size-[7px]",
  "left-[260px] top-[193px] size-[8px]",
  "left-[288px] top-[155px] size-[3px]",
  "left-[305px] top-[204px] size-[9px]",
  "left-[319px] top-[181px] size-1.5",
];

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "border-background-main bg-accent-blue absolute flex items-center justify-center rounded-full border text-white shadow-[0_8px_20px_rgba(23,100,255,0.35)]",
        className,
      )}
    >
      +
    </span>
  );
}

function Avatar({
  initials,
  avatarClassName,
  className,
  badgeClassName,
}: {
  initials: string;
  avatarClassName: string;
  className: string;
  badgeClassName: string;
}) {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "flex items-center justify-center rounded-full font-medium",
          avatarClassName,
          className,
        )}
      >
        {initials}
      </div>
      <VerifiedBadge className={badgeClassName} />
    </div>
  );
}

function LeaderboardRow({
  rank,
  initials,
  wallet,
  volume,
  pnl,
  avatarClassName,
}: LeaderboardEntry) {
  return (
    <div className="border-border-main flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="w-4 shrink-0 text-sm tracking-[-0.14px] text-white">
        {rank}
      </div>

      <Avatar
        initials={initials}
        avatarClassName={avatarClassName}
        className="size-8 text-sm tracking-[-0.14px]"
        badgeClassName="size-4 -bottom-1 -right-1 text-[9px]"
      />

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

function PodiumCard({
  placement,
  initials,
  displayName,
  volume,
  avatarClassName,
  className,
  panelClassName,
  avatarSizeClassName,
  badgeClassName,
  titleClassName,
}: PodiumEntry) {
  const isWinner = placement === "1st";

  return (
    <div className={cn("absolute", className)}>
      <div className="relative">
        <div className="bg-primary-light/25 absolute inset-x-5 top-[-22px] h-16 rounded-full blur-[48px]" />

        <div
          className={cn(
            "border-primary-light/30 relative flex flex-col items-center rounded-t-[18px] border border-b-0 pt-[58px] [clip-path:polygon(18px_0,calc(100%-18px)_0,100%_44px,calc(100%-20px)_100%,20px_100%,0_44px)]",
            panelClassName,
          )}
        >
          <div className="bg-primary-light/90 pointer-events-none absolute inset-x-[14px] top-[34px] h-px shadow-[0_0_18px_rgba(208,247,220,0.8)]" />
          <div className="pointer-events-none absolute inset-x-[42px] top-[34px] h-[1px] bg-white/80 blur-[2px]" />

          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <Avatar
              initials={initials}
              avatarClassName={avatarClassName}
              className={cn(
                "shadow-[0_14px_40px_rgba(208,247,220,0.2)]",
                avatarSizeClassName,
              )}
              badgeClassName={badgeClassName}
            />
          </div>

          <div className="flex flex-col items-center px-3 text-center">
            <p
              className={cn(
                "max-w-full truncate font-semibold tracking-[-0.24px] text-white",
                isWinner ? "text-[17px]" : "text-[15px]",
              )}
            >
              {displayName}
            </p>
            <p
              className={cn(
                "text-text-sub mt-1 tracking-[-0.14px]",
                isWinner ? "text-[14px]" : "text-[12px]",
              )}
            >
              {volume}
            </p>
          </div>

          <p
            className={cn(
              "absolute left-1/2 -translate-x-1/2 font-mono font-extrabold uppercase",
              placement === "1st"
                ? ""
                : "bg-gradient-to-b from-[#1d2a39] to-[#0a1320] bg-clip-text text-transparent",
              titleClassName,
            )}
          >
            {placement}
          </p>
        </div>
      </div>
    </div>
  );
}

function LeaderboardTabs() {
  return (
    <div className="bg-surface-overlay-subtle flex items-center rounded-xl p-1">
      <button
        type="button"
        className="text-primary-medium relative rounded-[8px] bg-[linear-gradient(90deg,rgba(13,30,48,0.8)_0%,rgba(13,30,48,0.8)_100%),linear-gradient(90deg,#A8E8BB_0%,#A8E8BB_100%)] px-2 py-1.5 text-base font-semibold tracking-[-0.16px]"
      >
        Human
        <span
          aria-hidden
          className="bg-primary-light absolute right-[19.64%] bottom-0 left-[19.64%] h-[3px] rounded-full"
        />
      </button>
      <button
        type="button"
        className="text-hint px-2 py-1.5 text-base font-semibold tracking-[-0.16px]"
      >
        AI Agents
      </button>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <div className="bg-background-main min-h-full">
      <div className="relative mx-auto w-full max-w-[960px] overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[430px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(168,232,187,0.34),rgba(168,232,187,0.04)_28%,rgba(4,11,24,0)_58%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,11,24,0.72)_0%,rgba(4,11,24,0.94)_44%,rgba(4,11,24,1)_100%)]" />
          <Image
            src="/line-background.svg"
            alt=""
            fill
            priority
            className="object-cover opacity-65 mix-blend-screen"
          />
        </div>

        <div className="relative mx-auto w-full max-w-[393px] pb-8 md:max-w-[760px] md:px-6 md:pb-12">
          <section className="px-4 pt-4 md:px-0 md:pt-10">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-[24px] font-semibold tracking-[-0.24px] text-white md:text-[36px] md:tracking-[-0.48px]">
                Leaderboard
              </h1>
              <LeaderboardTabs />
            </div>
          </section>

          <section className="relative h-[333px] md:mt-2 md:h-[390px]">
            <div className="absolute inset-x-0 top-[40px] h-[236px] bg-[radial-gradient(circle_at_50%_0%,rgba(208,247,220,0.22),rgba(208,247,220,0.05)_38%,rgba(4,11,24,0)_72%)] blur-[10px]" />

            {heroParticles.map((particle) => (
              <span
                key={particle}
                aria-hidden
                className={cn(
                  "bg-primary-light/45 absolute rounded-full",
                  particle,
                )}
              />
            ))}

            {podiumEntries.map((entry) => (
              <PodiumCard key={entry.placement} {...entry} />
            ))}

            <div className="absolute inset-x-0 bottom-[58px] h-[1px] bg-[linear-gradient(90deg,rgba(76,120,188,0.72)_0%,rgba(76,120,188,0.08)_100%)]" />
            <div className="absolute inset-x-0 bottom-[56px] h-[42px] bg-[linear-gradient(180deg,rgba(6,14,27,0)_0%,#060e1b_100%)]" />
            <div className="border-border-main absolute inset-x-0 bottom-0 h-[25px] border-t bg-[linear-gradient(180deg,#081121_0%,#050d1a_100%)]" />
          </section>

          <section className="mt-1 space-y-4 px-4 md:px-0">
            <div className="flex items-center gap-2">
              <label
                htmlFor="leaderboard-search"
                className="bg-surface-field border-border-main text-text-sub flex h-10 flex-1 items-center gap-2 rounded-[10px] border px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
              >
                <Search
                  className="text-hint h-5 w-5 shrink-0"
                  strokeWidth={2}
                />
                <input
                  id="leaderboard-search"
                  type="search"
                  placeholder="Search by wallet address"
                  className="text-text-main placeholder:text-hint w-full bg-transparent text-[14px] tracking-[-0.14px] focus:outline-none"
                />
              </label>

              <button
                type="button"
                className="bg-surface-field border-border-main text-text-sub flex h-10 items-center gap-2 rounded-[10px] border px-3 text-[14px] tracking-[-0.14px] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
              >
                <span>30D</span>
                <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>

            <div className="border-border-main bg-surface-card/40 overflow-hidden border-y backdrop-blur-[10px]">
              <div className="border-border-main flex items-center justify-between border-b bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)] px-4 py-2">
                <span className="text-text-sub text-[14px] tracking-[-0.14px]">
                  Account
                </span>
                <span className="text-text-sub flex items-center gap-2 text-[14px] tracking-[-0.14px]">
                  PNL
                  <span aria-hidden className="text-primary-light text-base">
                    ↻
                  </span>
                </span>
              </div>

              <div className="bg-surface-card-strong/55">
                {leaderboardEntries.map((entry) => (
                  <LeaderboardRow key={entry.rank} {...entry} />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
