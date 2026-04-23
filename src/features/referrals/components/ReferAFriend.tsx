"use client";

import React from "react";
import Image from "next/image";
import { CopyOutlineIcon } from "@/src/assets/icons";
import { Button } from "@/src/components/shadcn/button";
import { toast } from "sonner";

const REFERRAL_LINK = "https://tickx.net/ref/02Q8qJK4M";

const SOCIAL_LINKS = [
  { key: "facebook-main", href: "#", label: "Share on Facebook" },
  { key: "facebook-feed", href: "#", label: "Share on Facebook feed" },
  { key: "facebook-story", href: "#", label: "Share on Facebook story" },
  { key: "facebook-group", href: "#", label: "Share on Facebook group" },
];

const ReferAFriend = () => {
  const handleCopyReferral = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API is not available");
      }
      await navigator.clipboard.writeText(REFERRAL_LINK);
      toast.success("Referral link copied");
    } catch {
      toast.error("Failed to copy referral link");
    }
  };

  return (
    <section className="border-border-main bg-background-main flex w-full max-w-full flex-col gap-3 rounded-lg border p-4 xl:max-w-[360px]">
      <div className="flex items-start gap-4">
        <Image
          src="/icons/refer-friend-gem.png"
          alt="Referral gemstone"
          width={64}
          height={64}
          className="shrink-0 rounded-full"
        />

        <div className="min-w-0 space-y-1">
          <h3 className="text-text-heading text-base leading-6 font-semibold tracking-[-0.01em]">
            Refer a friend
          </h3>
          <p className="text-text-sub text-sm leading-5 tracking-[-0.01em]">
            Invite a friend to join the platform and earn points!
          </p>
        </div>
      </div>

      <div className="bg-border-main h-px w-full" />

      <div className="space-y-1">
        <p className="text-hint text-sm leading-5 font-medium tracking-[-0.01em]">
          Share my referral link:
        </p>
        <div className="bg-surface-overlay flex items-center gap-1.5 rounded-lg px-3 py-2">
          <p className="min-w-0 flex-1 truncate font-mono text-sm leading-5 font-medium tracking-[-0.01em] text-white">
            {REFERRAL_LINK}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="focus-visible:ring-primary-light size-5 cursor-pointer rounded-sm border-none bg-transparent p-0 text-white/70 shadow-none transition-colors hover:bg-transparent hover:text-white focus-visible:ring-1"
            aria-label="Copy referral link"
            onClick={handleCopyReferral}
          >
            <CopyOutlineIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Button
        type="button"
        className="bg-primary-medium text-text-inverse hover:bg-primary-light h-10 w-full rounded-lg px-3 py-1.5 text-sm leading-5 font-medium tracking-[-0.01em]"
      >
        Invite Friends
      </Button>

      <div className="flex items-center gap-3">
        {SOCIAL_LINKS.map((social) => (
          <Button
            key={social.key}
            type="button"
            variant="outline"
            size="icon"
            className="border-border-main hover:bg-surface-overlay size-10 rounded-[4px] bg-transparent text-white"
            aria-label={social.label}
          >
            <Image
              src="/icons/facebook-mark.svg"
              alt=""
              width={24}
              height={24}
              aria-hidden="true"
            />
          </Button>
        ))}
      </div>
    </section>
  );
};

export default ReferAFriend;
