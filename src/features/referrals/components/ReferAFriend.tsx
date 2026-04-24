"use client";

import Image from "next/image";
import { CopyOutlineIcon } from "@/src/assets/icons";
import { Button } from "@/src/components/shadcn/button";
import { toast } from "sonner";

const SOCIAL_LINKS = [
  { key: "facebook-main", href: "#", label: "Share on Facebook" },
  { key: "facebook-feed", href: "#", label: "Share on Facebook feed" },
  { key: "facebook-story", href: "#", label: "Share on Facebook story" },
  { key: "facebook-group", href: "#", label: "Share on Facebook group" },
];

type ReferAFriendProps = {
  referralLink: string;
};

const ReferAFriend = ({ referralLink }: ReferAFriendProps) => {
  const handleCopyReferral = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API is not available");
      }
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied");
    } catch {
      toast.error("Failed to copy referral link");
    }
  };

  return (
    <section className="border-border-main bg-surface-card flex w-full max-w-full flex-col gap-4 rounded-[14px] border p-4 shadow-[0_16px_32px_rgba(0,0,0,0.16)]">
      <div className="flex items-start gap-4">
        <Image
          src="/icons/refer-friend-gem.png"
          alt="Referral gemstone"
          width={64}
          height={64}
          className="shrink-0 rounded-full"
        />

        <div className="min-w-0 space-y-1">
          <h3 className="text-text-heading text-[22px] font-semibold tracking-[-0.02em]">
            Refer a friend
          </h3>
          <p className="text-text-sub text-sm tracking-[-0.01em]">
            Invite a friend to join the platform and earn points!
          </p>
        </div>
      </div>

      <div className="bg-border-main h-px w-full" />

      <div className="space-y-1">
        <p className="text-hint text-sm font-medium tracking-[-0.01em]">
          Share my referral link:
        </p>
        <div className="border-border-main bg-surface-field-strong flex items-center gap-2 rounded-[10px] border px-3 py-2.5">
          <p className="min-w-0 flex-1 truncate font-mono text-sm font-medium tracking-[0.02em] text-white">
            {referralLink}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="focus-visible:ring-primary-light size-5 rounded-sm border-none bg-transparent p-0 text-white/70 shadow-none transition-colors hover:bg-transparent hover:text-white focus-visible:ring-1"
            aria-label="Copy referral link"
            onClick={handleCopyReferral}
          >
            <CopyOutlineIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Button
        type="button"
        className="bg-primary-light text-text-inverse hover:bg-primary-medium h-11 w-full rounded-[10px] px-3 text-sm font-semibold tracking-[-0.01em] shadow-none"
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
            className="border-border-main hover:bg-surface-overlay size-10 rounded-[8px] bg-transparent text-white"
            aria-label={social.label}
          >
            <Image
              src="/world-app.avif"
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
