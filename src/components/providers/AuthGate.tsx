"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/src/components/shadcn/button";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { cn } from "@/lib/utils";

const SPLASH_DURATION_MS = 1100;
const ONBOARDING_COMPLETE_KEY = "tickx-onboarding-complete";

type OnboardingStep = 1 | 2 | 3;

const StepIndicator = ({ step }: { step: OnboardingStep }) => (
  <div className="flex items-start gap-1" aria-label={`Step ${step} of 3`}>
    {[1, 2, 3].map((item) => (
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
  onContinue: () => void;
};

const StepOne = ({ onContinue }: StepOneProps) => (
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
        onClick={onContinue}
        className="bg-primary-light text-text-inverse hover:bg-primary-medium h-11 w-full rounded-[8px] text-sm font-medium tracking-[-0.01em] shadow-none"
      >
        Continue
      </Button>
    </div>
  </OnboardingShell>
);

type StepTwoProps = {
  isLoggingIn: boolean;
  onLogin: () => void;
};

const WalletOption = ({
  children,
  disabled,
  icon,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  icon: ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="bg-background-surface hover:bg-surface-field-strong flex min-h-16 w-full items-center justify-between rounded-[8px] px-4 py-3 text-left transition-colors disabled:cursor-wait disabled:opacity-70"
  >
    <span className="flex min-w-0 items-center gap-4">
      {icon}
      <span className="min-w-0">{children}</span>
    </span>
    <ChevronRight className="text-text-sub size-5 shrink-0" strokeWidth={1.8} />
  </button>
);

const StepTwo = ({ isLoggingIn, onLogin }: StepTwoProps) => (
  <OnboardingShell>
    <div className="flex flex-1 flex-col gap-10">
      <StepIndicator step={2} />

      <div className="flex flex-col gap-2.5">
        <h1 className="text-text-heading text-2xl font-semibold tracking-[-0.01em]">
          Connect a wallet.{" "}
          <span className="text-primary-light block">Trade in one click.</span>
        </h1>
        <p className="text-text-sub text-sm font-medium tracking-[-0.01em]">
          Secure your account and access your funds in one tap.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <WalletOption
          onClick={onLogin}
          disabled={isLoggingIn}
          icon={
            <Image
              src="/onboarding/world-id.svg"
              alt=""
              width={40}
              height={40}
              className="size-10"
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-text-heading truncate text-sm font-semibold tracking-[-0.01em]">
              {isLoggingIn ? "Signing in..." : "Sign in with World ID"}
            </span>
            <span className="bg-surface-overlay-strong text-primary-light rounded-full px-1.5 py-1 text-[8.57px] font-semibold tracking-[-0.01em] uppercase">
              Recommended
            </span>
          </span>
        </WalletOption>

        <WalletOption
          onClick={onLogin}
          disabled={isLoggingIn}
          icon={
            <span className="relative size-10 shrink-0 overflow-hidden">
              <Image
                src="/onboarding/metamask.png"
                alt=""
                width={147}
                height={40}
                className="absolute top-[-10px] left-[-10px] h-[59px] w-[217px] max-w-none"
              />
            </span>
          }
        >
          <span className="text-text-heading block truncate text-sm font-semibold tracking-[-0.01em]">
            Sign in with MetaMask
          </span>
        </WalletOption>

        <WalletOption
          onClick={onLogin}
          disabled={isLoggingIn}
          icon={
            <span className="bg-background-subtle flex size-10 shrink-0 items-center justify-center rounded-[8px]">
              <Wallet className="text-primary-light size-5" strokeWidth={1.8} />
            </span>
          }
        >
          <span className="text-text-heading block truncate text-sm font-semibold tracking-[-0.01em]">
            Connect Wallet
          </span>
          <span className="text-text-sub block text-xs font-medium tracking-[-0.01em]">
            300+ wallets
          </span>
        </WalletOption>
      </div>
    </div>
  </OnboardingShell>
);

type StepThreeProps = {
  onEnterApp: () => void;
};

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

const StepThree = ({ onEnterApp }: StepThreeProps) => (
  <OnboardingShell>
    <div className="flex flex-1 flex-col gap-10">
      <StepIndicator step={3} />

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
          onClick={onEnterApp}
          className="bg-primary-light text-text-inverse hover:bg-primary-medium h-11 w-full rounded-[8px] text-sm font-medium tracking-[-0.01em] shadow-none"
        >
          Verify with World ID
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onEnterApp}
          className="text-text-link-main hover:text-primary-light h-5 rounded-[8px] px-0 text-sm font-medium tracking-[-0.01em] shadow-none hover:bg-transparent"
        >
          Verify later. Enter App
        </Button>
      </div>
    </div>
  </OnboardingShell>
);

const AuthGate = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoggingIn, isMiniApp, login } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [step, setStep] = useState<OnboardingStep>(1);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true",
  );

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
    return <StepThree onEnterApp={enterApp} />;
  }

  if (step === 2) {
    return (
      <StepTwo
        isLoggingIn={isLoggingIn}
        onLogin={() => {
          window.localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
          setHasCompletedOnboarding(false);
          void login();
        }}
      />
    );
  }

  return <StepOne onContinue={() => setStep(2)} />;
};

export default AuthGate;
