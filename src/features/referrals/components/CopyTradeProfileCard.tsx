"use client";

import Image from "next/image";
import { Star, UsersRound } from "lucide-react";
import { Button } from "@/src/components/shadcn/button";
import { cn } from "@/lib/utils";

export type CopyTradeProfile = {
  targetUserId?: string;
  initials: string;
  username: string;
  slots: string;
  winRate: string;
  roi: string;
  pnl7d: string;
};

type CopyTradeProfileCardProps = {
  profile: CopyTradeProfile;
  isFavorite?: boolean;
  isFollowing?: boolean;
  isSubmitting?: boolean;
  onCopyTrade?: (profile: CopyTradeProfile) => void;
};

const CopyTradeProfileCard = ({
  profile,
  isFavorite = false,
  isFollowing = false,
  isSubmitting = false,
  onCopyTrade,
}: CopyTradeProfileCardProps) => {
  const displayUsername = profile.username.startsWith("@")
    ? profile.username
    : `@${profile.username}`;

  return (
    <article className="border-border-main bg-background-main flex flex-col gap-3 rounded-[8px] border p-4">
      <div className="flex items-start gap-3">
        <div className="relative">
          <div className="bg-primary-light text-text-inverse flex size-8 items-center justify-center rounded-full text-sm font-medium tracking-[-0.01em]">
            {profile.initials}
          </div>
          <Image
            src="/onboarding/verified-badge.svg"
            alt="Verified badge"
            width={16}
            height={16}
            className="absolute -right-1 -bottom-1 size-4"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-text-heading truncate text-base font-semibold tracking-[-0.01em]">
            {displayUsername}
          </p>
          <div className="bg-surface-overlay-subtle mt-1 flex w-max items-center gap-1 rounded-[4px] px-1 py-0.5">
            <UsersRound className="text-hint size-3.5" aria-hidden="true" />
            <span className="text-text-sub text-sm font-medium tracking-[-0.01em]">
              {profile.slots}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={cn(
            "size-6 rounded-[5px] p-0",
            isFavorite
              ? "text-reward-gold hover:bg-surface-overlay-subtle hover:text-reward-gold"
              : "text-hint hover:bg-surface-overlay-subtle hover:text-primary-light",
          )}
          aria-label={`Favorite ${displayUsername}`}
        >
          <Star
            className="size-4"
            aria-hidden="true"
            fill={isFavorite ? "currentColor" : "none"}
          />
        </Button>
      </div>

      <div className="bg-border-main h-px w-full" />

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-text-sub text-sm font-medium tracking-[-0.01em]">
            Win rate
          </p>
          <p className="text-success-medium text-sm font-semibold tracking-[-0.01em]">
            {profile.winRate}
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-text-sub text-sm font-medium tracking-[-0.01em]">
            ROI
          </p>
          <p className="text-text-heading text-sm font-semibold tracking-[-0.01em]">
            {profile.roi}
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-text-sub text-sm font-medium tracking-[-0.01em]">
            7D PnL
          </p>
          <p className="text-text-heading text-sm font-semibold tracking-[-0.01em]">
            {profile.pnl7d}
          </p>
        </div>
      </div>

      <Button
        type="button"
        disabled={isFollowing || isSubmitting}
        onClick={() => onCopyTrade?.(profile)}
        className={cn(
          "h-11 w-full rounded-[8px] text-sm font-medium tracking-[-0.01em]",
          isFollowing
            ? "bg-surface-overlay-subtle text-text-sub cursor-not-allowed"
            : isSubmitting
              ? "bg-primary-light/70 text-text-inverse cursor-wait"
              : "bg-primary-light text-text-inverse hover:bg-primary-light/90",
        )}
      >
        {isFollowing
          ? "Following"
          : isSubmitting
            ? "Processing..."
            : "Follow Trade"}
      </Button>
    </article>
  );
};

export default CopyTradeProfileCard;
