"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

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

  const isActivePath = (href: string) => {
    if (href === "#") return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="border-b border-[#16305a] bg-[#040b18] px-4 py-3">
      <div className="mx-auto flex w-full items-center gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-[10.324px]"
          aria-label="TickX home"
        >
          <span className="flex h-8 w-[33.085px] items-center justify-center rounded-[2.893px] bg-[#d0f7dc]">
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
                      ? "bg-[rgba(208,247,220,0.12)] font-semibold text-[#d0f7dc]"
                      : "font-semibold text-[rgba(255,255,255,0.6)] hover:text-[rgba(255,255,255,0.85)]",
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
          <span className="h-8 w-px shrink-0 bg-[#16305a]" aria-hidden />
        </nav>

        <button
          type="button"
          className="ml-auto inline-flex h-10 items-center justify-center rounded-[8px] bg-[#d0f7dc] px-3 py-1.5 text-sm leading-5 font-medium tracking-[-0.01em] text-[#040b18] transition-colors hover:bg-[#bdecc9]"
        >
          Connect Wallet
        </button>
      </div>
    </header>
  );
};

export default Header;
