"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/src/components/shadcn/button";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { sepolia } from "wagmi/chains";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

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

const formatWalletAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

const Header = () => {
  const pathname = usePathname();
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();
  const {
    isAuthenticated,
    isLoggingIn,
    isMiniApp,
    login,
    logout,
    walletAddress,
  } = useAuth();

  const isActivePath = (href: string) => {
    if (href === "#") return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const hideOnExploreMobile =
    pathname === "/explore" || pathname.startsWith("/explore/");

  const isWrongNetwork = isConnected && chainId !== sepolia.id;
  const primaryConnector = connectors[0];

  const handleWalletAction = () => {
    if (isMiniApp) {
      if (isAuthenticated) {
        logout();
        return;
      }

      void login();
      return;
    }

    if (isWrongNetwork) {
      switchChain({ chainId: sepolia.id });
      return;
    }

    if (isConnected) {
      disconnect();
      return;
    }

    if (!primaryConnector) return;

    connect({
      connector: primaryConnector,
      chainId: sepolia.id,
    });
  };

  const walletButtonLabel = (() => {
    if (isLoggingIn) return "Signing in...";
    if (isMiniApp) {
      if (isAuthenticated && walletAddress) {
        return formatWalletAddress(walletAddress);
      }

      return "Sign in";
    }
    if (isSwitchPending) return "Switching...";
    if (isConnectPending) return "Connecting...";
    if (isWrongNetwork) return "Switch to Sepolia";
    if (isConnected && address) return formatWalletAddress(address);
    return "Connect Wallet";
  })();

  return (
    <header
      className={[
        "border-border-main bg-background-main px-4 py-3",
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

        <Button
          type="button"
          size="lg"
          onClick={handleWalletAction}
          disabled={
            isMiniApp
              ? isLoggingIn
              : !primaryConnector ||
                isConnectPending ||
                isSwitchPending ||
                isLoggingIn
          }
          className="bg-primary-light text-text-inverse hover:bg-primary-medium ml-auto h-10 rounded-[8px] px-3 py-1.5 text-sm font-medium tracking-[-0.01em] shadow-none disabled:opacity-60"
        >
          {walletButtonLabel}
        </Button>
      </div>
    </header>
  );
};

export default Header;
