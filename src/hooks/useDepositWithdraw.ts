"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { toast } from "sonner";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { SOLANA_WRONG_NETWORK_MESSAGE } from "@/src/constants";
import { useSolanaNetworkGuard } from "@/src/hooks/useSolanaNetworkGuard";
import { useSolanaWallet } from "@/src/lib/solana-wallet";
import {
  getAccountControllerGetBalanceQueryKey,
  paymentControllerDebugDeposit,
  paymentControllerDebugFinalizeWithdrawal,
  paymentControllerRequestWithdrawal,
} from "@/src/services/queries";
import {
  SOLANA_RPC_ENDPOINT,
  SOLANA_TX_EXPLORER_BASE_URL,
  TICKX_SOLANA_PROGRAM_ID,
} from "@/src/constants/solana";

type DepositSolParams = {
  amountSol: string;
};

type WithdrawSolParams = {
  amountSol: string;
};

function parsePositiveNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return parsed;
}

function encodeInstructionData(discriminant: number, amountLamports: bigint) {
  const ab = new ArrayBuffer(9);
  const view = new DataView(ab);
  view.setUint8(0, discriminant);
  view.setBigUint64(1, amountLamports, true);
  return Buffer.from(ab);
}

function extractSessionId(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const direct = record.sessionId ?? record.id;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  if (record.data && typeof record.data === "object") {
    return extractSessionId(record.data);
  }

  return null;
}

function getConnection() {
  return new Connection(SOLANA_RPC_ENDPOINT, "confirmed");
}

function toLamports(amountSol: number): bigint {
  return BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
}

async function sendProgramTx({
  wallet,
  amountLamports,
  instructionDiscriminant,
}: {
  wallet: ReturnType<typeof useSolanaWallet>;
  amountLamports: bigint;
  instructionDiscriminant: number;
}) {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const connection = getConnection();
  const trader = new PublicKey(wallet.publicKey);
  const programId = new PublicKey(TICKX_SOLANA_PROGRAM_ID);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool-reserve-config")],
    programId,
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool-reserve-vault")],
    programId,
  );
  const [traderPositionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("trader-position"), trader.toBuffer()],
    programId,
  );

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: trader, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: traderPositionPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeInstructionData(instructionDiscriminant, amountLamports),
  });

  const latest = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: trader,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }).add(instruction);

  if (!wallet.signTransaction) {
    throw new Error("Wallet does not support signTransaction");
  }
  const signedTx = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
  });

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed",
  );

  return signature;
}

const useDepositWithdraw = () => {
  const queryClient = useQueryClient();
  const { walletAddress } = useAuth();
  const wallet = useSolanaWallet();
  const { canSubmitTransactions } = useSolanaNetworkGuard();
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const getAvailableSolBalance = useCallback(async () => {
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }

    const connection = getConnection();
    const rawBalance = await connection.getBalance(new PublicKey(walletAddress));
    return {
      raw: BigInt(rawBalance),
      formatted: (rawBalance / LAMPORTS_PER_SOL).toString(),
    };
  }, [walletAddress]);

  const depositSol = useCallback(
    async ({ amountSol }: DepositSolParams) => {
      if (!walletAddress) {
        throw new Error("Wallet not connected");
      }
      if (!canSubmitTransactions) {
        throw new Error(SOLANA_WRONG_NETWORK_MESSAGE);
      }

      setIsDepositing(true);
      try {
        const parsedAmount = parsePositiveNumber(amountSol, "SOL amount");
        const amountLamports = toLamports(parsedAmount);

        const signature = await sendProgramTx({
          wallet,
          amountLamports,
          instructionDiscriminant: 1,
        });

        await paymentControllerDebugDeposit(
          {
            amount: amountSol,
            txHash: signature,
            logIndex: 0,
          },
          {
            headers: { Authorization: `Bearer ${window.localStorage.getItem("token") ?? ""}` },
          },
        );

        await queryClient.invalidateQueries({
          queryKey: getAccountControllerGetBalanceQueryKey(),
        });

        const txUrl = `${SOLANA_TX_EXPLORER_BASE_URL}/${signature}?cluster=devnet`;
        toast.success("Deposit success", {
          action: {
            label: "View tx",
            onClick: () => window.open(txUrl, "_blank", "noopener,noreferrer"),
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to complete deposit";
        toast.error(message);
        throw error;
      } finally {
        setIsDepositing(false);
      }
    },
    [canSubmitTransactions, queryClient, wallet, walletAddress],
  );

  const withdrawSol = useCallback(
    async ({ amountSol }: WithdrawSolParams) => {
      if (!walletAddress) {
        throw new Error("Wallet not connected");
      }
      if (!canSubmitTransactions) {
        throw new Error(SOLANA_WRONG_NETWORK_MESSAGE);
      }

      setIsWithdrawing(true);
      try {
        parsePositiveNumber(amountSol, "SOL amount");

        const withdrawalResponse = await paymentControllerRequestWithdrawal(
          { amount: amountSol },
          {
            headers: { Authorization: `Bearer ${window.localStorage.getItem("token") ?? ""}` },
          },
        );
        const sessionId = extractSessionId(withdrawalResponse);
        if (!sessionId) {
          throw new Error("Missing sessionId in withdrawal response");
        }

        const signature = await sendProgramTx({
          wallet,
          amountLamports: toLamports(Number(amountSol)),
          instructionDiscriminant: 2,
        });

        await paymentControllerDebugFinalizeWithdrawal(
          {
            sessionId,
            txHash: signature,
            logIndex: 0,
          },
          {
            headers: { Authorization: `Bearer ${window.localStorage.getItem("token") ?? ""}` },
          },
        );

        await queryClient.invalidateQueries({
          queryKey: getAccountControllerGetBalanceQueryKey(),
        });

        const txUrl = `${SOLANA_TX_EXPLORER_BASE_URL}/${signature}?cluster=devnet`;
        toast.success("Withdrawal completed", {
          action: {
            label: "View tx",
            onClick: () => window.open(txUrl, "_blank", "noopener,noreferrer"),
          },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to complete withdrawal";
        toast.error(message);
        throw error;
      } finally {
        setIsWithdrawing(false);
      }
    },
    [canSubmitTransactions, queryClient, wallet, walletAddress],
  );

  return {
    isDepositing,
    isWithdrawing,
    getAvailableSolBalance,
    depositSol,
    withdrawSol,
    // backward-compatible aliases during migration
    getAvailableWldBalance: getAvailableSolBalance,
    depositWld: ({ amountWld }: { amountWld: string }) =>
      depositSol({ amountSol: amountWld }),
    withdrawWld: ({ amountWld }: { amountWld: string }) =>
      withdrawSol({ amountSol: amountWld }),
  };
};

export default useDepositWithdraw;
