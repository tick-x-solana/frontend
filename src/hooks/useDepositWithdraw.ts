"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MiniKit } from "@worldcoin/minikit-js";
import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { toast } from "sonner";
import { TICK_X_ABI } from "@/src/constants/abi";
import { useAuth } from "@/src/components/providers/AuthProvider";
import {
  getAccountControllerGetBalanceQueryKey,
  paymentControllerDebugDeposit,
  paymentControllerDebugFinalizeWithdrawal,
  paymentControllerRequestWithdrawal,
} from "@/src/services/queries";

const WORLD_CHAIN_ID = 480;
const WORLDCHAIN_RPC_URL = "https://worldchain-mainnet.g.alchemy.com/public";
const WLD_TOKEN_DECIMALS = 18;

const worldPublicClient = createPublicClient({
  transport: http(WORLDCHAIN_RPC_URL),
});

export const TICK_X_POOL_ADDRESS =
  "0x6351b3006aAE72a36006614310928930Ac229d0e" as Address;
export const WLD_TOKEN_ADDRESS =
  "0x8603a12c549007a3afe026efad797640bda30760" as Address;

type DepositWldParams = {
  amountWld: string;
  tokenDecimals?: number;
  poolAddress?: Address;
  tokenAddress?: Address;
};

type WithdrawWldParams = {
  amountWld: string;
};

type GetAvailableWldBalanceParams = {
  tokenAddress?: Address;
  tokenDecimals?: number;
};

type UserOpStatusResponse = {
  status?: string;
  transaction_hash?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimTrailingZeros(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/\.?0+$/, "");
}

function parsePositiveNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number`);
  }

  return parsed;
}

function extractRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function isUserCancelledRequest(error: unknown): boolean {
  const visited = new Set<unknown>();
  const queue: unknown[] = [error];
  const rejectionKeywords = [
    "user rejected",
    "user denied",
    "rejected the request",
    "request rejected",
    "cancelled",
    "canceled",
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }

    visited.add(current);
    const record = current as Record<string, unknown>;
    const message = [
      asOptionalString(record.message),
      asOptionalString(record.shortMessage),
      asOptionalString(record.details),
      asOptionalString(record.reason),
      asOptionalString(record.error_code),
      asOptionalString(record.code),
      asOptionalString(record.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (
      message.includes("4001") ||
      message.includes("action_rejected") ||
      rejectionKeywords.some((keyword) => message.includes(keyword))
    ) {
      return true;
    }

    queue.push(record.cause, record.error, record.data);
  }

  return false;
}

function extractUserOpHash(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const directUserOpHash = record.userOpHash;

  if (
    typeof directUserOpHash === "string" &&
    directUserOpHash.startsWith("0x")
  ) {
    return directUserOpHash;
  }

  if (record.data && typeof record.data === "object") {
    const nestedUserOpHash = extractUserOpHash(record.data);
    if (nestedUserOpHash) {
      return nestedUserOpHash;
    }
  }

  return null;
}

async function fetchWldBalance({
  tokenAddress,
  walletAddress,
  tokenDecimals,
}: {
  tokenAddress: Address;
  walletAddress: Address;
  tokenDecimals: number;
}): Promise<{ raw: bigint; formatted: string }> {
  const rawBalance = (await worldPublicClient.readContract({
    address: tokenAddress,
    abi: [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [walletAddress],
  })) as bigint;

  return {
    raw: rawBalance,
    formatted: formatUnits(rawBalance, tokenDecimals),
  };
}

async function resolveTransactionHash(
  userOpHash: string,
): Promise<Hash | null> {
  try {
    const response = await fetch(
      `https://developer.world.org/api/v2/minikit/userop/${userOpHash}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as UserOpStatusResponse;
    if (
      json.status === "success" &&
      typeof json.transaction_hash === "string"
    ) {
      return json.transaction_hash as Hash;
    }

    return null;
  } catch {
    return null;
  }
}

async function waitForResolvedTransactionHash(
  userOpHash: string,
  attempts = 12,
  delayMs = 2500,
): Promise<Hash | null> {
  for (let i = 0; i < attempts; i += 1) {
    const txHash = await resolveTransactionHash(userOpHash);
    if (txHash) {
      return txHash;
    }
    if (i < attempts - 1) {
      await sleep(delayMs);
    }
  }
  return null;
}

