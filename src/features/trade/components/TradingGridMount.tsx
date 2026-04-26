"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TradingGrid } from "@/src/features/trade/components/TradingGrid";

type TradingGridMountProps = {
  initialFollowRefCode?: string | null;
};

export default function TradingGridMount({
  initialFollowRefCode = null,
}: TradingGridMountProps) {
  const pathname = usePathname();
  const [mountCount, setMountCount] = useState(0);
  const prevPathnameRef = useRef(pathname);

  // Remount only when navigating back to trade tab from another route.
  // Visibility changes (switching apps, locking screen) do NOT remount —
  // TradingGrid handles resume in-place via visibilitychange.
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    const wasAway = prevPathnameRef.current !== "/";
    prevPathnameRef.current = pathname;
    if (pathname === "/" && wasAway) {
      setMountCount((c) => c + 1);
    }
  }, [pathname]);

  return (
    <TradingGrid
      key={mountCount}
      initialFollowRefCode={initialFollowRefCode}
    />
  );
}
