"use client";

import { useMemo, useState, type ComponentType } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import ExploreAiAgentIcon from "@/src/assets/icons/explore-ai-agent.svg";
import ExploreFeatureEllipseBottomIcon from "@/src/assets/icons/explore-feature-ellipse-bottom.svg";
import ExploreFeatureEllipseLeftIcon from "@/src/assets/icons/explore-feature-ellipse-left.svg";
import ExploreFeatureOrbIcon from "@/src/assets/icons/explore-feature-orb.svg";
import ExploreFollowTradingIcon from "@/src/assets/icons/explore-follow-trading.svg";
import ExploreIntegrityIcon from "@/src/assets/icons/explore-integrity.svg";
import ExploreLiquidityIcon from "@/src/assets/icons/explore-liquidity.svg";
import ExploreReferralIcon from "@/src/assets/icons/explore-referral.svg";
import ExploreVaultIcon from "@/src/assets/icons/explore-vault.svg";
import SocialDiscordFigmaIcon from "@/src/assets/icons/social-discord-figma.svg";
import SocialXFigmaIcon from "@/src/assets/icons/social-x-figma.svg";
import TetherIcon from "@/src/assets/icons/tether.svg";
import WldMarketIcon from "@/src/assets/icons/wld-market.svg";
import {
  ArrowLeft,
  BadgeCheck,
  Bot,
  CircleDashed,
  Copy,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import FollowTradeView from "@/src/features/referrals/components/FollowTradeView";
import CREProofView from "@/src/features/referrals/components/CREProofView";
import HowItWork from "@/src/features/referrals/components/HowItWork";
import ReferAFriend from "@/src/features/referrals/components/ReferAFriend";
import ReferralsHeader from "@/src/features/referrals/components/ReferralsHeader";
import { buildMiniAppReferralLink } from "@/src/features/referrals/constants";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { EXPLORE_TAB_QUERY_KEY } from "@/src/constants";

type ExploreView =
  | "home"
  | "vault"
  | "liquidity"
  | "follow-trade"
  | "referrals"
  | "integrity"
  | "ai-agent";

type VaultRow = {
  label: string;
  value: string;
  valueClassName?: string;
};

type LiquidityPool = {
  id: string;
  pair: string;
  apr: string;
  tvl: string;
  volume: string;
};

type VaultDataset = {
  totalValueLocked: string;
  protocolVaults: VaultRow[][];
  userVaults: VaultRow[][];
};

const humanVaultDataset: VaultDataset = {
  totalValueLocked: "$22,200",
  protocolVaults: [
    [
      { label: "Vault", value: "Hyperliquidity Provider (HLP)" },
      { label: "Leader", value: "0x677d...84e7" },
      { label: "APR", value: "-0.19%", valueClassName: "text-red-400" },
      { label: "TVL", value: "$29,480.00" },
      { label: "Your Deposit", value: "$0.00" },
      { label: "Age (days)", value: "238" },
      { label: "Snapshot", value: "-" },
    ],
    [
      { label: "Vault", value: "[ Systemic Strategies] HyperGrowth" },
      { label: "Leader", value: "0x2b80...6f6b" },
      { label: "APR", value: "-0.19%", valueClassName: "text-red-400" },
      { label: "TVL", value: "$22,760.00" },
      { label: "Your Deposit", value: "$0.00" },
      { label: "Age (days)", value: "238" },
      { label: "Snapshot", value: "-" },
    ],
  ],
  userVaults: [
    [
      { label: "Vault", value: "BlackRock Fund 101" },
      { label: "Leader", value: "0x2b80...6f6b" },
      { label: "APR", value: "2.18%" },
      { label: "TVL", value: "$12,340.00" },
      { label: "Your Deposit", value: "$4,200.00" },
      { label: "Age (days)", value: "238" },
      { label: "Snapshot", value: "-" },
    ],
    [
      { label: "Vault", value: "BlackRock Fund 102" },
      { label: "Leader", value: "0x677d...84e7" },
      { label: "APR", value: "1.76%" },
      { label: "TVL", value: "$9,860.00" },
      { label: "Your Deposit", value: "$2,150.00" },
      { label: "Age (days)", value: "124" },
      { label: "Snapshot", value: "-" },
    ],
  ],
};

const agentVaultDataset: VaultDataset = {
  totalValueLocked: "$28,600",
  protocolVaults: [
    [
      { label: "Vault", value: "Agent Morpho Delta Neutral" },
      { label: "Leader", value: "agent-morpho-01" },
      { label: "APR", value: "7.03%" },
      { label: "TVL", value: "$37,600" },
      { label: "Your Deposit", value: "$0.00" },
      { label: "Age (days)", value: "58" },
      { label: "Snapshot", value: "2026-04-24" },
    ],
    [
      { label: "Vault", value: "Agent Uni v3 Rebalancer WLD/USDC" },
      { label: "Leader", value: "agent-univ3-07" },
      { label: "APR", value: "5.64%" },
      { label: "TVL", value: "$24,700" },
      { label: "Your Deposit", value: "$0.00" },
      { label: "Age (days)", value: "46" },
      { label: "Snapshot", value: "2026-04-24" },
    ],
  ],
  userVaults: [
    [
      { label: "Vault", value: "Agent Quant Pulse 01" },
      { label: "Leader", value: "agent-quant-01" },
      { label: "APR", value: "6.42%" },
      { label: "TVL", value: "$15,480.00" },
      { label: "Your Deposit", value: "$1,980.00" },
      { label: "Age (days)", value: "36" },
      { label: "Snapshot", value: "2026-04-24" },
    ],
    [
      { label: "Vault", value: "Agent Momentum Grid 02" },
      { label: "Leader", value: "agent-grid-02" },
      { label: "APR", value: "5.87%" },
      { label: "TVL", value: "$13,120.00" },
      { label: "Your Deposit", value: "$1,240.00" },
      { label: "Age (days)", value: "27" },
      { label: "Snapshot", value: "2026-04-24" },
    ],
  ],
};

const liquidityPools: LiquidityPool[] = [
  {
    id: "wld-usdt-005",
    pair: "WLD/USDT Market · 0.05%",
    apr: "2.31%",
    tvl: "$184,220",
    volume: "$412,740",
  },
  {
    id: "wld-usdt-03",
    pair: "WLD/USDT Market · 0.30%",
    apr: "3.84%",
    tvl: "$96,870",
    volume: "$238,510",
  },
  {
    id: "wld-usdt-100",
    pair: "WLD/USDT Market · 1.00%",
    apr: "5.12%",
    tvl: "$58,430",
    volume: "$121,980",
  },
  {
    id: "wld-usdt-wide",
    pair: "WLD/USDT Market · Wide Range",
    apr: "1.92%",
    tvl: "$41,260",
    volume: "$67,540",
  },
  {
    id: "wld-usdt-narrow",
    pair: "WLD/USDT Market · Narrow Range",
    apr: "6.28%",
    tvl: "$74,510",
    volume: "$159,230",
  },
];

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={onClick}
      className="bg-background-surface text-text-main flex size-10 items-center justify-center rounded-[8px]"
    >
      <ArrowLeft className="size-5" strokeWidth={1.9} />
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-text-heading text-[16px] font-semibold tracking-[-0.01em]">
      {children}
    </h2>
  );
}

