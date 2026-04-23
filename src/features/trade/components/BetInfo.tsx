"use client";

import WldMarketIcon from "@/src/assets/icons/wld-market.svg";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Button } from "@/src/components/shadcn/button";
import { useGameStore } from "@/src/features/trade/store";
import { cn } from "@/lib/utils";

const USD_PER_WLD = 0.26;
const BID_OPTIONS = [0.26, 0.52, 0.78, 1.04];

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatWalletAddress = (address: string | null) => {
  if (!address) return "Not connected";
  if (!address.startsWith("0x") || address.length < 14) return address;
  return `${address.slice(0, 7)}...${address.slice(-7)}`;
};

export default function BetInfo() {
  const { walletAddress: rawAddress } = useAuth();
  const balance = useGameStore((s) => s.balance);
  const betAmount = useGameStore((s) => s.betAmount);
  const setBetAmount = useGameStore((s) => s.setBetAmount);

  const selectedBid = BID_OPTIONS.includes(betAmount) ? betAmount : BID_OPTIONS[0];
  const walletAddress = formatWalletAddress(rawAddress);
  const balanceInWld = balance / USD_PER_WLD;
  const bidSizeInWld = selectedBid / USD_PER_WLD;

  return (
    <aside className="border-border-main bg-background-main flex w-[300px] shrink-0 flex-col gap-6 border-r px-5 py-5">
      <section className="flex flex-col gap-0.5">
        <p className="text-hint text-[12px] font-semibold tracking-[-0.01em]">
          WALLET
        </p>
        <p className="text-text-main text-[14px] font-medium tracking-[-0.01em]">
          {walletAddress}
        </p>
      </section>

      <section className="flex flex-col gap-0.5">
        <p className="text-hint text-[12px] font-semibold tracking-[-0.01em]">
          BALANCE
        </p>
        <p className="text-text-main text-[24px] font-semibold tracking-[-0.01em]">
          {formatMoney(balance)}
        </p>
        <p className="text-hint text-[12px] font-medium tracking-[-0.01em]">
          {new Intl.NumberFormat("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(balanceInWld)}{" "}
          WLD
        </p>
      </section>

      <section className="flex items-center justify-between">
        <p className="text-hint text-[12px] font-semibold tracking-[-0.01em]">
          BID SIZE
        </p>
        <div className="flex items-center gap-2">
          <WldMarketIcon aria-hidden className="size-4" />
          <p className="text-text-main text-[14px] font-medium tracking-[-0.01em]">
            {bidSizeInWld.toFixed(0)} WLD ~ {formatMoney(selectedBid)}
          </p>
        </div>
      </section>

      <section className="flex items-center gap-2">
        {BID_OPTIONS.map((amount) => {
          const isSelected = selectedBid === amount;
          return (
            <Button
              key={amount}
              type="button"
              variant="outline"
              className={cn(
                "h-9 flex-1 rounded-lg border px-0 text-[14px] font-medium tracking-[-0.01em] shadow-none",
                "hover:bg-surface-overlay-subtle",
                isSelected
                  ? "border-border-primary bg-surface-selected text-text-link-main hover:bg-surface-selected"
                  : "border-border-main bg-background-main text-text-main",
              )}
              onClick={() => setBetAmount(amount)}
            >
              {formatMoney(amount)}
            </Button>
          );
        })}
      </section>

      <section>
        <Button
          type="button"
          className="bg-primary-light text-text-inverse hover:bg-primary-medium h-11 w-full rounded-lg px-4 text-[14px] font-medium tracking-[-0.01em] shadow-none"
        >
          Add Funds
        </Button>
      </section>
    </aside>
  );
}
