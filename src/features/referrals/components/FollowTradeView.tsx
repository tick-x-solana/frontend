"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/src/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/shadcn/dialog";
import { useAuth } from "@/src/components/providers/AuthProvider";
import {
  extractOrderFollowings,
  getUserInitials,
} from "@/src/features/trade/orderFollow";
import { buildMiniAppReferralLink } from "@/src/features/referrals/constants";
import {
  getOrderFollowControllerListFollowersQueryKey,
  getOrderFollowControllerListFollowingQueryKey,
  useOrderFollowControllerListFollowers,
  useOrderFollowControllerListFollowing,
  useOrderFollowControllerUnsubscribe,
} from "@/src/services/queries";
import { cn } from "@/lib/utils";

type Tab = "followers" | "following";

const FAKE_STATS = {
  winRate: "68%",
  roi: "+24.5%",
  pnl7d: "+$343.5",
  slots: "12/24",
};

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function isAddress(value: string) {
  return EVM_ADDRESS_REGEX.test(value);
}

function useResolvedUsername(userId: string, apiUsername?: string | null) {
  // On Solana there is no on-chain username lookup — use apiUsername if not an address
  return apiUsername && !EVM_ADDRESS_REGEX.test(apiUsername) ? apiUsername : null;
}

function UserCard({
  userId,
  username,
  canUnfollow,
  onUnfollow,
  isUnfollowing,
}: {
  userId: string;
  username?: string | null;
  canUnfollow?: boolean;
  onUnfollow?: (userId: string, displayName: string) => void;
  isUnfollowing?: boolean;
}) {
  const resolvedUsername = useResolvedUsername(userId, username);
  const initials = getUserInitials(resolvedUsername ?? userId);
  const displayName = resolvedUsername
    ? resolvedUsername.startsWith("@")
      ? resolvedUsername
      : `@${resolvedUsername}`
    : `${userId.slice(0, 6)}...${userId.slice(-4)}`;

  return (
    <article className="border-border-main bg-background-surface flex flex-col gap-3 rounded-[12px] border p-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="bg-primary-light text-text-inverse flex size-10 items-center justify-center rounded-full text-sm font-semibold tracking-[-0.01em]">
            {initials}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-text-heading truncate text-[14px] font-semibold tracking-[-0.01em]">
            {displayName}
          </p>
          <p className="text-text-sub font-mono text-[12px] tracking-[-0.01em]">
            {userId.slice(0, 8)}...{userId.slice(-4)}
          </p>
        </div>
        {canUnfollow && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={isUnfollowing}
            onClick={() => onUnfollow?.(userId, displayName)}
            className="text-hint hover:text-error-light hover:bg-surface-overlay-subtle size-8 rounded-[8px]"
            aria-label={`Unfollow ${displayName}`}
          >
            {isUnfollowing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserMinus className="size-4" />
            )}
          </Button>
        )}
      </div>

      <div className="bg-border-main h-px w-full" />

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-text-sub text-[12px] font-medium tracking-[-0.01em]">
            Win rate
          </p>
          <p className="text-success-medium text-[13px] font-semibold tracking-[-0.01em]">
            {FAKE_STATS.winRate}
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-text-sub text-[12px] font-medium tracking-[-0.01em]">
            ROI
          </p>
          <p className="text-text-heading text-[13px] font-semibold tracking-[-0.01em]">
            {FAKE_STATS.roi}
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-text-sub text-[12px] font-medium tracking-[-0.01em]">
            7D PnL
          </p>
          <p className="text-text-heading text-[13px] font-semibold tracking-[-0.01em]">
            {FAKE_STATS.pnl7d}
          </p>
        </div>
      </div>
    </article>
  );
}

