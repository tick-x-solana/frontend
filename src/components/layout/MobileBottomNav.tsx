"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LineChart, Trophy, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type MobileNavItem = {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: MobileNavItem[] = [
  { href: "/", label: "Trade", icon: LineChart },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/explore", label: "Explore", icon: Compass },
];

const MobileBottomNav = () => {
  const pathname = usePathname();

  const isActivePath = (href?: string) => {
    if (!href) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label="Bottom navigation"
      className="border-stroke-main fixed right-0 bottom-0 left-0 z-40 border-t bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.04)_100%),linear-gradient(90deg,var(--background-main)_0%,var(--background-main)_100%)] px-0.5 pt-0.5 pb-[calc(env(safe-area-inset-bottom)+20px)] md:hidden"
    >
      <ul className="grid grid-cols-4 items-center">
        {navItems.map((item) => {
          const isActive = isActivePath(item.href);
          const Icon = item.icon;
          const content = (
            <span
              aria-current={isActive ? "page" : undefined}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 p-1"
            >
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-[8px] transition-colors",
                  isActive ? "bg-surface-overlay-medium" : "bg-transparent",
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 shrink-0 stroke-[1.8]",
                    isActive ? "text-primary-light" : "text-text-sub",
                  )}
                />
              </span>
              <span
                className={cn(
                  "text-center text-[12px] font-semibold tracking-[-0.01em]",
                  isActive ? "text-primary-light" : "text-text-sub",
                )}
              >
                {item.label}
              </span>
            </span>
          );

          return (
            <li
              key={item.label}
              className="relative flex min-w-0 flex-1 justify-center"
            >
              {isActive && (
                <span
                  aria-hidden
                  className="bg-primary-light absolute top-[-2px] h-0.5 w-[34%] rounded-full"
                />
              )}

              {item.href ? (
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className="flex flex-1 justify-center"
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  aria-label={item.label}
                  className="flex flex-1 cursor-default justify-center"
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
