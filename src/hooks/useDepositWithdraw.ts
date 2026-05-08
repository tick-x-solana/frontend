"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { toast } from "sonner";
import { SOLANA_PROGRAM_ID } from "@/src/constants";
import { useAuth } from "@/src/components/providers/AuthProvider";
import {
  getAccountControllerGetBalanceQueryKey,
  paymentControllerDebugDeposit,
  paymentControllerDebugFinalizeWithdrawal,
  paymentControllerRequestWithdrawal,
} from "@/src/services/queries";

const PROGRAM_ID = new PublicKey(SOLANA_PROGRAM_ID);

function getConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool-reserve-config")],
    PROGRAM_ID,
  );
}

function getVaultPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool-reserve-vault")],
    PROGRAM_ID,
  );
}

function getTraderPositionPda(trader: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("trader-position"), trader.toBuffer()],
    PROGRAM_ID,
  );
}

// Encode a Borsh instruction: 1-byte discriminant + 8-byte u64 LE amount
// Uses DataView for browser compatibility (Buffer.writeBigUInt64LE is Node-only)
function encodeInstruction(discriminant: number, amount: bigint): Buffer {
  const ab = new ArrayBuffer(9);
  const view = new DataView(ab);
  view.setUint8(0, discriminant);
  view.setBigUint64(1, amount, true); // true = little-endian
  return Buffer.from(ab);
}

function solToLamports(amountSol: number): bigint {
  return BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
}

function parseSolAmount(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return parsed;
}

function extractRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function isUserCancelledRequest(error: unknown): boolean {
  const msg = String(
    error instanceof Error ? error.message : error,
  ).toLowerCase();
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("cancelled") ||
    msg.includes("canceled")
  );
}

function buildAuthHeaders(): HeadersInit | undefined {
  if (typeof window === "undefined") return undefined;
  const token = window.localStorage.getItem("token");
  if (!token) return undefined;
  return { Authorization: `Bearer ${token}` };
}

const useDepositWithdraw = () => {
  const queryClient = useQueryClient();
  const { walletAddress } = useAuth();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const getAvailableSolBalance = useCallback(async () => {
    if (!publicKey) throw new Error("Wallet not connected");
    const lamports = await connection.getBalance(publicKey);
    const sol = lamports / LAMPORTS_PER_SOL;
    return { lamports, sol, formatted: sol.toFixed(6) };
  }, [connection, publicKey]);

  const depositSol = useCallback(
    async ({ amountSol }: { amountSol: string }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const parsedAmount = parseSolAmount(amountSol, "SOL amount");
      const lamports = solToLamports(parsedAmount);

      setIsDepositing(true);

      try {
        const [configPda] = getConfigPda();
        const [vaultPda] = getVaultPda();
        const [traderPositionPda] = getTraderPositionPda(publicKey);

        const data = encodeInstruction(1, lamports);

        const ix = new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: true },
            { pubkey: traderPositionPda, isSigner: false, isWritable: true },
            { pubkey: vaultPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        });

        const tx = new Transaction().add(ix);
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction(signature, "confirmed");

        await paymentControllerDebugDeposit({
          amount: parsedAmount.toString(),
          txHash: signature,
          logIndex: 0,
        });

        await queryClient.invalidateQueries({
          queryKey: getAccountControllerGetBalanceQueryKey(),
        });

        toast.success("Deposit confirmed and balance synced");

        return { signature, amountSol: parsedAmount.toString() };
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
    [connection, publicKey, queryClient, sendTransaction, walletAddress],
  );

  const withdrawSol = useCallback(
    async ({ amountSol }: { amountSol: string }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const parsedAmount = parseSolAmount(amountSol, "SOL amount");
      setIsWithdrawing(true);

      try {
        const authHeaders = buildAuthHeaders();

        const withdrawalResponse = await paymentControllerRequestWithdrawal(
          { amount: parsedAmount.toString() },
          authHeaders
            ? { headers: { ...authHeaders, "Content-Type": "application/json" } }
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

        if (!sessionId || !claimAmount) {
          throw new Error(
            "Withdrawal response missing required parameters (sessionId, claimAmount)",
          );
        }

        const lamports = BigInt(claimAmount);
        const [configPda] = getConfigPda();
        const [vaultPda] = getVaultPda();
        const [traderPositionPda] = getTraderPositionPda(publicKey);

        const data = encodeInstruction(2, lamports);
        const ix = new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: true },
            { pubkey: traderPositionPda, isSigner: false, isWritable: true },
            { pubkey: vaultPda, isSigner: false, isWritable: true },
          ],
          data,
        });

        const tx = new Transaction().add(ix);
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction(signature, "confirmed");

        await paymentControllerDebugFinalizeWithdrawal(
          { sessionId, txHash: signature, logIndex: 0 },
          authHeaders
            ? { headers: { ...authHeaders, "Content-Type": "application/json" } }
            : undefined,
        );

        await queryClient.invalidateQueries({
          queryKey: getAccountControllerGetBalanceQueryKey(),
        });

        toast.success("Withdrawal completed and balance synced");

        return { signature, sessionId, amountSol: parsedAmount.toString() };
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
    [connection, publicKey, queryClient, sendTransaction, walletAddress],
  );

  return {
    isDepositing,
    isWithdrawing,
    getAvailableSolBalance,
    depositSol,
    withdrawSol,
  };
};

export default useDepositWithdraw;
