"use client";

import { Button } from "@/src/components/shadcn/button";
import { getUserInitials } from "@/src/features/trade/orderFollow";
import { cn } from "@/lib/utils";

interface CopyTradeCardProps {
  targetUserId: string;
  multiplier?: number | null;
  isLive?: boolean;
  onClick?: () => void;
}

function formatMultiplier(multiplier?: number | null): string {
  if (typeof multiplier !== "number" || !Number.isFinite(multiplier)) {
    return "--";
  }

  const rounded =
    multiplier >= 10 ? multiplier.toFixed(1) : multiplier.toFixed(1);
  return `${rounded}x`;
}

export default function CopyTradeCard({
  targetUserId,
  multiplier,
  isLive = false,
  onClick,
}: CopyTradeCardProps) {
  const initials = getUserInitials(targetUserId);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        "bg-warning-surface border-border-subtle relative h-[74px] w-full min-w-0 rounded-none border px-2 py-2 shadow-none",
        "hover:border-warning-medium hover:bg-warning-surface",
        isLive && "border-warning-medium",
      )}
    >
      <div className="flex w-full flex-col items-center justify-center gap-1">
        <div className="bg-warning-medium flex size-4 items-center justify-center rounded-full">
          <span className="text-text-inverse text-[7px] font-medium tracking-[-0.01em]">
            {initials}
          </span>
        </div>
        <span className="text-warning-medium text-center text-[12px] font-bold tracking-[-0.01em]">
          {formatMultiplier(multiplier)}
        </span>
      </div>
    </Button>
  );
}
