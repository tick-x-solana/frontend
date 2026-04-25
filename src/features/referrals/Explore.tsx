"use client";

import { useMemo, useState, type ComponentType } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import type { MiniKitChatOptions } from "@worldcoin/minikit-js/commands";
import Image from "next/image";
import ExploreAiAgentIcon from "@/src/assets/icons/explore-ai-agent.svg";
import ExploreFeatureDividerIcon from "@/src/assets/icons/explore-feature-divider.svg";
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
import BrowseCopyTrade from "@/src/features/referrals/components/BrowseCopyTrade";
import CREProofView from "@/src/features/referrals/components/CREProofView";
import HowItWork from "@/src/features/referrals/components/HowItWork";
import ReferAFriend from "@/src/features/referrals/components/ReferAFriend";
import ReferralsHeader from "@/src/features/referrals/components/ReferralsHeader";
import { buildMiniAppReferralLink } from "@/src/features/referrals/constants";
import { buildWorldChatShareMessage } from "@/src/features/referrals/worldChatShare";
import { useAuth } from "@/src/components/providers/AuthProvider";
import useMiniAppUsername from "@/src/hooks/useMiniAppUsername";

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

const FOLLOW_TRADE_SHARE_WIN_RATE = "68%";
const FOLLOW_TRADE_SHARE_PNL = "+$343.5";
const FOLLOW_TRADE_SHARE_ROI = "+24.5%";

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

function FeaturedCard({
  Icon,
  title,
  onClick,
}: {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
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
      <span className="text-text-main text-[16px] font-semibold tracking-[-0.01em]">
        {title}
      </span>
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
}: {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-start gap-3 rounded-[8px] text-left"
    >
      <span className="bg-background-surface flex size-11 shrink-0 items-center justify-center rounded-[8px]">
        <Icon className="size-6" />
      </span>
      <span className="flex min-w-0 flex-col pt-0.5">
        <span className="text-text-main text-[14px] font-semibold tracking-[-0.01em]">
          {title}
        </span>
        <span className="text-text-sub text-[14px] font-normal tracking-[-0.01em]">
          {subtitle}
        </span>
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_-4px_16px_0px_rgba(255,255,255,0.05)]" />
    </button>
  );
}

