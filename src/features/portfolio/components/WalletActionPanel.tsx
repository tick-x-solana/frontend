"use client";

import { WalletIcon } from "@/src/assets/icons";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Button } from "@/src/components/shadcn/button";
import { useGameStore } from "@/src/features/trade/store";
import useDepositWithdraw from "@/src/hooks/useDepositWithdraw";
import { useAccountControllerGetBalance } from "@/src/services/queries";
import { formatWalletAddress } from "@/src/utils/formatters";
import { Eye, EyeOff, LogOut, X } from "lucide-react";
import Image from "next/image";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { toast } from "sonner";

type PortfolioAction = "withdraw" | "deposit";

function extractBalance(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (!value || typeof value !== "object") return null;
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
  if (decimalParts.length === 0) return integerPart;
  return `${integerPart}.${decimalParts.join("")}`;
}

const WalletActionPanel = () => {
  const [activeAction, setActiveAction] = useState<PortfolioAction | null>(
    null,
  );
  const [amountInput, setAmountInput] = useState("");
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [availableSolBalance, setAvailableSolBalance] = useState<string | null>(
    null,
  );
  const { walletAddress, logout, isAuthenticated } = useAuth();
  const { publicKey } = useWallet();
  const storeBalance = useGameStore((state) => state.balance);
  const { data: balanceResponse, refetch: refetchBalance } =
    useAccountControllerGetBalance({
      query: { enabled: Boolean(walletAddress) },
    });

  const {
    isDepositing,
    isWithdrawing,
    getAvailableSolBalance,
    depositSol,
    withdrawSol,
  } = useDepositWithdraw();

  const isWithdraw = activeAction === "withdraw";

  const normalizedAmountInput = useMemo(
    () => normalizeDecimalInput(amountInput),
    [amountInput],
  );
  const numericAmount = Number(normalizedAmountInput || "0");

  const displayWalletAddress = formatWalletAddress(
    walletAddress ?? publicKey?.toBase58(),
  );

  const numericAppBalance = useMemo(() => {
    const apiBalance = extractBalance(balanceResponse);
    const resolved = apiBalance ?? storeBalance;
    return Number.isFinite(resolved) ? (resolved as number) : 0;
  }, [balanceResponse, storeBalance]);

  const displayBalance = useMemo(() => {
    if (!Number.isFinite(numericAppBalance)) return "0";
    return numericAppBalance.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  }, [numericAppBalance]);

  const visibleBalance = isBalanceVisible ? displayBalance : "******";

  const toggleBalanceVisibility = useCallback(() => {
    setIsBalanceVisible((current) => !current);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const displaySolBalance = useMemo(() => {
    if (availableSolBalance === null) return "Loading...";
    const numeric = Number(availableSolBalance);
    return Number.isFinite(numeric)
      ? numeric.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 4,
        })
      : availableSolBalance;
  }, [availableSolBalance]);

  useEffect(() => {
    if (activeAction !== "deposit") return;
    void getAvailableSolBalance()
      .then((b) => setAvailableSolBalance(b.formatted))
      .catch(() => setAvailableSolBalance(null));
  }, [activeAction, getAvailableSolBalance]);

  const openActionSheet = useCallback(
    (action: PortfolioAction) => {
      setActiveAction(action);
      setAmountInput("");
      void getAvailableSolBalance()
        .then((b) => setAvailableSolBalance(b.formatted))
        .catch(() => setAvailableSolBalance(null));
    },
    [getAvailableSolBalance],
  );

  const closeActionSheet = useCallback(() => {
    setActiveAction(null);
  }, []);

  const handleAmountInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setAmountInput(normalizeDecimalInput(event.target.value));
    },
    [],
  );

  const handlePrimaryAction = useCallback(async () => {
    if (!activeAction) return;

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a valid SOL amount");
      return;
    }

    if (activeAction === "withdraw") {
      if (numericAmount > numericAppBalance) {
        toast.error(
          `Insufficient app balance. Available: ${numericAppBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`,
        );
        return;
      }
      try {
        await withdrawSol({ amountSol: normalizedAmountInput.trim() });
        await refetchBalance();
        const b = await getAvailableSolBalance();
        setAvailableSolBalance(b.formatted);
        setAmountInput("");
        closeActionSheet();
      } catch (error) {
        console.error("Withdrawal action failed", error);
      }
      return;
    }

    const walletSol =
      availableSolBalance !== null ? Number(availableSolBalance) : null;
    if (walletSol !== null && numericAmount > walletSol) {
      toast.error(
        `Insufficient wallet balance. Available: ${walletSol.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL`,
      );
      return;
    }

    try {
      await depositSol({ amountSol: normalizedAmountInput.trim() });
      await refetchBalance();
      const b = await getAvailableSolBalance();
      setAvailableSolBalance(b.formatted);
      setAmountInput("");
      closeActionSheet();
    } catch (error) {
      console.error("Deposit action failed", error);
    }
  }, [
    activeAction,
    availableSolBalance,
    closeActionSheet,
    depositSol,
    getAvailableSolBalance,
    numericAmount,
    numericAppBalance,
    normalizedAmountInput,
    refetchBalance,
    withdrawSol,
  ]);

  if (!isAuthenticated) {
    return (
      <div className="border-border-main flex flex-col items-center gap-4 rounded-[8px] border p-4">
        <WalletIcon className="text-hint size-8" aria-hidden="true" />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-text-main text-sm font-semibold tracking-[-0.01em]">
            Connect your wallet
          </p>
          <p className="text-hint text-xs font-medium tracking-[-0.01em]">
            Connect a Solana wallet to view your balance and manage funds.
          </p>
        </div>
        <WalletMultiButton
          style={{
            width: "100%",
            height: "40px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            justifyContent: "center",
          }}
        />
      </div>
    );
  }

  return (
    <>
      <div className="border-border-main bg-background-surface flex flex-col gap-3 rounded-[12px] border p-3">
        {/* Wallet info row */}
        <div className="flex items-center gap-2.5">
          <div className="bg-background-subtle text-primary-light flex size-10 shrink-0 items-center justify-center rounded-[10px]">
            <WalletIcon className="size-5" aria-hidden="true" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center justify-between gap-1">
              <p className="text-text-main truncate text-sm font-semibold tracking-[-0.01em]">
                {displayWalletAddress}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="Log out"
                className="text-hint hover:text-text-main hover:bg-background-subtle/80 size-7 shrink-0 rounded-[6px]"
              >
                <LogOut className="size-3.5" strokeWidth={1.75} />
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <p className="text-hint text-[11px] font-medium">Balance:</p>
              <p className="text-primary-light flex items-center gap-1 font-mono text-[13px] font-bold tracking-[-0.01em]">
                {visibleBalance}
                {isBalanceVisible && (
                  <Image
                    src="/sol.png"
                    alt="SOL"
                    width={12}
                    height={12}
                    className="size-3"
                  />
                )}
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
                  <Eye className="size-3.5" strokeWidth={1.75} />
                ) : (
                  <EyeOff className="size-3.5" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-border-main border-t" />

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className="bg-primary-light text-text-inverse hover:bg-primary-light/90 h-9 rounded-[8px] border-none text-sm font-medium"
            onClick={() => openActionSheet("withdraw")}
          >
            Withdraw
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-primary-light text-primary-light hover:bg-surface-overlay-subtle hover:text-primary-light h-9 rounded-[8px] bg-transparent text-sm font-medium"
            onClick={() => openActionSheet("deposit")}
          >
            Deposit
          </Button>
        </div>
      </div>

      {activeAction !== null && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={closeActionSheet}
        >
          <div
            className="border-border-main bg-background-surface relative w-full max-w-[420px] rounded-[20px] border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: tabs + close button */}
            <div className="border-border-main flex items-center gap-3 border-b px-4 pt-4 pb-4">
              <div className="bg-background-main grid flex-1 grid-cols-2 rounded-[10px] p-1">
                {(["deposit", "withdraw"] as PortfolioAction[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setActiveAction(tab);
                      setAmountInput("");
                    }}
                    className={`rounded-[8px] py-2 text-sm font-semibold capitalize transition-all ${
                      activeAction === tab
                        ? "bg-background-surface text-text-main shadow-sm"
                        : "text-hint hover:text-text-sub"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="text-hint hover:text-text-main shrink-0 transition-colors"
                onClick={closeActionSheet}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-5">
              {/* Balance info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-hint text-xs font-medium">
                    App Balance:
                  </span>
                  <span className="text-text-main flex items-center gap-1 font-mono text-sm font-bold">
                    {visibleBalance}
                    {isBalanceVisible && (
                      <Image
                        src="/sol.png"
                        alt="SOL"
                        width={13}
                        height={13}
                        className="size-[13px]"
                      />
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label={
                      isBalanceVisible ? "Hide balance" : "Show balance"
                    }
                    onClick={toggleBalanceVisibility}
                    className="text-hint hover:text-text-sub transition-colors"
                  >
                    {isBalanceVisible ? (
                      <Eye className="size-3.5" strokeWidth={1.75} />
                    ) : (
                      <EyeOff className="size-3.5" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
                {!isWithdraw && availableSolBalance !== null && (
                  <span className="text-hint text-xs font-medium">
                    Wallet:{" "}
                    <span className="text-text-sub font-semibold">
                      {displaySolBalance} SOL
                    </span>
                  </span>
                )}
              </div>

              {/* Amount input box */}
              <div className="border-border-main bg-background-main rounded-[14px] border px-4 py-4">
                <p className="text-hint mb-2 text-[11px] font-medium tracking-[0.04em] uppercase">
                  Amount
                </p>
                <div className="flex items-center gap-3">
                  <input
                    value={amountInput}
                    onChange={handleAmountInputChange}
                    className="text-text-main placeholder:text-hint/40 min-w-0 flex-1 bg-transparent text-4xl font-bold outline-none"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label="Amount"
                    autoFocus
                  />
                  <div className="flex shrink-0 items-center gap-1.5 rounded-[8px] bg-white/5 px-3 py-1.5">
                    <Image
                      src="/sol.png"
                      alt="SOL"
                      width={18}
                      height={18}
                      className="size-[18px]"
                    />
                    <span className="text-text-main text-sm font-semibold">
                      SOL
                    </span>
                  </div>
                </div>
              </div>

              {/* Devnet notice */}
              {activeAction === "deposit" && (
                <p className="text-hint text-[11px] font-medium">
                  This demo uses Solana Devnet SOL. Use a devnet faucet to get
                  test SOL before depositing.
                </p>
              )}

              {/* Action button */}
              {(() => {
                const isInsufficientDeposit =
                  activeAction === "deposit" &&
                  availableSolBalance !== null &&
                  numericAmount > 0 &&
                  numericAmount > Number(availableSolBalance);
                const isInsufficientWithdraw =
                  activeAction === "withdraw" &&
                  numericAmount > 0 &&
                  numericAmount > numericAppBalance;
                const isDisabled =
                  isDepositing ||
                  isWithdrawing ||
                  numericAmount <= 0 ||
                  isInsufficientDeposit ||
                  isInsufficientWithdraw;

                const label = isDepositing
                  ? "Depositing..."
                  : isWithdrawing
                    ? "Withdrawing..."
                    : isInsufficientDeposit || isInsufficientWithdraw
                      ? "Insufficient Balance"
                      : numericAmount <= 0
                        ? activeAction === "deposit"
                          ? "Enter Amount"
                          : "Enter Amount"
                        : activeAction === "deposit"
                          ? "Deposit SOL"
                          : "Withdraw SOL";

                return (
                  <Button
                    type="button"
                    disabled={isDisabled}
                    onClick={handlePrimaryAction}
                    className="bg-primary-light text-background-main hover:bg-primary-light/90 h-11 w-full rounded-[10px] border-none text-sm font-semibold disabled:opacity-40"
                  >
                    {label}
                  </Button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WalletActionPanel;
