"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { formatWalletAddress } from "@/src/utils/formatters";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

type NavItem = {
  label: string;
  href: string;
  hasDropdown?: boolean;
};

const navItems: NavItem[] = [
  { label: "Trade", href: "/" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "More", href: "#", hasDropdown: true },
];

const Header = () => {
  const pathname = usePathname();
  const { connected, publicKey } = useWallet();
  const { isAuthenticated, isLoggingIn, walletAddress } = useAuth();

  const isActivePath = (href: string) => {
    if (href === "#") return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const hideOnExploreMobile =
    pathname === "/explore" || pathname.startsWith("/explore/");

  const displayAddress = walletAddress ?? publicKey?.toBase58() ?? null;
  const walletLabel = isLoggingIn
    ? "Signing in..."
    : isAuthenticated && displayAddress
      ? formatWalletAddress(displayAddress, { start: 4, end: 4 })
      : null;

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
    </header>
  );
};

export default Header;
