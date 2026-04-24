"use client";

import { WalletIcon } from "@/src/assets/icons";
import WldMarketIcon from "@/src/assets/icons/wld-market.svg";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Button } from "@/src/components/shadcn/button";
import { useGameStore } from "@/src/features/trade/store";
import useDepositWithdraw from "@/src/hooks/useDepositWithdraw";
import { useAccountControllerGetBalance } from "@/src/services/queries";
import { ArrowLeft, ArrowUpDown, Eye, EyeOff } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Sheet } from "react-modal-sheet";
import { toast } from "sonner";

type PortfolioAction = "withdraw" | "deposit";

function extractBalance(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  return (
    extractBalance(record.free) ??
    extractBalance(record.amount) ??
    extractBalance(record.availableBalance) ??
    extractBalance(record.data)
  );
}

function normalizeDecimalInput(value: string): string {
  const normalizedValue = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = normalizedValue.split(".");

  if (decimalParts.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${decimalParts.join("")}`;
}

const WalletActionPanel = () => {
  const [activeAction, setActiveAction] = useState<PortfolioAction | null>(
    null,
  );
  const [amountInput, setAmountInput] = useState("");
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [availableWldBalance, setAvailableWldBalance] = useState<string | null>(
    null,
  );
  const { walletAddress } = useAuth();
  const storeBalance = useGameStore((state) => state.balance);
  const { data: balanceResponse, refetch: refetchBalance } =
    useAccountControllerGetBalance({
      query: {
        enabled: Boolean(walletAddress),
      },
    });
  const [wldUsdPrice, setWldUsdPrice] = useState<number | null>(null);
  const {
    isDepositing,
    isWithdrawing,
    getWldUsdPrice,
    getAvailableWldBalance,
    depositWldToUsd,
    withdrawUsdToWld,
  } = useDepositWithdraw();

  const activeLabel = useMemo(() => {
    if (!activeAction) {
      return "";
    }
    return activeAction === "withdraw" ? "Withdraw" : "Deposit";
  }, [activeAction]);

  const isWithdraw = activeAction === "withdraw";

  const primaryUnit = isWithdraw ? "USD" : "WLD";
  const secondaryUnit = isWithdraw ? "WLD" : "USD";
  const pairLabel = Number.isFinite(wldUsdPrice)
    ? `1 WLD ~ $${(wldUsdPrice as number).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })}`
    : "Fetching WLD price...";

  const normalizedAmountInput = useMemo(
    () => normalizeDecimalInput(amountInput),
    [amountInput],
  );
  const numericAmount = Number(normalizedAmountInput || "0");
  const receivedValue =
    Number.isFinite(numericAmount) && Number.isFinite(wldUsdPrice)
      ? isWithdraw
        ? numericAmount / (wldUsdPrice as number)
        : numericAmount * (wldUsdPrice as number)
      : 0;

  const receivedDisplay = isWithdraw
    ? receivedValue.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 8,
      })
    : receivedValue.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });

  const displayWalletAddress = useMemo(() => {
    if (!walletAddress) {
      return "Not connected";
    }

    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const displayBalance = useMemo(() => {
    const apiBalance = extractBalance(balanceResponse);
    const resolvedBalance = apiBalance ?? storeBalance;

    if (!Number.isFinite(resolvedBalance)) {
      return "$0";
    }

    return `$${resolvedBalance.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }, [balanceResponse, storeBalance]);

  const visibleBalance = isBalanceVisible ? displayBalance : "******";

  const toggleBalanceVisibility = useCallback(() => {
    setIsBalanceVisible((current) => !current);
  }, []);

  const displayWldBalance = useMemo(() => {
    if (availableWldBalance === null) {
      return "Loading...";
    }

    const numericWldBalance = Number(availableWldBalance);
    const formattedWldBalance = Number.isFinite(numericWldBalance)
      ? numericWldBalance.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : availableWldBalance;

    return `${formattedWldBalance} WLD`;
  }, [availableWldBalance]);

  useEffect(() => {
    if (activeAction !== "deposit") {
      return;
    }

    void getAvailableWldBalance()
      .then((balance) => setAvailableWldBalance(balance.formatted))
      .catch(() => setAvailableWldBalance(null));
  }, [activeAction, getAvailableWldBalance]);

  const openActionSheet = useCallback(
    (action: PortfolioAction) => {
      setActiveAction(action);
      setAmountInput("");
      void getWldUsdPrice()
        .then((price) => setWldUsdPrice(price))
        .catch(() => setWldUsdPrice(null));
      if (action === "deposit") {
        void getAvailableWldBalance()
          .then((balance) => setAvailableWldBalance(balance.formatted))
          .catch(() => setAvailableWldBalance(null));
      }
    },
    [getAvailableWldBalance, getWldUsdPrice],
  );

  const closeActionSheet = useCallback(() => {
    setActiveAction(null);
  }, []);

  const toggleActionMode = useCallback(() => {
    setActiveAction((current) => {
      if (current === "deposit") return "withdraw";
      if (current === "withdraw") return "deposit";
      return current;
    });
  }, []);

  const handleAmountInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setAmountInput(normalizeDecimalInput(event.target.value));
    },
    [],
  );

  const handlePrimaryAction = useCallback(async () => {
    if (!activeAction) {
      return;
    }

    if (activeAction === "withdraw") {
      try {
        await withdrawUsdToWld({ amountUsd: normalizedAmountInput.trim() });
        await refetchBalance();
        setAmountInput("");
        closeActionSheet();
      } catch (error) {
        console.error("Withdrawal action failed", error);
      }
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a valid amount to deposit");
      return;
    }

    try {
      await depositWldToUsd({ amountWld: normalizedAmountInput.trim() });
      await refetchBalance();
      const wldBalance = await getAvailableWldBalance();
      setAvailableWldBalance(wldBalance.formatted);
      setAmountInput("");
      closeActionSheet();
    } catch (error) {
      console.error("Deposit action failed", error);
    }
  }, [
    activeAction,
    closeActionSheet,
    depositWldToUsd,
    getAvailableWldBalance,
    numericAmount,
    normalizedAmountInput,
    refetchBalance,
    withdrawUsdToWld,
  ]);

  return (
    <>
      <div className="border-border-main flex flex-col gap-2 rounded-[8px] border p-2">
        <div className="bg-surface-overlay-subtle flex h-[58px] items-center gap-2 rounded-[8px] p-2">
          <div className="bg-background-subtle text-primary-light flex size-10 items-center justify-center rounded-[8px]">
            <WalletIcon className="size-5" aria-hidden="true" />
          </div>

          <div className="flex flex-col justify-center gap-[2px]">
            <p className="text-text-main text-sm font-medium tracking-[-0.01em]">
              {displayWalletAddress}
            </p>

            <div className="flex items-center gap-2">
              <p className="text-hint text-xs font-semibold tracking-[-0.01em]">
                Balance:
              </p>
              <p className="text-primary-light font-mono text-xs font-bold tracking-[-0.01em]">
                {visibleBalance}
              </p>
              <button
                type="button"
                aria-label={
                  isBalanceVisible ? "Hide wallet balance" : "Show wallet balance"
                }
                onClick={toggleBalanceVisibility}
                className="text-hint hover:text-text-sub transition-colors"
              >
                {isBalanceVisible ? (
                  <Eye className="size-4" strokeWidth={1.75} />
                ) : (
                  <EyeOff className="size-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid h-11 grid-cols-2 gap-2">
          <Button
            type="button"
            className="bg-primary-light text-text-inverse hover:bg-primary-light/90 h-full rounded-[8px] border-none text-sm font-medium"
            onClick={() => openActionSheet("withdraw")}
          >
            Withdraw
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-primary-light text-primary-light hover:bg-surface-overlay-subtle hover:text-primary-light h-full rounded-[8px] bg-transparent text-sm font-medium backdrop-blur-[8px]"
            onClick={() => openActionSheet("deposit")}
          >
            Deposit
          </Button>
        </div>
      </div>

      <Sheet
        isOpen={activeAction !== null}
        onClose={closeActionSheet}
        detent="full"
        className="z-[70]"
        unstyled
      >
        <Sheet.Backdrop
          onClick={closeActionSheet}
          className="bg-background-main/55 fixed inset-0 backdrop-blur-[2px]"
        />
        <Sheet.Container className="pointer-events-none">
          <Sheet.Content
            disableDrag={false}
            className="bg-background-main border-border-main pointer-events-auto max-h-[calc(100dvh-env(safe-area-inset-top)-8px)] rounded-t-[24px] border-t"
          >
            <div className="flex min-h-0 flex-col px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <div className="flex flex-col gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="bg-background-subtle text-text-sub hover:bg-background-subtle/90 size-10 rounded-[8px]"
                  onClick={closeActionSheet}
                  aria-label="Close action screen"
                >
                  <ArrowLeft className="size-6" />
                </Button>

                <h2 className="text-text-heading text-2xl font-semibold tracking-[-0.01em]">
                  {activeLabel}
                </h2>
              </div>

              <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-background-subtle border-border-main flex size-10 items-center justify-center rounded-full border">
                    <WldMarketIcon aria-hidden className="size-4" />
                  </div>

                  <p className="text-text-sub text-sm font-medium tracking-[-0.01em]">
                    {pairLabel}
                  </p>

                  <div className="bg-background-subtle flex items-center gap-2 rounded-[8px] px-2 py-1">
                    <p className="text-hint text-xs font-semibold tracking-[-0.01em]">
                      Balance:
                    </p>
                    <p className="text-primary-light font-mono text-xs font-bold tracking-[-0.01em]">
                      {visibleBalance}
                    </p>
                    <button
                      type="button"
                      aria-label={
                        isBalanceVisible
                          ? "Hide wallet balance"
                          : "Show wallet balance"
                      }
                      onClick={toggleBalanceVisibility}
                      className="text-hint hover:text-text-sub transition-colors"
                    >
                      {isBalanceVisible ? (
                        <Eye className="size-4" strokeWidth={1.75} />
                      ) : (
                        <EyeOff className="size-4" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex flex-col gap-2 rounded-[12px] bg-[#0D1E30] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-hint text-xs font-medium tracking-[-0.01em]">
                        Amount
                      </p>
                      {!isWithdraw && (
                        <p className="text-hint text-xs font-medium tracking-[-0.01em]">
                          WLD Balance: {displayWldBalance}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <input
                        value={amountInput}
                        onChange={handleAmountInputChange}
                        className="text-hint placeholder:text-hint w-full bg-transparent text-3xl font-bold outline-none"
                        inputMode="decimal"
                        placeholder="0"
                        aria-label="Amount"
                      />
                      <p className="text-text-sub text-lg font-normal tracking-[-0.01em]">
                        {primaryUnit}
                      </p>
                    </div>
                  </div>

                  <div className="border-border-main mt-3 flex flex-col gap-2 rounded-[12px] border px-4 py-3">
                    <p className="text-hint text-xs font-medium tracking-[-0.01em]">
                      Received
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-text-sub text-3xl font-bold tracking-[-0.01em]">
                        {receivedDisplay}
                      </p>
                      <p className="text-text-sub text-lg font-normal tracking-[-0.01em]">
                        {secondaryUnit}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleActionMode}
                    className="bg-background-subtle absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                    aria-label="Swap deposit and withdraw mode"
                  >
                    <ArrowUpDown className="text-primary-light size-4" />
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="button"
                  disabled={isDepositing || isWithdrawing}
                  onClick={handlePrimaryAction}
                  className="bg-primary-light text-text-inverse hover:bg-primary-light/90 h-11 w-full rounded-[8px] border-none text-sm font-medium"
                >
                  {isDepositing
                    ? "Depositing..."
                    : isWithdrawing
                      ? "Withdrawing..."
                      : activeLabel}
                </Button>
              </div>
            </div>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet>
    </>
  );
};

export default WalletActionPanel;
