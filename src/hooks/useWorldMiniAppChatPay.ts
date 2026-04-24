"use client";

import { useCallback, useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { Tokens, tokenToDecimals } from "@worldcoin/minikit-js/commands";

const WORLD_MINI_APP_BASE_URL = "https://worldcoin.org/mini-app";
const WORLD_CHAT_APP_ID = "app_e293fcd0565f45ca296aa317212d8741";

type DraftActionValue = boolean | "true" | number | string;

export type WorldChatDraftOptions = {
  username: string;
  message?: string;
  pay?: DraftActionValue;
  request?: DraftActionValue;
};

export type SendWldPaymentOptions = {
  to: string;
  amountWld: number;
  description: string;
  reference?: string;
  fallback?: () => unknown;
};

type UseWorldMiniAppChatPayConfig = {
  onOpenUrl?: (url: string) => void;
  createPaymentReference?: () => Promise<string> | string;
};

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function normalizeWorldUsername(value: string) {
  return value.trim().replace(/^@/, "");
}

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
  return `${WORLD_MINI_APP_BASE_URL}?app_id=${WORLD_CHAT_APP_ID}&path=${encodedPath}`;
}

const useWorldMiniAppChatPay = (config?: UseWorldMiniAppChatPayConfig) => {
  const [isPaying, setIsPaying] = useState(false);

  const openWorldChatDraft = useCallback(
    (options: WorldChatDraftOptions) => {
      console.log("[useWorldMiniAppChatPay] Step 1: build World Chat draft URL", {
        options,
      });
      const url = getWorldChatDeeplinkUrl(options);
      console.log("[useWorldMiniAppChatPay] Step 2: draft URL created", { url });

      if (config?.onOpenUrl) {
        console.log(
          "[useWorldMiniAppChatPay] Step 3: open via custom onOpenUrl handler",
        );
        config.onOpenUrl(url);
      } else if (typeof window !== "undefined") {
        console.log(
          "[useWorldMiniAppChatPay] Step 3: navigating browser to draft URL",
        );
        window.location.assign(url);
      } else {
        console.log(
          "[useWorldMiniAppChatPay] Step 3: skipped navigation (window unavailable)",
        );
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
      console.log("[useWorldMiniAppChatPay] payWld called", {
        to,
        amountWld,
        description,
      });

      if (!Number.isFinite(amountWld) || amountWld <= 0) {
        console.log("[useWorldMiniAppChatPay] Step 0 failed: invalid amount", {
          amountWld,
        });
        throw new Error("amountWld must be a positive number");
      }

      const recipient = to.trim();
      console.log("[useWorldMiniAppChatPay] Step 1: normalize recipient", {
        recipient,
      });
      if (!EVM_ADDRESS_REGEX.test(recipient)) {
        const username = normalizeWorldUsername(recipient);
        console.log(
          "[useWorldMiniAppChatPay] Step 2: recipient is username, opening World Chat pay draft",
          { username, amountWld },
        );
        console.log("[useWorldMiniAppChatPay] World App environment check", {
          isInWorldApp: MiniKit.isInWorldApp(),
        });
        if (!username) {
          throw new Error("Valid username or wallet address is required");
        }
        return openWorldChatPayDraft(username, amountWld);
      }

      console.log(
        "[useWorldMiniAppChatPay] Step 2: recipient is EVM address, using MiniKit.pay",
      );
      if (!MiniKit.isInWorldApp()) {
        console.log(
          "[useWorldMiniAppChatPay] Step 3 failed: MiniKit.pay requires World App",
        );
        throw new Error(
          "WLD payments with MiniKit.pay are only available in World App",
        );
      }

      console.log("[useWorldMiniAppChatPay] Step 3: set paying state true");
      setIsPaying(true);

      try {
        console.log("[useWorldMiniAppChatPay] Step 4: resolve payment reference");
        const resolvedReference =
          reference ??
          (config?.createPaymentReference
            ? await config.createPaymentReference()
            : crypto.randomUUID());
        console.log("[useWorldMiniAppChatPay] Step 4 done", {
          resolvedReference,
        });

        const tokenAmount = tokenToDecimals(amountWld, Tokens.WLD).toString();
        console.log("[useWorldMiniAppChatPay] Step 5: convert amount to token decimals", {
          tokenAmount,
        });

        console.log("[useWorldMiniAppChatPay] Step 6: call MiniKit.pay");
        const result = await MiniKit.pay({
          reference: resolvedReference,
          to: recipient,
          tokens: [{ symbol: Tokens.WLD, token_amount: tokenAmount }],
          description,
          fallback,
        });
        console.log("[useWorldMiniAppChatPay] Step 7: MiniKit.pay completed", {
          result,
        });
        return result;
      } finally {
        console.log("[useWorldMiniAppChatPay] Step 8: set paying state false");
        setIsPaying(false);
      }
    },
    [config, openWorldChatPayDraft],
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
