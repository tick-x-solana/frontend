"use client";

import React from "react";
import { CopyIcon } from "@/src/assets/icons";
import { Button } from "@/src/components/shadcn/button";
import { toast } from "sonner";

const WORLD_ID = "2Ma85VOA";

const ReferralsHeader = () => {
  const handleCopyWorldId = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API is not available");
      }
      await navigator.clipboard.writeText(WORLD_ID);
      toast.success("WorldID copied");
    } catch {
      toast.error("Failed to copy WorldID");
    }
  };

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <h2 className="text-2xl leading-8 font-semibold tracking-[-0.01em] text-white">
        Social &amp; Referrals
      </h2>

      <div className="bg-border-main hidden h-10 w-px lg:block" />

      <div className="flex min-w-0 grow items-center gap-4 text-base leading-6 tracking-[-0.01em]">
        <p className="text-text-sub truncate font-medium">
          Refer users to earn rewards.
        </p>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="text-primary-medium h-auto shrink-0 p-0 font-semibold no-underline hover:no-underline"
          aria-label="Learn more about referrals"
        >
          Learn more
        </Button>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2 md:gap-3">
        <p className="text-text-sub text-base leading-6 font-medium tracking-[-0.01em]">
          My WorldID
        </p>

        <div className="bg-surface-overlay flex items-center gap-1.5 rounded-lg px-3 py-2">
          <p className="font-mono text-sm leading-5 font-medium tracking-[-0.01em] text-white">
            {WORLD_ID}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="focus-visible:ring-primary-light size-5 cursor-pointer rounded-sm border-none bg-transparent p-0 text-white/70 shadow-none transition-colors hover:bg-transparent hover:text-white focus-visible:ring-1"
            aria-label="Copy WorldID"
            onClick={handleCopyWorldId}
          >
            <CopyIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          className="text-primary-light border-primary-light hover:text-primary-light h-11 cursor-pointer bg-transparent px-4 py-1.5 text-sm leading-5 font-medium tracking-[-0.01em] whitespace-nowrap backdrop-blur-[8px] hover:bg-transparent"
        >
          Share on WorldChat
        </Button>
      </div>
    </header>
  );
};

export default ReferralsHeader;