function KVCard({ rows }: { rows: VaultRow[] }) {
  return (
    <div className="bg-background-surface w-full rounded-[8px] px-3 py-3">
      {rows.map((row) => (
        <div
          key={`${row.label}-${row.value}`}
          className="grid grid-cols-[1fr_auto] items-center gap-3 py-0.5"
        >
          <p className="text-text-sub text-[14px] font-semibold tracking-[-0.01em]">
            {row.label}
          </p>
          <p
            className={`text-text-main text-right text-[14px] font-medium tracking-[-0.01em] ${row.valueClassName ?? ""}`}
          >
            {row.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function LiquidityCard({ pool }: { pool: LiquidityPool }) {
  return (
    <article className="border-border-subtle w-full rounded-[8px] border px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-6 items-center">
            <span className="bg-background-subtle flex size-6 items-center justify-center rounded-full">
              <WldMarketIcon aria-hidden className="size-4" />
            </span>
            <span className="bg-background-subtle -ml-2 flex size-6 items-center justify-center rounded-full">
              <TetherIcon aria-hidden className="size-4" />
            </span>
          </span>
          <p className="text-text-heading text-[16px] font-semibold tracking-[-0.01em]">
            {pool.pair}
          </p>
        </div>
        <button type="button" aria-label="Favorite pool">
          <Star className="text-text-sub size-5" strokeWidth={1.8} />
        </button>
      </div>

      <div className="bg-border-main mb-2 h-px w-full" />

      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-text-sub text-[12px] font-medium tracking-[-0.01em]">
            APR
          </p>
          <p className="text-success-medium text-[14px] font-semibold tracking-[-0.01em]">
            {pool.apr}
          </p>
        </div>
        <div>
          <p className="text-text-sub text-[12px] font-medium tracking-[-0.01em]">
            TVL
          </p>
          <p className="text-text-main text-[14px] font-semibold tracking-[-0.01em]">
            {pool.tvl}
          </p>
        </div>
        <div>
          <p className="text-text-sub text-[12px] font-medium tracking-[-0.01em]">
            Volume
          </p>
          <p className="text-text-main text-[14px] font-semibold tracking-[-0.01em]">
            {pool.volume}
          </p>
        </div>
      </div>
    </article>
  );
}

function CopyRow({
  text,
  onCopy,
}: {
  text: string;
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <div className="border-border-main/70 from-surface-overlay via-surface-overlay-subtle to-surface-overlay relative flex w-full items-center gap-2 rounded-[12px] border bg-gradient-to-r px-3 py-2.5 shadow-[inset_0px_1px_0px_rgba(255,255,255,0.06)]">
      <p className="text-text-heading flex-1 truncate font-mono text-[13px] font-medium tracking-[-0.01em]">
        {text}
      </p>
      <button
        type="button"
        aria-label="Copy text"
        className="bg-background-surface text-text-sub hover:text-primary-light flex size-8 shrink-0 items-center justify-center rounded-[8px] transition-colors"
        onClick={() => void onCopy(text)}
      >
        <Copy className="size-[19px]" strokeWidth={1.8} />
      </button>
    </div>
  );
}

function AgentStep({
  index,
  title,
  command,
  onCopy,
}: {
  index: number;
  title: string;
  command: string;
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <section className="border-border-main/60 bg-surface-overlay-subtle relative overflow-hidden rounded-[14px] border p-3.5">
      <span
        aria-hidden
        className="bg-primary-light/10 absolute -top-8 -right-8 size-20 rounded-full blur-2xl"
      />
      <div className="relative mb-2.5 flex items-start gap-2.5">
        <span className="bg-background-surface text-primary-light flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tracking-[-0.01em]">
          {index}
        </span>
        <p className="text-text-heading pt-0.5 text-[13px] font-semibold tracking-[-0.01em]">
          {title}
        </p>
      </div>
      <CopyRow text={command} onCopy={onCopy} />
    </section>
  );
}

function ComingSoonBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`border-border-main/70 bg-surface-overlay-subtle text-hint inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.08em] uppercase ${className}`}
    >
      Coming soon
    </span>
  );
}

function FeaturedCard({
  Icon,
  title,
  onClick,
  comingSoon,
}: {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
  comingSoon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-[150px] flex-1 cursor-pointer flex-col justify-between overflow-hidden rounded-[8px] border border-transparent bg-[rgba(13,30,48,0.5)] p-4 text-left"
    >
      <span className="bg-background-surface border-border-main flex size-12 items-center justify-center rounded-[10px] border">
        <Icon className="size-9" />
      </span>
      <div className="flex flex-col items-start gap-1">
        <span className="text-text-main text-[16px] font-semibold tracking-[-0.01em]">
          {title}
        </span>
        {comingSoon ? <ComingSoonBadge /> : null}
      </div>
      <ExploreFeatureOrbIcon
        aria-hidden
        className="pointer-events-none absolute top-[143px] left-[132px] size-[46px]"
      />
      <span
        aria-hidden
        className="bg-success-light/25 absolute -right-11 -bottom-11 size-28 rounded-full blur-2xl"
      />
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_-8px_-8px_24px_0px_rgba(255,255,255,0.05)]" />
    </button>
  );
}

function BrowseRow({
  Icon,
  title,
  subtitle,
  onClick,
  comingSoon,
}: {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick: () => void;
  comingSoon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border-main/60 from-surface-overlay-subtle via-background-surface/70 to-surface-overlay-subtle hover:border-border-main hover:from-surface-overlay-medium hover:to-surface-overlay-medium relative flex w-full items-start gap-3 overflow-hidden rounded-[12px] border bg-gradient-to-r px-3 py-3 text-left transition-all duration-200"
    >
      <span className="from-background-subtle to-background-surface border-border-main/70 flex size-11 shrink-0 items-center justify-center rounded-[10px] border bg-gradient-to-b">
        <Icon className="size-6" />
      </span>
      <span className="flex min-w-0 flex-col pt-0.5">
        <span className="flex items-center gap-2">
          <span className="text-text-main text-[14px] font-semibold tracking-[-0.01em]">
            {title}
          </span>
          {comingSoon ? <ComingSoonBadge /> : null}
        </span>
        <span className="text-text-sub text-[14px] font-normal tracking-[-0.01em]">
          {subtitle}
        </span>
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_rgba(255,255,255,0.06),inset_0px_-10px_26px_rgba(4,11,24,0.48)]" />
    </button>
  );
}

const Explore = () => {
  const [vaultMode, setVaultMode] = useState<"human" | "agents">("human");
  const { walletAddress, username } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeView = useMemo<ExploreView>(() => {
    const currentTab = searchParams.get(EXPLORE_TAB_QUERY_KEY);
    if (
      currentTab === "vault" ||
      currentTab === "liquidity" ||
      currentTab === "follow-trade" ||
      currentTab === "referrals" ||
      currentTab === "integrity" ||
      currentTab === "ai-agent"
    ) {
      return currentTab;
    }
    return "home";
  }, [searchParams]);

  const referralLink = useMemo(
    () => buildMiniAppReferralLink(username ?? walletAddress),
    [username, walletAddress],
  );
  const activeVaultDataset =
    vaultMode === "human" ? humanVaultDataset : agentVaultDataset;

  const handleCopyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleNavigateView = (nextView: ExploreView) => {
    if (nextView === "home") {
      router.push("/explore");
      return;
    }
    router.push(`/explore?${EXPLORE_TAB_QUERY_KEY}=${nextView}`);
  };

  return (
    <div className="bg-background-main min-h-full w-full">
      <div className="mx-auto flex w-full max-w-[393px] flex-col px-4 pt-5 pb-6 md:max-w-[1200px] md:px-6 md:pt-8 md:pb-10 lg:px-8">
        {activeView === "home" ? (
          <>
            <section className="relative -mx-4 -mt-5 overflow-hidden px-4 pt-5 md:mx-0 md:mt-0 md:px-0 md:pt-0">
              <span
                aria-hidden
                className="bg-accent-blue/15 absolute -top-28 right-[-70px] h-72 w-56 rotate-[-8deg] blur-3xl"
              />
              <span
                aria-hidden
                className="bg-success-light/10 absolute -top-20 right-10 h-64 w-32 rotate-[12deg] blur-3xl"
              />
              <h1 className="text-text-heading mb-8 text-[24px] font-semibold tracking-[-0.01em] md:mb-6 md:text-[32px]">
                Explore
              </h1>
            </section>

            <section className="md:border-border-main/70 md:bg-surface-overlay-subtle relative -mx-4 mb-7 overflow-hidden px-4 pt-4 pb-8 md:mx-0 md:rounded-[14px] md:border md:px-5 md:pt-5 md:pb-10">
              <ExploreFeatureEllipseBottomIcon
                aria-hidden
                className="pointer-events-none absolute bottom-[-52px] left-1/2 h-[100px] w-32 -translate-x-1/2"
              />
              <ExploreFeatureEllipseLeftIcon
                aria-hidden
                className="pointer-events-none absolute bottom-[238px] left-[48px] h-[148px] w-[190px]"
              />

              <p className="text-text-heading mb-4 text-[16px] font-semibold tracking-[-0.01em]">
                Featured
              </p>
              <div className="relative flex gap-2 md:gap-3">
                    <FeaturedCard
                      Icon={ExploreVaultIcon}
                      title="Vault"
                      comingSoon
                      onClick={() => handleNavigateView("vault")}
                    />
                    <FeaturedCard
                      Icon={ExploreLiquidityIcon}
                      title="Provide Liquidity"
                      comingSoon
                      onClick={() => handleNavigateView("liquidity")}
                    />
              </div>
            </section>

            <section className="mb-7">
              <p className="text-text-heading mb-4 text-[16px] font-semibold tracking-[-0.01em]">
                Browse
              </p>
              <div className="md:border-border-main/70 md:bg-surface-overlay-subtle grid gap-5 md:grid-cols-2 md:rounded-[14px] md:border md:p-5">
                    <BrowseRow
                      Icon={ExploreFollowTradingIcon}
                      title="Follow Trading"
                      subtitle="Copy top-performing strategies in real-time."
                      onClick={() => handleNavigateView("follow-trade")}
                    />
                <BrowseRow
                  Icon={ExploreReferralIcon}
                  title="Referral & Earnings"
                  subtitle="Invite friends and grow your passive income."
                      onClick={() => handleNavigateView("referrals")}
                />
                <BrowseRow
                  Icon={ExploreIntegrityIcon}
                  title="Proof of Integrity"
                  subtitle="Verify transparency and secure transaction data."
                      onClick={() => handleNavigateView("integrity")}
                />
                <BrowseRow
                  Icon={ExploreAiAgentIcon}
                  title="AI Agent Space"
                  subtitle="Deploy and manage your custom trading algorithms."
                  comingSoon
                      onClick={() => handleNavigateView("ai-agent")}
                    />
              </div>
            </section>

            <section className="md:border-border-main/70 md:bg-surface-overlay-subtle md:rounded-[14px] md:border md:p-5">
              <p className="text-text-heading mb-4 text-[16px] font-semibold tracking-[-0.01em]">
                Social
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Open World App"
                  className="flex size-10 items-center justify-center rounded-[4px]"
                >
                  <span className="flex size-6 items-center justify-center">
                    <Image
                      src="/world-app.avif"
                      alt=""
                      width={22}
                      height={22}
                      aria-hidden="true"
                      className="size-[22px] rounded-[4px] object-cover"
                    />
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Open X"
                  className="flex size-10 items-center justify-center rounded-[4px]"
                >
                  <span className="flex size-6 items-center justify-center">
                    <SocialXFigmaIcon aria-hidden className="size-[12]" />
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Open Discord"
                  className="flex size-10 items-center justify-center rounded-[4px]"
                >
                  <span className="flex size-6 items-center justify-center">
                    <SocialDiscordFigmaIcon
                      aria-hidden
                      className="size-[20px]"
                    />
                  </span>
                </button>
              </div>
            </section>
          </>
        ) : null}

        {activeView === "vault" ? (
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
            <BackButton onClick={() => handleNavigateView("home")} />

            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col items-start gap-1">
                <h1 className="text-text-heading text-[36px] font-semibold tracking-[-0.01em]">
                  Vaults
                </h1>
                <ComingSoonBadge />
              </div>
              <div className="bg-surface-overlay-subtle flex items-center gap-1 rounded-[12px] p-1">
                <button
                  type="button"
                  onClick={() => setVaultMode("human")}
                  className={`rounded-[8px] px-2 py-1.5 text-[16px] font-semibold tracking-[-0.01em] ${
                    vaultMode === "human"
                      ? "bg-background-surface text-primary-medium"
                      : "text-hint"
                  }`}
                >
                  Human
                </button>
                <button
                  type="button"
                  onClick={() => setVaultMode("agents")}
                  className={`rounded-[8px] px-2 py-1.5 text-[16px] font-semibold tracking-[-0.01em] ${
                    vaultMode === "agents"
                      ? "bg-background-surface text-primary-medium"
                      : "text-hint"
                  }`}
                >
                  AI Agents
                </button>
              </div>
            </div>

            <section className="border-border-main w-full rounded-[12px] border px-3 py-3">
              <p className="text-hint text-[12px] font-medium tracking-[-0.01em]">
                Total Value Locked
              </p>
              <p className="text-text-main text-[32px] font-semibold tracking-[-0.01em]">
                {activeVaultDataset.totalValueLocked}
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <SectionTitle>User Vaults</SectionTitle>
              <div className="grid gap-2 md:grid-cols-2">
                {activeVaultDataset.userVaults.map((rows, index) => (
                  <KVCard key={`user-${index}`} rows={rows} />
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeView === "liquidity" ? (
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
            <BackButton onClick={() => handleNavigateView("home")} />
            <div className="flex flex-col items-start gap-1">
              <h1 className="text-text-heading text-[24px] font-semibold tracking-[-0.01em]">
                Provide Liquidity
              </h1>
              <ComingSoonBadge />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {liquidityPools.map((pool) => (
                <LiquidityCard key={pool.id} pool={pool} />
              ))}
            </div>
          </div>
        ) : null}

        {activeView === "follow-trade" ? (
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
            <BackButton onClick={() => handleNavigateView("home")} />
            <FollowTradeView />
          </div>
        ) : null}

        {activeView === "referrals" ? (
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
            <BackButton onClick={() => handleNavigateView("home")} />
            <ReferralsHeader />
            <ReferAFriend referralLink={referralLink} />
            <HowItWork />
          </div>
        ) : null}

        {activeView === "integrity" ? (
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
            <BackButton onClick={() => handleNavigateView("home")} />
            <CREProofView />
          </div>
        ) : null}

        {activeView === "ai-agent" ? (
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
            <BackButton onClick={() => handleNavigateView("home")} />

            <section className="border-border-main/70 from-background-surface to-surface-card relative overflow-hidden rounded-[14px] border bg-gradient-to-br p-4">
              <span
                aria-hidden
                className="bg-primary-light/15 absolute -top-10 -right-8 size-28 rounded-full blur-3xl"
              />
              <div className="relative">
                <div className="mb-2 flex items-center gap-2">
                  <span className="bg-primary-light/15 text-primary-light flex size-7 items-center justify-center rounded-[8px]">
                    <Sparkles className="size-4" strokeWidth={1.9} />
                  </span>
                  <div className="flex items-center gap-2">
                    <h1 className="text-text-heading text-[22px] font-semibold tracking-[-0.01em]">
                      Agent Connect
                    </h1>
                    <ComingSoonBadge />
                  </div>
                </div>
                <p className="text-text-sub text-[13px] tracking-[-0.01em]">
                  Set up your AI agent in minutes and connect it to TickX MCP.
                </p>
              </div>
            </section>

            <div className="flex flex-col gap-3">
              <AgentStep
                index={1}
                title="Register your agent using Worldchain Agent Kit"
                command="npx @worldcoin/agentkit-cli register <agent-address>"
                onCopy={handleCopyText}
              />
              <AgentStep
                index={2}
                title="Teach your agent to use Worldchain AgentKit"
                command="npx skills add worldcoin/agentkit"
                onCopy={handleCopyText}
              />
              <AgentStep
                index={3}
                title="Tell your agent to add TickX mcp"
                command="https://mcp.tickx.finance"
                onCopy={handleCopyText}
              />
              <AgentStep
                index={4}
                title="Teach your agent to join & use TickX.finance"
                command="Hey bro! Read https://tickx.finance/skill.md and follow the instructions to join TickX"
                onCopy={handleCopyText}
              />
            </div>

            <section className="flex flex-col gap-3">
              <p className="text-hint text-[13px] font-semibold tracking-[-0.01em] uppercase">
                Running Agents
              </p>

              {/* Agent 1 — verified */}
              <div className="border-border-main/60 bg-background-surface flex items-center gap-3 rounded-[12px] border px-3 py-3">
                <span className="bg-surface-overlay-subtle border-border-main flex size-10 shrink-0 items-center justify-center rounded-full border">
                  <Bot
                    className="text-primary-light size-5"
                    strokeWidth={1.8}
                  />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-text-heading text-[13px] font-semibold tracking-[-0.01em]">
                    @QuantAgent.3475
                  </span>
                  <span className="text-hint font-mono text-[12px] font-medium tracking-[-0.01em]">
                    ID: 0xa3f2...7c91
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[12px] font-semibold text-emerald-400">
                  <BadgeCheck className="size-4" strokeWidth={2} />
                  Verified
                </span>
              </div>

              {/* Agent 2 — not yet verified */}
              <div className="border-border-main/60 bg-background-surface flex items-center gap-3 rounded-[12px] border px-3 py-3">
                <span className="bg-surface-overlay-subtle border-border-main flex size-10 shrink-0 items-center justify-center rounded-full border">
                  <Bot
                    className="text-primary-light size-5"
                    strokeWidth={1.8}
                  />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-text-heading text-[13px] font-semibold tracking-[-0.01em]">
                    @DeltaBot.8812
                  </span>
                  <span className="text-hint font-mono text-[12px] font-medium tracking-[-0.01em]">
                    ID: 0xb91e...4d03
                  </span>
                </div>
                <span className="text-hint flex items-center gap-1 text-[12px] font-semibold">
                  <CircleDashed className="size-4" strokeWidth={2} />
                  Pending
                </span>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Explore;
