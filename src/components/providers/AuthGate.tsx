"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  IDKitRequestWidget,
  deviceLegacy,
  orbLegacy,
  type IDKitErrorCodes,
  type IDKitResult,
  type ResponseItemV3,
  type RpContext,
} from "@worldcoin/idkit";
import { Button } from "@/src/components/shadcn/button";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TICKX_MINI_APP_ID } from "@/src/features/referrals/constants";
import { authControllerVerifyMiniAppHuman } from "@/src/services/queries";

const SPLASH_DURATION_MS = 1100;
const VERIFY_SUCCESS_MS = 900;
const ONBOARDING_COMPLETE_KEY = "tickx-onboarding-complete";
const REDIRECT_HOME_AFTER_LOGIN_KEY = "tickx-redirect-home-after-login";
const VERIFY_HUMAN_ACTION = "verify-human";
const VERIFY_HUMAN_LEVEL = "device";

function setRedirectHomeAfterLoginFlag() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(REDIRECT_HOME_AFTER_LOGIN_KEY, "true");
}

function consumeRedirectHomeAfterLoginFlag() {
  if (typeof window === "undefined") return false;

  const shouldRedirect =
    window.sessionStorage.getItem(REDIRECT_HOME_AFTER_LOGIN_KEY) === "true";

  if (shouldRedirect) {
    window.sessionStorage.removeItem(REDIRECT_HOME_AFTER_LOGIN_KEY);
  }

  return shouldRedirect;
}

type OnboardingStep = 1 | 2;

const StepIndicator = ({ step }: { step: OnboardingStep }) => (
  <div className="flex items-start gap-1" aria-label={`Step ${step} of 2`}>
    {[1, 2].map((item) => (
      <span
        key={item}
        className={cn(
          "h-1 w-6 rounded-[31px]",
          item === step ? "bg-primary-light" : "bg-background-surface",
        )}
      />
    ))}
  </div>
);

const OnboardingShell = ({ children }: { children: ReactNode }) => (
  <div className="bg-background-main fixed inset-0 z-50 flex justify-center overflow-hidden">
    <div className="flex min-h-[100dvh] w-full max-w-[393px] flex-col px-4 py-10">
      {children}
    </div>
  </div>
);

const SplashScreen = () => (
  <OnboardingShell>
    <div className="flex flex-1 items-center justify-center">
      <div className="bg-primary-light flex size-[125px] items-center justify-center rounded-[8px]">
        <Image
          src="/branding/tickx-mark.svg"
          alt="TickX"
          width={87}
          height={84}
          priority
          className="h-[84px] w-[87px]"
        />
      </div>
    </div>
  </OnboardingShell>
);

type StepOneProps = {
  isLoggingIn: boolean;
  onLogin: () => void;
};

const StepOne = ({ isLoggingIn, onLogin }: StepOneProps) => (
  <OnboardingShell>
    <div className="flex flex-1 flex-col gap-10">
      <StepIndicator step={1} />

      <div className="flex flex-col gap-2.5">
        <h1 className="text-text-heading text-2xl font-semibold tracking-[-0.01em]">
          Welcome to <span className="text-primary-light">TickX</span>
        </h1>
        <p className="text-text-sub text-sm font-medium tracking-[-0.01em]">
          High-frequency prediction markets. Trade price movements in seconds
          with zero latency.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Image
          src="/onboarding/welcome-logo.png"
          alt=""
          width={782}
          height={728}
          priority
          className="w-full max-w-[352px] object-contain"
        />
      </div>

      <Button
        type="button"
        size="lg"
        onClick={onLogin}
        disabled={isLoggingIn}
        className="bg-primary-light text-text-inverse hover:bg-primary-medium h-11 w-full rounded-[8px] text-sm font-medium tracking-[-0.01em] shadow-none"
      >
        {isLoggingIn ? "Signing in..." : "Sign In with World ID"}
      </Button>
    </div>
  </OnboardingShell>
);

type StepTwoProps = {
  onEnterApp: () => void;
  walletAddress: string | null;
};

type RpSignatureResponse = {
  sig: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  rp_id: string;
};

function getLegacyProofResponse(result: IDKitResult) {
  const response = result.responses[0];
  if (
    !response ||
    typeof response !== "object" ||
    !("merkle_root" in response) ||
    !("nullifier" in response) ||
    typeof response.proof !== "string"
  ) {
    throw new Error("Unsupported verification payload");
  }

  return response as ResponseItemV3;
}

