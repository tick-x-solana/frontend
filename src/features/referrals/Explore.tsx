"use client";

import { useMemo, useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import type { MiniKitChatOptions } from "@worldcoin/minikit-js/commands";
import Image from "next/image";
import TetherIcon from "@/src/assets/icons/tether.svg";
import WldMarketIcon from "@/src/assets/icons/wld-market.svg";
import {
  ArrowLeft,
  BatteryFull,
  Bot,
  CandlestickChart,
  Coins,
  Copy,
  Gift,
  ShieldCheck,
  Star,
  Vault,
  Wifi,
  type LucideIcon,
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

type ExploreFeature = {
  id: string;
  title: string;
  Icon: LucideIcon;
};

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

const exploreFeatures: ExploreFeature[] = [
  { id: "vault", title: "Vault", Icon: Vault },
  { id: "liquidity", title: "Provide Liquidity", Icon: Coins },
  { id: "follow-trade", title: "Follow Trading", Icon: CandlestickChart },
  { id: "referrals", title: "Referral & Earnings", Icon: Gift },
  { id: "integrity", title: "Proof of Integrity", Icon: ShieldCheck },
  { id: "ai-agent", title: "AI Agent Space", Icon: Bot },
];

const socialButtons = [
  {
    id: "x",
    label: "Open X",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="size-5">
        <path
          d="M5 4.5h3.1l3.8 5 4.3-5H19l-5.8 6.7L19.5 19h-3.1l-4.3-5.6-4.8 5.6H4.5l6.3-7.3L5 4.5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },

  {
    id: "world-app",
    label: "Open World App",
    icon: (
      <Image
        src="/world-app.avif"
        alt=""
        width={20}
        height={20}
        aria-hidden="true"
        className="size-5 rounded-[4px] object-cover"
      />
    ),
  },
];

const humanVaultDataset: VaultDataset = {
  totalValueLocked: "$3,645,650",
  protocolVaults: [
    [
      { label: "Vault", value: "Morpho USDC Prime (World Chain)" },
      { label: "Leader", value: "0x9ac4...29bf" },
      { label: "APR", value: "6.42%" },
      { label: "TVL", value: "$2,184,300" },
      { label: "Your Deposit", value: "$420.00" },
      { label: "Age (days)", value: "91" },
      { label: "Snapshot", value: "2026-04-24" },
    ],
    [
      { label: "Vault", value: "Uniswap v3 WLD/USDC LP" },
      { label: "Leader", value: "0x4e7f...62d1" },
      { label: "APR", value: "4.88%" },
      { label: "TVL", value: "$1,362,900" },
      { label: "Your Deposit", value: "$0.00" },
      { label: "Age (days)", value: "74" },
      { label: "Snapshot", value: "2026-04-24" },
    ],
  ],
  userVaults: [
    [
      { label: "Vault", value: "BTC Long Momentum" },
      { label: "Leader", value: "0x88d1...4f0e" },
      { label: "APR", value: "5.17%" },
      { label: "TVL", value: "$98,450" },
      { label: "Your Deposit", value: "$125.00" },
      { label: "Age (days)", value: "33" },
      { label: "Snapshot", value: "2026-04-24" },
    ],
  ],
};

const agentVaultDataset: VaultDataset = {
  totalValueLocked: "$3,258,700",
  protocolVaults: [
    [
      { label: "Vault", value: "Agent Morpho Delta Neutral" },
      { label: "Leader", value: "agent-morpho-01" },
      { label: "APR", value: "7.03%" },
      { label: "TVL", value: "$1,975,600" },
      { label: "Your Deposit", value: "$0.00" },
      { label: "Age (days)", value: "58" },
      { label: "Snapshot", value: "2026-04-24" },
    ],
    [
      { label: "Vault", value: "Agent Uni v3 Rebalancer WLD/USDC" },
      { label: "Leader", value: "agent-univ3-07" },
      { label: "APR", value: "5.64%" },
      { label: "TVL", value: "$1,244,200" },
      { label: "Your Deposit", value: "$0.00" },
      { label: "Age (days)", value: "46" },
      { label: "Snapshot", value: "2026-04-24" },
    ],
  ],
  userVaults: [
    [
      { label: "Vault", value: "Agent Aave Auto-Rollover" },
      { label: "Leader", value: "agent-aave-03" },
      { label: "APR", value: "4.95%" },
      { label: "TVL", value: "$38,900" },
      { label: "Your Deposit", value: "$0.00" },
      { label: "Age (days)", value: "29" },
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

const jumpToViewMap: Record<string, ExploreView> = {
  vault: "vault",
  liquidity: "liquidity",
  "follow-trade": "follow-trade",
  referrals: "referrals",
  integrity: "integrity",
  "ai-agent": "ai-agent",
};
const FOLLOW_TRADE_SHARE_WIN_RATE = "68%";
const FOLLOW_TRADE_SHARE_ROI = "+24.5%";

function StatusBar() {
  return (
    <header className="text-text-heading mb-4 flex items-center justify-between">
      <p className="text-[15px] font-semibold tracking-[-0.01em]">09:41</p>
      <div className="flex items-center gap-1">
        <Wifi className="size-[14px]" strokeWidth={2.1} />
        <BatteryFull className="size-[16px]" strokeWidth={1.9} />
      </div>
    </header>
  );
}

function FeatureIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="bg-surface-overlay-subtle border-border-main flex size-12 items-center justify-center rounded-[12px] border">
      <Icon className="text-primary-light size-6" strokeWidth={1.9} />
    </span>
  );
}

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
    <div className="bg-surface-overlay flex w-full items-center gap-1.5 rounded-[8px] px-3 py-2">
      <p className="text-text-heading flex-1 truncate font-mono text-[14px] font-medium tracking-[-0.01em]">
        {text}
      </p>
      <button
        type="button"
        aria-label="Copy text"
        className="text-text-sub"
        onClick={() => void onCopy(text)}
      >
        <Copy className="size-[18px]" strokeWidth={1.8} />
      </button>
    </div>
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
        referralCode: resolvedMiniAppUsername,
        referralLink: miniAppReferralLink,
        metrics: {
          winRate: FOLLOW_TRADE_SHARE_WIN_RATE,
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
            <h1 className="text-text-heading mb-4 text-[24px] font-semibold tracking-[-0.01em]">
              Explore
            </h1>

            <section className="grid grid-cols-2 gap-4">
              {exploreFeatures.map((feature) => (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => setActiveView(jumpToViewMap[feature.id])}
                  className="bg-background-surface active:bg-background-subtle flex h-[180px] cursor-pointer flex-col items-center justify-center gap-[10px] px-6 py-8 text-center transition-colors"
                >
                  <FeatureIcon Icon={feature.Icon} />
                  <span className="text-text-heading text-[16px] font-semibold tracking-[-0.01em]">
                    {feature.title}
                  </span>
                </button>
              ))}
            </section>

            <section className="mt-6 flex items-center justify-center gap-3">
              {socialButtons.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  className="border-border-main text-primary-light flex size-10 items-center justify-center rounded-[4px] border bg-transparent"
                >
                  {item.icon}
                </button>
              ))}
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
              <p className="text-text-main text-[44px] font-semibold tracking-[-0.01em]">
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

            <h1 className="text-text-heading text-[24px] font-semibold tracking-[-0.01em]">
              AI Agent Space
            </h1>

            <section className="border-border-main w-full rounded-[12px] border px-3 py-3">
              <p className="text-hint text-[12px] font-medium tracking-[-0.01em]">
                AI API docs:
              </p>
              <a
                href="http://tickx.finance/api"
                target="_blank"
                rel="noreferrer"
                className="text-text-main mt-1 block truncate text-[16px] font-medium tracking-[-0.01em] underline"
              >
                http://tickx.finance/api
              </a>
            </section>

            <section className="flex flex-col gap-1">
              <p className="text-hint text-[14px] font-medium tracking-[-0.01em]">
                Connect your MCP at:
              </p>
              <CopyRow
                text="http://tickx.finance/mcp"
                onCopy={handleCopyText}
              />
            </section>

            <section className="flex flex-col gap-1">
              <p className="text-hint text-[14px] font-medium tracking-[-0.01em]">
                Sample Agent skills
              </p>
              <CopyRow
                text="npm install tickx-skills"
                onCopy={handleCopyText}
              />
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Explore;
