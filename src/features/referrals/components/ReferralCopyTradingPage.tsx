"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MiniKit } from "@worldcoin/minikit-js";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/src/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/shadcn/dialog";
import { useAuth } from "@/src/components/providers/AuthProvider";
import CopyTradeProfileCard, {
  type CopyTradeProfile,
} from "@/src/features/referrals/components/CopyTradeProfileCard";
import useWorldMiniAppChatPay from "@/src/hooks/useWorldMiniAppChatPay";
import { extractOrderFollowings } from "@/src/features/trade/orderFollow";
import {
  getOrderFollowControllerListFollowingQueryKey,
  useOrderFollowControllerListFollowing,
  useOrderFollowControllerRegister,
} from "@/src/services/queries";

const REFERRAL_CODE_STORAGE_KEY = "tickx-referral-code";
const COPY_TRADE_PAYMENT_TO = "0x0cb3e84e2c4bf88032e2279e7dd11b4e75ba7303";
const COPY_TRADE_PAYMENT_AMOUNT_WLD = 0.001;
const COPY_TRADE_PAYMENT_DESCRIPTION = "Hello";
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

type ReferralCopyTradingPageProps = {
  refCode: string;
};

const ReferralCopyTradingPage = ({ refCode }: ReferralCopyTradingPageProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoggingIn } = useAuth();
  const { payWld, isPaying } = useWorldMiniAppChatPay();
  const { mutateAsync: registerOrderFollow } =
    useOrderFollowControllerRegister();
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isSubmittingFollow, setIsSubmittingFollow] = useState(false);
  const [selectedProfile, setSelectedProfile] =
    useState<CopyTradeProfile | null>(null);
  const [resolvedTargetWallet, setResolvedTargetWallet] = useState<
    string | null
  >(null);
  const { data: followingResponse } = useOrderFollowControllerListFollowing({
    query: {
      enabled: isAuthenticated && !isLoggingIn,
      staleTime: 10_000,
      refetchOnWindowFocus: true,
    },
  });

  useEffect(() => {
    window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, refCode);
  }, [refCode]);

  const resolveKolWalletAddress = useCallback(
    async (usernameOrWallet: string) => {
      const normalized = usernameOrWallet.trim().replace(/^@/, "");
      if (!normalized) {
        throw new Error("Missing referral username");
      }

      if (EVM_ADDRESS_REGEX.test(normalized)) {
        return normalized;
      }

      const user = await MiniKit.getUserByUsername(normalized);
      if (!user.walletAddress || !EVM_ADDRESS_REGEX.test(user.walletAddress)) {
        throw new Error(`Cannot resolve wallet for username "${normalized}"`);
      }

      return user.walletAddress;
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      try {
        const walletAddress = await resolveKolWalletAddress(refCode);
        if (mounted) {
          setResolvedTargetWallet(walletAddress);
        }
      } catch (error) {
        if (mounted) {
          setResolvedTargetWallet(null);
        }
        console.warn(
          "[ReferralCopyTradingPage] Failed to resolve target wallet",
          {
            refCode,
            error,
          },
        );
      }
    };

    void resolve();

    return () => {
      mounted = false;
    };
  }, [refCode, resolveKolWalletAddress]);

  const activeFollowingTargetIds = useMemo(
    () =>
      new Set(
        extractOrderFollowings(followingResponse)
          .filter((item) => item.status === "ACTIVE")
          .map((item) => item.targetUserId),
      ),
    [followingResponse],
  );

  const copyTradeProfiles = useMemo<CopyTradeProfile[]>(
    () => [
      {
        targetUserId: resolvedTargetWallet ?? undefined,
        initials: refCode.slice(0, 2).toUpperCase(),
        name: refCode,
        slots: "12/24",
        winRate: "68%",
        roi: "+24.5%",
        pnl7d: "+343.5",
      },
    ],
    [refCode, resolvedTargetWallet],
  );

  const handleOpenCopyTradeModal = useCallback(
    (profile: CopyTradeProfile) => {
      if (!isAuthenticated || isLoggingIn) {
        toast.error("Please sign in before starting follow trade.");
        return;
      }

      setSelectedProfile(profile);
      setIsPayModalOpen(true);
    },
    [isAuthenticated, isLoggingIn],
  );

  const handleCloseCopyTradeModal = useCallback(() => {
    if (isPaying || isSubmittingFollow) return;
    setIsPayModalOpen(false);
  }, [isPaying, isSubmittingFollow]);
  const handlePayModalOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setIsPayModalOpen(true);
        return;
      }
      handleCloseCopyTradeModal();
    },
    [handleCloseCopyTradeModal],
  );

  const handleConfirmCopyTrade = useCallback(async () => {
    if (!selectedProfile) return;

    setIsSubmittingFollow(true);
    try {
      const targetUserId =
        selectedProfile.targetUserId ??
        (await resolveKolWalletAddress(selectedProfile.name));

      const payPromise = payWld({
        to: COPY_TRADE_PAYMENT_TO,
        amountWld: COPY_TRADE_PAYMENT_AMOUNT_WLD,
        description: COPY_TRADE_PAYMENT_DESCRIPTION,
        fallback: () => {
          console.log("[Referrals] MiniKit fallback callback triggered");
        },
      });
      void payPromise
        .then((result) => {
          console.log("[Referrals] payWld resolved", { result });
        })
        .catch((error: unknown) => {
          console.error("[Referrals] payWld failed", { error });
        });

      await payPromise;

      await registerOrderFollow({
        data: {
          targetUserId,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: getOrderFollowControllerListFollowingQueryKey(),
      });

      toast.success("Follow trade started successfully.");
      setIsPayModalOpen(false);
    } catch (error) {
      console.error("[ReferralCopyTradingPage] Failed to start follow trade", {
        error,
      });
      toast.error("Unable to start follow trade. Please try again.");
    } finally {
      setIsSubmittingFollow(false);
    }
  }, [
    payWld,
    queryClient,
    registerOrderFollow,
    resolveKolWalletAddress,
    selectedProfile,
  ]);

  return (
    <section className="bg-background-main mx-auto flex min-h-[100dvh] w-full max-w-[393px] flex-col">
      <div className="flex flex-col gap-2 px-4 pt-5 pb-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push("/")}
          className="bg-surface-overlay-subtle hover:bg-surface-overlay-medium text-text-heading size-10 rounded-[8px] border border-transparent p-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Button>

        <h1 className="text-text-heading text-2xl font-semibold tracking-[-0.01em]">
          Follow Trading
        </h1>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex flex-col gap-4">
          {copyTradeProfiles.map((profile, index) => (
            <CopyTradeProfileCard
              key={`${profile.name}-${index}`}
              profile={profile}
              isFavorite={index === 0}
              isFollowing={
                profile.targetUserId
                  ? activeFollowingTargetIds.has(profile.targetUserId)
                  : false
              }
              isSubmitting={
                isSubmittingFollow && selectedProfile?.name === profile.name
              }
              onCopyTrade={handleOpenCopyTradeModal}
            />
          ))}
        </div>
      </div>

      <Dialog open={isPayModalOpen} onOpenChange={handlePayModalOpenChange}>
        <DialogContent className="pointer-events-none">
          <div className="border-border-main pointer-events-auto w-full max-w-[760px] rounded-[20px] border bg-[linear-gradient(112deg,var(--background-main)_0%,var(--surface-card-strong)_62%,var(--background-main)_100%)] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] md:p-8">
            <div className="flex flex-col gap-5 sm:gap-7">
              <DialogTitle className="text-text-heading text-lg font-semibold tracking-[-0.03em] sm:text-[42px]">
                Start Follow Trade
              </DialogTitle>
              <DialogDescription className="text-text-sub text-[14px] font-medium tracking-[-0.01em] sm:max-w-[620px] sm:text-[42px] sm:tracking-[-0.02em]">
                You need to pay {COPY_TRADE_PAYMENT_AMOUNT_WLD} WLD to start
                follow trading this profile.
              </DialogDescription>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-border-main text-text-inverse hover:text-text-inverse disabled:opacity-100 h-12 rounded-[12px] bg-white text-base font-medium tracking-[-0.01em] hover:bg-white/90 sm:h-16 sm:rounded-[16px] sm:text-[42px] sm:tracking-[-0.02em]"
                  onClick={handleCloseCopyTradeModal}
                  disabled={isPaying || isSubmittingFollow}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="border-border-main bg-surface-overlay text-text-heading hover:bg-surface-overlay-medium h-12 rounded-[12px] border text-base font-medium tracking-[-0.01em] sm:h-16 sm:rounded-[16px] sm:text-[42px] sm:tracking-[-0.02em]"
                  onClick={() => void handleConfirmCopyTrade()}
                  disabled={isPaying || isSubmittingFollow}
                >
                  {isPaying || isSubmittingFollow
                    ? "Processing..."
                    : "Pay & Start"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ReferralCopyTradingPage;
export { REFERRAL_CODE_STORAGE_KEY };