function EmptyFollowersState({
  referralLink,
  onCopy,
}: {
  referralLink: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Preview card — fake follower to show what it'll look like */}
      <div className="relative">
        <article className="border-border-main bg-background-surface flex flex-col gap-3 rounded-[12px] border p-4 opacity-40 select-none">
          <div className="flex items-center gap-3">
            <div className="bg-primary-light text-text-inverse flex size-10 items-center justify-center rounded-full text-sm font-semibold">
              AS
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-text-heading text-[14px] font-semibold">
                @paul_laverick
              </p>
              <p className="text-text-sub font-mono text-[12px]">
                0x1234...5678
              </p>
            </div>
          </div>
          <div className="bg-border-main h-px w-full" />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-text-sub text-[12px] font-medium">Win rate</p>
              <p className="text-success-medium text-[13px] font-semibold">68%</p>
            </div>
            <div>
              <p className="text-text-sub text-[12px] font-medium">ROI</p>
              <p className="text-text-heading text-[13px] font-semibold">+24.5%</p>
            </div>
            <div>
              <p className="text-text-sub text-[12px] font-medium">7D PnL</p>
              <p className="text-text-heading text-[13px] font-semibold">+$343.5</p>
            </div>
          </div>
        </article>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[12px] backdrop-blur-[2px]">
          <Users className="text-text-sub size-6" strokeWidth={1.6} />
          <p className="text-text-heading text-[14px] font-semibold tracking-[-0.01em]">
            No followers yet
          </p>
          <p className="text-text-sub text-center text-[13px] tracking-[-0.01em]">
            Share your ref link to get your first follower
          </p>
        </div>
      </div>

      {/* Share ref link */}
      <div className="border-border-main bg-background-surface flex flex-col gap-3 rounded-[12px] border p-4">
        <p className="text-text-heading text-[13px] font-semibold tracking-[-0.01em]">
          Your referral link
        </p>
        <div className="border-border-main bg-background-main flex items-center gap-2 rounded-[8px] border px-3 py-2.5">
          <p className="text-text-sub flex-1 truncate font-mono text-[12px]">
            {referralLink}
          </p>
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copy referral link"
            className="text-text-sub hover:text-primary-light shrink-0 transition-colors"
          >
            <Copy className="size-4" />
          </button>
        </div>
        <p className="text-text-sub text-[12px] tracking-[-0.01em]">
          When someone follows your link and copies your trades, they appear
          here.
        </p>
      </div>
    </div>
  );
}

function EmptyFollowingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <Users className="text-text-sub size-8" strokeWidth={1.4} />
      <p className="text-text-heading text-[14px] font-semibold tracking-[-0.01em]">
        Not following anyone
      </p>
      <p className="text-text-sub text-center text-[13px] tracking-[-0.01em]">
        Use a referral link from a top trader to start copy trading.
      </p>
    </div>
  );
}