function asOptionalHexHash(value: unknown): Hash | undefined {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value as Hash;
  }
  return undefined;
}

function extractTransactionHash(value: unknown): Hash | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const directHash =
    asOptionalHexHash(record.transactionHash) ??
    asOptionalHexHash(record.transaction_hash) ??
    asOptionalHexHash(record.txHash);
  if (directHash) {
    return directHash;
  }

  if (record.data && typeof record.data === "object") {
    return extractTransactionHash(record.data);
  }

  return null;
}

function buildAuthHeaders(): HeadersInit | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const token = window.localStorage.getItem("token");
  if (!token) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

const useDepositWithdraw = () => {
  const queryClient = useQueryClient();
  const { walletAddress } = useAuth();
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const getAvailableWldBalance = useCallback(
    async ({
      tokenAddress = WLD_TOKEN_ADDRESS,
      tokenDecimals = 18,
    }: GetAvailableWldBalanceParams = {}) => {
      if (!walletAddress) {
        throw new Error("Wallet not connected");
      }

      if (!isAddress(walletAddress)) {
        throw new Error("Invalid wallet address");
      }

      return fetchWldBalance({
        tokenAddress,
        walletAddress,
        tokenDecimals,
      });
    },
    [walletAddress],
  );

  const depositWld = useCallback(
    async ({
      amountWld,
      tokenDecimals = 18,
      poolAddress = TICK_X_POOL_ADDRESS,
      tokenAddress = WLD_TOKEN_ADDRESS,
    }: DepositWldParams) => {
      if (!walletAddress) {
        throw new Error("Wallet not connected");
      }

      if (!isAddress(walletAddress)) {
        throw new Error("Invalid wallet address");
      }

      if (!MiniKit.isInWorldApp()) {
        throw new Error("WLD deposit is only available in World App");
      }

      parsePositiveNumber(amountWld, "WLD amount");

      setIsDepositing(true);

      try {
        const amountWei = parseUnits(amountWld, tokenDecimals);
        const wldBalance = await fetchWldBalance({
          tokenAddress,
          walletAddress,
          tokenDecimals,
        });

        if (wldBalance.raw < amountWei) {
          throw new Error(
            `Insufficient WLD balance. Available: ${trimTrailingZeros(wldBalance.formatted)} WLD`,
          );
        }

        const approveCalldata = encodeFunctionData({
          abi: [
            {
              name: "approve",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "spender", type: "address" },
                { name: "value", type: "uint256" },
              ],
              outputs: [{ name: "", type: "bool" }],
            },
          ],
          functionName: "approve",
          args: [poolAddress, amountWei],
        });

        const depositCalldata = encodeFunctionData({
          abi: TICK_X_ABI.abi,
          functionName: "depositTrader",
          args: [amountWei],
        });

        const txResult = await MiniKit.sendTransaction({
          chainId: WORLD_CHAIN_ID,
          transactions: [
            {
              to: tokenAddress,
              data: approveCalldata,
              value: "0x0",
            },
            {
              to: poolAddress,
              data: depositCalldata,
              value: "0x0",
            },
          ],
        });

        const userOpHash = extractUserOpHash(txResult);
        const finalTxHash = userOpHash
          ? ((await resolveTransactionHash(userOpHash)) ?? userOpHash)
          : undefined;

        await paymentControllerDebugDeposit({
          amount: amountWld,
          txHash: finalTxHash,
        });

        await queryClient.invalidateQueries({
          queryKey: getAccountControllerGetBalanceQueryKey(),
        });

        toast.success("Deposit submitted and backend balance synced");

        return {
          txResult,
          userOpHash,
          txHash: finalTxHash,
          wldAmount: amountWld,
          wldBalance,
        };
      } catch (error) {
        if (isUserCancelledRequest(error)) {
          toast.info("You canceled the request");
        } else {
          console.error("Deposit flow failed", error);
          toast.error("Deposit failed");
        }
        throw error;
      } finally {
        setIsDepositing(false);
      }
    },
    [queryClient, walletAddress],
  );

  const withdrawWld = useCallback(
    async ({ amountWld }: WithdrawWldParams) => {
      const parsedAmountWld = parsePositiveNumber(amountWld, "WLD amount");
      setIsWithdrawing(true);

      try {
        const authHeaders = buildAuthHeaders();
        const requestedAmountWld = trimTrailingZeros(
          parsedAmountWld.toFixed(6),
        );

        const withdrawalResponse = await paymentControllerRequestWithdrawal(
          {
            amount: requestedAmountWld,
          },
          authHeaders
            ? {
                headers: {
                  ...authHeaders,
                  "Content-Type": "application/json",
                },
              }
            : undefined,
        );

        const responseData = extractRecord(withdrawalResponse);
        const nestedData = extractRecord(responseData.data);
        const sessionId =
          asOptionalString(responseData.sessionId) ??
          asOptionalString(nestedData.sessionId);

        const claimAmount =
          asOptionalString(responseData.claimAmount) ??
          asOptionalString(nestedData.claimAmount);
        const deadline =
          asOptionalString(responseData.deadline) ??
          asOptionalString(nestedData.deadline);
        const approvalSignature = (asOptionalString(
          responseData.approvalSignature,
        ) ?? asOptionalString(nestedData.approvalSignature)) as
          | `0x${string}`
          | undefined;

        if (!sessionId || !claimAmount || !deadline || !approvalSignature) {
          throw new Error(
            "Withdrawal response missing required parameters (sessionId, claimAmount, deadline, approvalSignature)",
          );
        }

        const withdrawTokenAmountRaw = BigInt(claimAmount);

        const deadlineBigInt = BigInt(deadline);

        console.log(
          "withdraw contract input withdrawTokenAmountRaw",
          withdrawTokenAmountRaw,
        );
        console.log("withdraw contract input deadlineBigInt", deadlineBigInt);
        console.log("withdraw contract approvalSignature", approvalSignature);

        const claimTraderCalldata = encodeFunctionData({
          abi: [
            {
              type: "function",
              name: "claimTrader",
              stateMutability: "nonpayable",
              inputs: [
                { name: "amount", type: "uint256", internalType: "uint256" },
                { name: "deadline", type: "uint256", internalType: "uint256" },
                {
                  name: "adminSignature",
                  type: "bytes",
                  internalType: "bytes",
                },
              ],
              outputs: [],
            },
          ],
          functionName: "claimTrader",
          args: [withdrawTokenAmountRaw, deadlineBigInt, approvalSignature],
        });

        const txResult = await MiniKit.sendTransaction({
          chainId: WORLD_CHAIN_ID,
          transactions: [
            {
              to: TICK_X_POOL_ADDRESS,
              data: claimTraderCalldata,
              value: "0x0",
            },
          ],
        });

        const userOpHash = extractUserOpHash(txResult);
        const directTxHash = extractTransactionHash(txResult);
        const resolvedTxHashFromUserOp = userOpHash
          ? await waitForResolvedTransactionHash(userOpHash)
          : null;
        const claimTxHash = directTxHash ?? resolvedTxHashFromUserOp;

        if (!claimTxHash) {
          throw new Error(
            "Could not resolve transaction hash for withdrawal claim",
          );
        }

        await worldPublicClient.waitForTransactionReceipt({
          hash: claimTxHash,
        });

        await paymentControllerDebugFinalizeWithdrawal(
          {
            sessionId,
            txHash: `0x${Date.now()}`,
            logIndex: 0,
          },
          authHeaders
            ? {
                headers: {
                  ...authHeaders,
                  "Content-Type": "application/json",
                },
              }
            : undefined,
        );

        await queryClient.invalidateQueries({
          queryKey: getAccountControllerGetBalanceQueryKey(),
        });

        toast.success("Withdrawal completed and backend balance synced");

        return {
          amountWld: trimTrailingZeros(parsedAmountWld.toFixed(6)),
          requestedAmountWld,
          claimAmountWld: trimTrailingZeros(
            formatUnits(withdrawTokenAmountRaw, WLD_TOKEN_DECIMALS),
          ),
          txResult,
          userOpHash,
          txHash: claimTxHash,
        };
      } catch (error) {
        if (isUserCancelledRequest(error)) {
          toast.info("You canceled the request");
        } else {
          console.error("Withdrawal flow failed", error);
          toast.error("Withdrawal failed");
        }
        throw error;
      } finally {
        setIsWithdrawing(false);
      }
    },
    [queryClient],
  );

  return {
    isDepositing,
    isWithdrawing,
    getAvailableWldBalance,
    depositWld,
    withdrawWld,
  };
};

export default useDepositWithdraw;
