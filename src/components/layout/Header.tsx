"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Button } from "@/src/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/shadcn/dialog";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { paymentControllerDebugDeposit } from "@/src/services/queries";
import {
  FAUCET_COOLDOWN_MS,
  FAUCET_DEPOSIT_AMOUNT_SOL,
  FAUCET_LAST_REQUEST_AT_STORAGE_KEY,
} from "@/src/constants";

type NavItem = {
  label: string;
  href: string;
  hasDropdown?: boolean;
};

const navItems: NavItem[] = [
  { label: "Trade", href: "/" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Explore", href: "/explore" },
];

const formatRemainingCooldown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const getFaucetCooldownRemainingMs = () => {
  if (typeof window === "undefined") return 0;
  const rawLastFaucetAt = window.localStorage.getItem(
    FAUCET_LAST_REQUEST_AT_STORAGE_KEY,
  );
  if (!rawLastFaucetAt) return 0;
  const lastFaucetAt = Number(rawLastFaucetAt);
  if (!Number.isFinite(lastFaucetAt)) return 0;
  const elapsedMs = Date.now() - lastFaucetAt;
  return Math.max(0, FAUCET_COOLDOWN_MS - elapsedMs);
};

const Header = () => {
  const pathname = usePathname();
  const { connected } = useWallet();
  const { isAuthenticated } = useAuth();
  const [isFauceting, setIsFauceting] = useState(false);
  const [isFaucetGuideOpen, setIsFaucetGuideOpen] = useState(false);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(
    getFaucetCooldownRemainingMs,
  );

  const updateCooldown = useCallback(() => {
    setCooldownRemainingMs(getFaucetCooldownRemainingMs());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(updateCooldown, 1000);
    return () => window.clearInterval(timer);
  }, [updateCooldown]);

  const handleFaucet = useCallback(() => {
    if (!connected) return;
    setIsFaucetGuideOpen(true);
  }, [connected]);

  const handleConfirmFaucet = useCallback(async () => {
    if (!connected) return;
    if (!isAuthenticated) {
      toast.info("Please wait for wallet sign-in before using faucet.");
      return;
    }
    if (cooldownRemainingMs > 0) {
      toast.warning(
        `Faucet cooldown: ${formatRemainingCooldown(cooldownRemainingMs)} remaining.`,
      );
      return;
    }

    setIsFauceting(true);
    try {
      await paymentControllerDebugDeposit({
        amount: String(FAUCET_DEPOSIT_AMOUNT_SOL),
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          FAUCET_LAST_REQUEST_AT_STORAGE_KEY,
          String(Date.now()),
        );
      }
      updateCooldown();
      setIsFaucetGuideOpen(false);
      toast.success(`Faucet success: +${FAUCET_DEPOSIT_AMOUNT_SOL} SOL.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Faucet request failed";
      toast.error(message);
    } finally {
      setIsFauceting(false);
    }
  }, [connected, cooldownRemainingMs, isAuthenticated, updateCooldown]);

  const isActivePath = (href: string) => {
    if (href === "#") return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const hideOnExploreMobile =
    pathname === "/explore" || pathname.startsWith("/explore/");

  const faucetLabel = useMemo(() => {
    if (isFauceting) return "Fauceting...";
    if (cooldownRemainingMs > 0) {
      return `Faucet (${formatRemainingCooldown(cooldownRemainingMs)})`;
    }
    return "Faucet";
  }, [cooldownRemainingMs, isFauceting]);

  return (
    <header
      className={[
        "border-border-main bg-background-main px-4 py-3 max-md:hidden!",
        hideOnExploreMobile ? "hidden md:block" : "",
      ].join(" ")}
    >
      <div className="mx-auto flex w-full items-center gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-[10.324px]"
          aria-label="TickX home"
        >
          <span className="bg-primary-light flex h-8 w-[33.085px] items-center justify-center rounded-[2.893px]">
            <Image
              src="/branding/tickx-mark.svg"
              alt=""
              width={23}
              height={23}
              className="h-[22.599px] w-[23.326px]"
            />
          </span>
          <Image
            src="/branding/tickx-wordmark.svg"
            alt="TickX"
            width={82}
            height={19}
            className="h-[19.147px] w-[82.489px]"
          />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-6 md:flex">
          <ul className="flex items-center gap-2">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={[
                    "flex items-center justify-center gap-2 rounded-[8px] px-[10px] py-2 text-center text-sm leading-5 tracking-[-0.01em] transition-colors",
                    isActivePath(item.href)
                      ? "bg-primary-light/12 text-primary-light font-semibold"
                      : "font-semibold text-white/60 hover:text-white/85",
                  ].join(" ")}
                >
                  <span>{item.label}</span>
                  {item.hasDropdown && (
                    <ChevronDown size={16} strokeWidth={1.8} />
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <span className="bg-border-main h-8 w-px shrink-0" aria-hidden />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {connected ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-[8px] px-3"
              disabled={isFauceting}
              onClick={() => void handleFaucet()}
            >
              {faucetLabel}
            </Button>
          ) : null}
          <WalletMultiButton
            style={{
              height: "40px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              padding: "0 12px",
            }}
          />
        </div>
      </div>

      <Dialog open={isFaucetGuideOpen} onOpenChange={setIsFaucetGuideOpen}>
        <DialogContent className="pointer-events-none">
          <div className="border-border-main bg-surface-card pointer-events-auto w-full max-w-[460px] rounded-[14px] border p-5 shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
            <DialogTitle className="text-text-heading text-[22px] font-semibold tracking-[-0.01em]">
              Faucet guide
            </DialogTitle>
            <DialogDescription className="text-text-main mt-2 text-[17px] font-medium tracking-[-0.01em]">
              Get{" "}
              <span className="text-primary-light font-semibold">3 SOL</span>{" "}
              test balance.
            </DialogDescription>

            <div className="border-border-main bg-surface-field mt-4 space-y-2 rounded-[10px] border p-3">
              <p className="text-text-heading text-sm font-semibold tracking-[-0.01em]">
                Notes
              </p>
              <ul className="text-text-main list-disc space-y-1 pl-5 text-sm tracking-[-0.01em]">
                <li>Testing only</li>
                <li>Cooldown: 30 min</li>
              </ul>
            </div>

            {cooldownRemainingMs > 0 && (
              <div className="border-border-main bg-surface-field-strong mt-4 rounded-[10px] border p-3">
                <p className="text-text-main text-sm tracking-[-0.01em]">
                  Next claim in{" "}
                  <span className="text-primary-light font-semibold">
                    {formatRemainingCooldown(cooldownRemainingMs)}
                  </span>
                  .
                </p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-border-main bg-surface-overlay text-text-main hover:bg-surface-overlay-medium h-9 rounded-[8px] px-3 shadow-none"
                onClick={() => setIsFaucetGuideOpen(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                className="bg-primary-light text-background-main hover:bg-primary-medium h-9 rounded-[8px] px-3 font-semibold"
                disabled={isFauceting || cooldownRemainingMs > 0}
                onClick={() => void handleConfirmFaucet()}
              >
                {isFauceting
                  ? "Processing..."
                  : `Faucet ${FAUCET_DEPOSIT_AMOUNT_SOL} SOL`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Header;