const FollowTradeView = () => {
  const [activeTab, setActiveTab] = useState<Tab>("followers");
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);
  const [confirmDisplayName, setConfirmDisplayName] = useState<string>("");
  const [isUnfollowing, setIsUnfollowing] = useState(false);
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoggingIn, walletAddress, username } = useAuth();

  const referralLink = useMemo(
    () => buildMiniAppReferralLink(username ?? walletAddress),
    [username, walletAddress],
  );

  const enabled = isAuthenticated && !isLoggingIn;

  const { data: followingResponse, isLoading: isLoadingFollowing } =
    useOrderFollowControllerListFollowing({
      query: { enabled, staleTime: 10_000, refetchOnWindowFocus: true },
    });

  const { data: followersResponse, isLoading: isLoadingFollowers } =
    useOrderFollowControllerListFollowers({
      query: { enabled, staleTime: 10_000, refetchOnWindowFocus: true },
    });

  const { mutateAsync: unsubscribe } = useOrderFollowControllerUnsubscribe();

  const followingList = useMemo(
    () => extractOrderFollowings(followingResponse),
    [followingResponse],
  );

  const followerList = useMemo(
    () => extractOrderFollowings(followersResponse),
    [followersResponse],
  );

  const requestUnfollow = (userId: string, displayName: string) => {
    setConfirmUserId(userId);
    setConfirmDisplayName(displayName);
  };

  const handleConfirmUnfollow = async () => {
    if (!confirmUserId) return;
    setIsUnfollowing(true);
    try {
      await unsubscribe({ targetUserId: confirmUserId.toLowerCase() });
      await queryClient.invalidateQueries({
        queryKey: getOrderFollowControllerListFollowingQueryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: getOrderFollowControllerListFollowersQueryKey(),
      });
      toast.success("Unfollowed successfully");
      setConfirmUserId(null);
    } catch {
      toast.error("Failed to unfollow");
    } finally {
      setIsUnfollowing(false);
    }
  };

  const handleCopyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const isLoading =
    activeTab === "following" ? isLoadingFollowing : isLoadingFollowers;

  return (
    <>
      <section className="flex flex-col gap-4 pb-4">
        <h2 className="text-text-heading text-[20px] font-semibold tracking-[-0.01em]">
          Follow Trade
        </h2>

        {/* Tab switcher */}
        <div className="bg-surface-overlay-subtle flex items-center gap-1 rounded-[12px] p-1">
          {(["followers", "following"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 rounded-[8px] px-3 py-1.5 text-[14px] font-semibold tracking-[-0.01em] capitalize transition-colors",
                activeTab === tab
                  ? "bg-background-surface text-primary-medium"
                  : "text-hint hover:text-text-sub",
              )}
            >
              {tab}
              {tab === "following" && followingList.length > 0 && (
                <span className="bg-primary-light/15 text-primary-medium ml-1.5 rounded-full px-1.5 py-0.5 text-[11px]">
                  {followingList.length}
                </span>
              )}
              {tab === "followers" && followerList.length > 0 && (
                <span className="bg-primary-light/15 text-primary-medium ml-1.5 rounded-full px-1.5 py-0.5 text-[11px]">
                  {followerList.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="text-text-sub size-6 animate-spin" />
          </div>
        ) : activeTab === "followers" ? (
          followerList.length === 0 ? (
            <EmptyFollowersState
              referralLink={referralLink}
              onCopy={handleCopyReferralLink}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {followerList.map((item) => (
                <UserCard
                  key={item.subscriberUserId ?? item.targetUserId}
                  userId={item.subscriberUserId ?? item.targetUserId}
                  username={item.targetUsername}
                />
              ))}
            </div>
          )
        ) : followingList.length === 0 ? (
          <EmptyFollowingState />
        ) : (
          <div className="flex flex-col gap-3">
            {followingList.map((item) => (
              <UserCard
                key={item.targetUserId}
                userId={item.targetUserId}
                username={item.targetUsername}
                canUnfollow
                isUnfollowing={isUnfollowing && confirmUserId === item.targetUserId}
                onUnfollow={requestUnfollow}
              />
            ))}
          </div>
        )}
      </section>

      {/* Unfollow confirm dialog */}
      <Dialog
        open={confirmUserId !== null}
        onOpenChange={(open) => {
          if (!open && !isUnfollowing) setConfirmUserId(null);
        }}
      >
        <DialogContent className="pointer-events-none">
          <div className="border-border-main pointer-events-auto w-full max-w-[340px] rounded-[20px] border bg-background-surface p-5 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <DialogTitle className="text-text-heading mb-1 text-[17px] font-semibold tracking-[-0.01em]">
              Unfollow trader?
            </DialogTitle>
            <DialogDescription className="text-text-sub mb-5 text-[13px] tracking-[-0.01em]">
              You are about to unfollow{" "}
              <span className="text-text-heading font-semibold">
                {confirmDisplayName}
              </span>
              . Copy trading will stop immediately.
            </DialogDescription>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                disabled={isUnfollowing}
                onClick={() => void handleConfirmUnfollow()}
                className="h-11 w-full rounded-[10px] bg-red-500/90 text-[14px] font-semibold text-white hover:bg-red-500"
              >
                {isUnfollowing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Unfollow"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isUnfollowing}
                onClick={() => setConfirmUserId(null)}
                className="text-text-sub hover:bg-surface-overlay-subtle h-11 w-full rounded-[10px] text-[14px] font-semibold"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FollowTradeView;