const BenefitRow = ({
  description,
  title,
}: {
  description: string;
  title: string;
}) => (
  <div className="flex items-start gap-2">
    <span className="flex size-6 shrink-0 items-center justify-center">
      <Sparkles className="text-text-sub size-4" strokeWidth={1.8} />
    </span>
    <span className="flex min-w-0 flex-col gap-1">
      <span className="text-text-heading text-sm font-semibold tracking-[-0.01em]">
        {title}
      </span>
      <span className="text-text-sub text-xs font-medium tracking-[-0.01em]">
        {description}
      </span>
    </span>
  </div>
);

const StepTwo = ({ onEnterApp, walletAddress }: StepTwoProps) => {
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "loading" | "success"
  >("idle");
  const [isPreparingVerify, setIsPreparingVerify] = useState(false);
  const [isVerifyWidgetOpen, setIsVerifyWidgetOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const isVerifying = verifyStatus === "loading" || isPreparingVerify;

  const fetchRpContext = useCallback(async () => {
    const response = await fetch("/api/rp-signature", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: VERIFY_HUMAN_ACTION }),
    });
    if (!response.ok) {
      throw new Error("Failed to create RP signature");
    }

    const data = (await response.json()) as RpSignatureResponse;

    return {
      rp_id: data.rp_id,
      nonce: data.nonce,
      created_at: data.created_at,
      expires_at: data.expires_at,
      signature: data.sig,
    } satisfies RpContext;
  }, []);

  const handleOpenVerifyFlow = useCallback(async () => {
    if (isVerifying || verifyStatus === "success") {
      return;
    }

    if (!walletAddress) {
      toast.error("Missing wallet address. Please sign in again.");
      return;
    }

    try {
      setIsPreparingVerify(true);
      const nextRpContext = await fetchRpContext();
      setRpContext(nextRpContext);
      setIsVerifyWidgetOpen(true);
    } catch {
      toast.error("Unable to start verification. Please try again.");
    } finally {
      setIsPreparingVerify(false);
    }
  }, [fetchRpContext, isVerifying, verifyStatus, walletAddress]);

  const handleVerify = useCallback(
    async (result: IDKitResult) => {
      if (!rpContext) {
        throw new Error("Missing RP context");
      }

      setVerifyStatus("loading");

      const response = await fetch("/api/verify-proof", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rp_id: rpContext.rp_id,
          idkitResponse: result,
        }),
      });

      if (!response.ok) {
        setVerifyStatus("idle");
        throw new Error("Backend proof verification failed");
      }
    },
    [rpContext],
  );

  const handleVerifySuccess = useCallback(
    async (result: IDKitResult) => {
      setIsVerifyWidgetOpen(false);

      try {
        if (!walletAddress) {
          throw new Error("Missing wallet address");
        }

        const verifyResponse = getLegacyProofResponse(result);

        await authControllerVerifyMiniAppHuman({
          action: VERIFY_HUMAN_ACTION,
          signal: walletAddress.toLowerCase(),
          payload: {
            proof: verifyResponse.proof,
            merkle_root: verifyResponse.merkle_root,
            nullifier_hash: verifyResponse.nullifier,
            verification_level: VERIFY_HUMAN_LEVEL,
          },
        });

        setVerifyStatus("success");
        toast.success("Verification successful. Welcome to TickX.");

        successTimerRef.current = window.setTimeout(() => {
          onEnterApp();
        }, VERIFY_SUCCESS_MS);
      } catch {
        setVerifyStatus("idle");
        toast.error("World ID verification failed. Please try again.");
      }
    },
    [onEnterApp, walletAddress],
  );

  const handleVerifyError = useCallback((errorCode: IDKitErrorCodes) => {
    setIsVerifyWidgetOpen(false);
    setVerifyStatus("idle");
    if (errorCode === "user_rejected") {
      toast.error("You rejected the verification request.");
      return;
    }
    toast.error("World ID verification failed. Please try again.");
  }, []);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  return (
    <OnboardingShell>
      <div className="flex flex-1 flex-col gap-10">
        <StepIndicator step={2} />

        <div className="flex flex-1 flex-col gap-10">
          <div className="flex flex-col gap-2.5">
            <h1 className="text-text-heading text-2xl font-semibold tracking-[-0.01em]">
              Verify with World ID.{" "}
              <span className="text-primary-light block">Unlock the edge.</span>
            </h1>
            <p className="text-text-sub text-sm font-medium tracking-[-0.01em]">
              Prove you&apos;re a unique human. Bots stay out. You get more.
            </p>
          </div>

          <section className="border-border-main bg-surface-overlay-subtle relative overflow-hidden rounded-[16px] border p-4">
            <Image
              src="/onboarding/verified-glow.svg"
              alt=""
              width={162}
              height={162}
              className="absolute top-[-82px] right-[-64px] size-[162px]"
            />

            <div className="relative flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Image
                  src="/onboarding/verified-badge.svg"
                  alt=""
                  width={32}
                  height={32}
                  className="size-8"
                />
                <h2 className="text-text-main text-lg font-semibold tracking-[-0.01em]">
                  Verified Human
                </h2>
              </div>

              <div className="flex flex-col gap-2.5">
                <BenefitRow
                  title="+2% Edge Unlocked"
                  description="Better payouts on every trade"
                />
                <BenefitRow
                  title="Higher trade limits"
                  description="Up to $5,000 per prediction"
                />
                <BenefitRow
                  title="Leaderboard eligibility"
                  description="Compete with verified humans only"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col items-center gap-4">
          <Button
            type="button"
            size="lg"
            onClick={() => void handleOpenVerifyFlow()}
            disabled={isVerifying || verifyStatus === "success"}
            className="bg-primary-light text-text-inverse hover:bg-primary-medium h-11 w-full rounded-[8px] text-sm font-medium tracking-[-0.01em] shadow-none disabled:opacity-70"
          >
            {isPreparingVerify
              ? "Preparing..."
              : verifyStatus === "loading"
                ? "Verifying..."
                : verifyStatus === "success"
                  ? "Verified"
                  : "Verify with World ID"}
          </Button>
          {verifyStatus !== "loading" && verifyStatus !== "success" && (
            <Button
              type="button"
              variant="ghost"
              onClick={onEnterApp}
              disabled={isVerifying}
              className="text-text-link-main hover:text-primary-light h-5 rounded-[8px] px-0 text-sm font-medium tracking-[-0.01em] shadow-none hover:bg-transparent disabled:opacity-60"
            >
              Verify later. Enter App
            </Button>
          )}

          {verifyStatus === "loading" ? (
            <p className="text-text-sub text-xs font-medium tracking-[-0.01em]">
              Verifying your World ID...
            </p>
          ) : null}

          {isPreparingVerify ? (
            <p className="text-text-sub text-xs font-medium tracking-[-0.01em]">
              Preparing verification request...
            </p>
          ) : null}

          {verifyStatus === "success" ? (
            <p className="text-success-medium text-xs font-medium tracking-[-0.01em]">
              Verification successful. Entering the app...
            </p>
          ) : null}
        </div>
      </div>
      {rpContext ? (
        <IDKitRequestWidget
          open={isVerifyWidgetOpen}
          onOpenChange={setIsVerifyWidgetOpen}
          app_id={TICKX_MINI_APP_ID}
          action={VERIFY_HUMAN_ACTION}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          // Verify level: Orb | Device
          preset={
            walletAddress
              ? orbLegacy({ signal: walletAddress.toLowerCase() })
              : orbLegacy()
          }
          handleVerify={handleVerify}
          onSuccess={handleVerifySuccess}
          onError={handleVerifyError}
        />
      ) : null}
    </OnboardingShell>
  );
};

