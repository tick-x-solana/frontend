"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, Share2, Trophy, Wallet } from "lucide-react";

type MobileNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: MobileNavItem[] = [
  { href: "/", label: "Trade", icon: LineChart },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "#", label: "Share", icon: Share2 },
];

const MobileBottomNav = () => {
  const pathname = usePathname();

  const isActivePath = (href: string) => {
    if (href === "#") return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed right-0 bottom-0 left-0 z-40 border-t border-[#0f2742] bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.04)_100%),linear-gradient(90deg,#041026_0%,#041026_100%)] px-0.5 py-0.5 md:hidden"
    >
      <ul className="grid grid-cols-4 items-center">
        {navItems.map((item) => {
          const isActive = isActivePath(item.href);
          const Icon = item.icon;

          return (
            <li key={item.label} className="relative flex justify-center p-1">
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-[-2px] h-0.5 w-[34%] rounded-full bg-[#a8e8bb]"
                />
              )}

              <Link
                href={item.href}
                aria-label={item.label}
                className={[
                  "flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
                  isActive ? "bg-white/8" : "bg-transparent",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "h-6 w-6 stroke-[1.75]",
                    isActive ? "text-[#d0f7dc]" : "text-[#7997b1]",
                  ].join(" ")}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
