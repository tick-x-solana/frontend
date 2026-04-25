"use client";

import { CopyIcon } from "@/src/assets/icons";
import { Button } from "@/src/components/shadcn/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

type ReferralsHeaderProps = {
  onShareToChat: () => void;
  worldId: string | null;
};

const ReferralsHeader = ({ onShareToChat, worldId }: ReferralsHeaderProps) => {
  const resolvedWorldId = worldId?.trim() || "Not set";
  console.log("resolvedWorldId: ", resolvedWorldId);

  const handleCopyWorldId = async () => {
    if (!worldId?.trim()) {
      toast.error("WorldID is not available");
      return;
    }

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API is not available");
      }
      await navigator.clipboard.writeText(worldId.trim());
      toast.success("WorldID copied");
    } catch {
      toast.error("Failed to copy WorldID");
    }
  };

  return (
    <header className="flex flex-col gap-4">
      <div className="space-y-1">
        <h2 className="text-text-heading text-[27px] font-semibold tracking-[-0.03em]">
          Social &amp; Referrals
        </h2>
        <p className="text-text-sub text-sm tracking-[-0.01em]">
          Refer users to earn rewards.{" "}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="text-primary-medium h-auto p-0 font-semibold no-underline hover:no-underline"
            aria-label="Learn more about referrals"
          >
            Learn more
          </Button>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-text-sub shrink-0 text-sm font-medium tracking-[-0.01em]">
            My WorldID
          </p>

          <div className="border-border-main bg-surface-field flex h-11 min-w-0 items-center gap-2 rounded-[10px] border px-3">
            <p className="min-w-0 flex-1 truncate font-mono text-sm font-medium tracking-[-0.01em] text-white">
              {resolvedWorldId}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="focus-visible:ring-primary-light size-5 rounded-sm border-none bg-transparent p-0 text-white/70 shadow-none transition-colors hover:bg-transparent hover:text-white focus-visible:ring-1"
              aria-label="Copy WorldID"
              onClick={handleCopyWorldId}
            >
              <CopyIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            className="border-primary-light text-text-heading hover:text-text-heading hover:bg-surface-overlay-subtle ml-auto h-11 flex-1 rounded-[10px] bg-transparent px-4 text-sm font-medium backdrop-blur-[8px]"
            onClick={onShareToChat}
          >
            <Share2 className="size-4" />
            WorldChat
          </Button>
        </div>
      </div>
    </header>
  );
};

export default ReferralsHeader;