const AuthGate = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoggingIn, isMiniApp, login, walletAddress } =
    useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const wasAuthenticatedRef = useRef(isAuthenticated);
  const [showSplash, setShowSplash] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true",
  );

  useEffect(() => {
    const justAuthenticated = !wasAuthenticatedRef.current && isAuthenticated;
    wasAuthenticatedRef.current = isAuthenticated;

    if (!justAuthenticated || pathname === "/" || !isMiniApp) {
      return;
    }

    if (!consumeRedirectHomeAfterLoginFlag()) {
      return;
    }

    router.replace("/");
  }, [isAuthenticated, isMiniApp, pathname, router]);

  useEffect(() => {
    if (!isMiniApp) return;

    const timeout = window.setTimeout(() => {
      setShowSplash(false);
    }, SPLASH_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [isMiniApp]);

  // if (!isMiniApp || true) {
  // if (!isMiniApp || true) {
  if (!isMiniApp || isAuthenticated) {
    if (!isMiniApp || hasCompletedOnboarding) {
      return children;
    }
  }

  if (showSplash) {
    return <SplashScreen />;
  }

  const enterApp = () => {
    window.localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    setHasCompletedOnboarding(true);
  };

  if (isAuthenticated) {
    return <StepTwo onEnterApp={enterApp} walletAddress={walletAddress} />;
  }

  return (
    <StepOne
      isLoggingIn={isLoggingIn}
      onLogin={() => {
        window.localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
        setHasCompletedOnboarding(false);
        setRedirectHomeAfterLoginFlag();
        void login();
      }}
    />
  );
};

export default AuthGate;