const Explore = () => {
  const [activeView, setActiveView] = useState<ExploreView>("home");
  const [vaultMode, setVaultMode] = useState<"human" | "agents">("human");
  const { walletAddress, username } = useAuth();
  const { miniAppUsername, refreshMiniAppUsername } = useMiniAppUsername({
    username,
    walletAddress,
    logPrefix: "[Explore]",
  });

  const referralLink = useMemo(
    () => buildMiniAppReferralLink(miniAppUsername ?? username),
    [miniAppUsername, username],
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

  const shareToChat = async () => {
    try {
      if (!MiniKit.isInWorldApp()) {
        toast.error("WorldChat is only available in World App");
        return;
      }

      const resolvedMiniAppUsername = await refreshMiniAppUsername();
      if (!resolvedMiniAppUsername) {
        toast.error("Missing World username. Please set your username first.");
        return;
      }

      const miniAppReferralLink = buildMiniAppReferralLink(
        resolvedMiniAppUsername,
      );
      const message = buildWorldChatShareMessage({
        referralLink: miniAppReferralLink,
        metrics: {
          winRate: FOLLOW_TRADE_SHARE_WIN_RATE,
          pnl: FOLLOW_TRADE_SHARE_PNL,
          roi: FOLLOW_TRADE_SHARE_ROI,
        },
      });

      const input = {
        message,
        to: ["andy"],
      } satisfies MiniKitChatOptions;

      await MiniKit.chat(input);
    } catch {
      toast.error("Failed to share to WorldChat");
    }
  };

  return (
    <div className="bg-background-main min-h-full w-full">
      <div className="mx-auto flex w-full max-w-[393px] flex-col px-4 pt-5 pb-6">
        {activeView === "home" ? (
          <>
            <section className="relative -mx-4 -mt-5 overflow-hidden px-4 pt-5">
              <span
                aria-hidden
                className="bg-accent-blue/15 absolute -top-28 right-[-70px] h-72 w-56 rotate-[-8deg] blur-3xl"
              />
              <span
                aria-hidden
                className="bg-success-light/10 absolute -top-20 right-10 h-64 w-32 rotate-[12deg] blur-3xl"
              />
              <h1 className="text-text-heading mb-8 text-[24px] font-semibold tracking-[-0.01em]">
                Explore
              </h1>
            </section>

            <section className="relative -mx-4 mb-7 overflow-hidden px-4 pt-4 pb-8">
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
              <div className="relative flex gap-2">
                <FeaturedCard
                  Icon={ExploreVaultIcon}
                  title="Vault"
                  onClick={() => setActiveView("vault")}
                />
                <FeaturedCard
                  Icon={ExploreLiquidityIcon}
                  title="Provide Liquidity"
                  onClick={() => setActiveView("liquidity")}
                />
              </div>

              <ExploreFeatureDividerIcon
                aria-hidden
                className="pointer-events-none absolute bottom-[-21px] left-[-16px] h-[42px] w-[393px]"
              />
            </section>

            <section className="mb-7">
              <p className="text-text-heading mb-4 text-[16px] font-semibold tracking-[-0.01em]">
                Browse
              </p>
              <div className="flex flex-col gap-5">
                <BrowseRow
                  Icon={ExploreFollowTradingIcon}
                  title="Follow Trading"
                  subtitle="Copy top-performing strategies in real-time."
                  onClick={() => setActiveView("follow-trade")}
                />
                <BrowseRow
                  Icon={ExploreReferralIcon}
                  title="Referral & Earnings"
                  subtitle="Invite friends and grow your passive income."
                  onClick={() => setActiveView("referrals")}
                />
                <BrowseRow
                  Icon={ExploreIntegrityIcon}
                  title="Proof of Integrity"
                  subtitle="Verify transparency and secure transaction data."
                  onClick={() => setActiveView("integrity")}
                />
                <BrowseRow
                  Icon={ExploreAiAgentIcon}
                  title="AI Agent Space"
                  subtitle="Deploy and manage your custom trading algorithms."
                  onClick={() => setActiveView("ai-agent")}
                />
              </div>
            </section>

            <section>
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
          <div className="flex flex-col gap-4">
            <BackButton onClick={() => setActiveView("home")} />

            <div className="flex items-center justify-between gap-3">
              <h1 className="text-text-heading text-[36px] font-semibold tracking-[-0.01em]">
                Vaults
              </h1>
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
              {activeVaultDataset.userVaults.map((rows, index) => (
                <KVCard key={`user-${index}`} rows={rows} />
              ))}
            </section>
          </div>
        ) : null}

        {activeView === "liquidity" ? (
          <div className="flex flex-col gap-4">
            <BackButton onClick={() => setActiveView("home")} />
            <h1 className="text-text-heading text-[24px] font-semibold tracking-[-0.01em]">
              Provide Liquidity
            </h1>

            {liquidityPools.map((pool) => (
              <LiquidityCard key={pool.id} pool={pool} />
            ))}
          </div>
        ) : null}

        {activeView === "follow-trade" ? (
          <div className="flex flex-col gap-4">
            <BackButton onClick={() => setActiveView("home")} />
            <BrowseCopyTrade />
          </div>
        ) : null}

        {activeView === "referrals" ? (
          <div className="flex flex-col gap-4">
            <BackButton onClick={() => setActiveView("home")} />
            <ReferralsHeader
              onShareToChat={() => void shareToChat()}
              worldId={miniAppUsername}
            />
            <ReferAFriend referralLink={referralLink} />
            <HowItWork />
          </div>
        ) : null}

        {activeView === "integrity" ? (
          <div className="flex flex-col gap-4">
            <BackButton onClick={() => setActiveView("home")} />
            <CREProofView />
          </div>
        ) : null}

        {activeView === "ai-agent" ? (
          <div className="flex flex-col gap-4">
            <BackButton onClick={() => setActiveView("home")} />

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
                  <h1 className="text-text-heading text-[22px] font-semibold tracking-[-0.01em]">
                    Agent Connect
                  </h1>
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
