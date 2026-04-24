"use client";

import { useCallback, useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { Tokens, tokenToDecimals } from "@worldcoin/minikit-js/commands";

const WORLD_CHAT_APP_ID = "app_e293fcd0565f45ca296aa317212d8741";

type DraftActionValue = boolean | "true" | number | string;

export type WorldChatDraftOptions = {
  username: string;
  message?: string;
  pay?: DraftActionValue;
  request?: DraftActionValue;
};

export type SendWldPaymentOptions = {
  to: `0x${string}` | string;
  amountWld: number;
  description: string;
  reference?: string;
  fallback?: () => unknown;
};

type UseWorldMiniAppChatPayConfig = {
  onOpenUrl?: (url: string) => void;
  createPaymentReference?: () => Promise<string> | string;
};

function assertSingleQuickAction({
  message,
  pay,
  request,
}: WorldChatDraftOptions) {
  const actionCount =
    Number(Boolean(message)) +
    Number(pay !== undefined) +
    Number(request !== undefined);

  if (actionCount > 1) {
    throw new Error("Use only one quick action: message, pay, or request");
  }
}

function actionValueToQueryParam(
  key: "pay" | "request",
  value: DraftActionValue,
) {
  if (value === true || value === "true") return key;
  return `${key}=${encodeURIComponent(String(value))}`;
}

export function getWorldChatDeeplinkUrl({
  username,
  message,
  pay,
  request,
}: WorldChatDraftOptions) {
  if (!username || username.trim().length === 0) {
    throw new Error("username is required");
  }

  assertSingleQuickAction({ username, message, pay, request });

  let path = `/${username}/draft`;

  if (message) {
    path += `?message=${encodeURIComponent(message)}`;
  } else if (pay !== undefined) {
    path += `?${actionValueToQueryParam("pay", pay)}`;
  } else if (request !== undefined) {
    path += `?${actionValueToQueryParam("request", request)}`;
  }

  const encodedPath = encodeURIComponent(path);
  return `https://worldcoin.org/mini-app?app_id=${WORLD_CHAT_APP_ID}&path=${encodedPath}`;
}

const useWorldMiniAppChatPay = (config?: UseWorldMiniAppChatPayConfig) => {
  const [isPaying, setIsPaying] = useState(false);

  const openWorldChatDraft = useCallback(
    (options: WorldChatDraftOptions) => {
      const url = getWorldChatDeeplinkUrl(options);

      if (config?.onOpenUrl) {
        config.onOpenUrl(url);
      } else if (typeof window !== "undefined") {
        window.location.assign(url);
      }

      return url;
    },
    [config],
  );

  const openWorldChatMessage = useCallback(
    (username: string, message: string) =>
      openWorldChatDraft({ username, message }),
    [openWorldChatDraft],
  );

  const openWorldChatPayDraft = useCallback(
    (username: string, pay?: DraftActionValue) =>
      openWorldChatDraft({
        username,
        pay: pay ?? true,
      }),
    [openWorldChatDraft],
  );

  const openWorldChatRequestDraft = useCallback(
    (username: string, request?: DraftActionValue) =>
      openWorldChatDraft({
        username,
        request: request ?? true,
      }),
    [openWorldChatDraft],
  );

  const payWld = useCallback(
    async ({
      to,
      amountWld,
      description,
      reference,
      fallback,
    }: SendWldPaymentOptions) => {
      if (!MiniKit.isInWorldApp()) {
        throw new Error("WLD payments with MiniKit.pay are only available in World App");
      }

      if (!Number.isFinite(amountWld) || amountWld <= 0) {
        throw new Error("amountWld must be a positive number");
      }

      setIsPaying(true);

      try {
        const resolvedReference =
          reference ??
          (config?.createPaymentReference
            ? await config.createPaymentReference()
            : crypto.randomUUID());

        const tokenAmount = tokenToDecimals(amountWld, Tokens.WLD).toString();

        return await MiniKit.pay({
          reference: resolvedReference,
          to,
          tokens: [{ symbol: Tokens.WLD, token_amount: tokenAmount }],
          description,
          fallback,
        });
      } finally {
        setIsPaying(false);
      }
    },
    [config],
  );

  return {
    isPaying,
    isInWorldApp: MiniKit.isInWorldApp(),
    getWorldChatDeeplinkUrl,
    openWorldChatDraft,
    openWorldChatMessage,
    openWorldChatPayDraft,
    openWorldChatRequestDraft,
    payWld,
  };
};

export default useWorldMiniAppChatPay;
