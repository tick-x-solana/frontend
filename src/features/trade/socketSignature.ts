"use client";

import CryptoJS from "crypto-js";

function normalizeHexKey(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

export async function signWssMessage(
  wssKey: string,
  message: string,
  challenge?: string,
): Promise<string> {
  const payload = challenge ? `${message}${challenge}` : message;
  const hmac = CryptoJS.algo.HMAC.create(
    CryptoJS.algo.SHA256,
    CryptoJS.enc.Hex.parse(normalizeHexKey(wssKey)),
  );
  hmac.update(payload);
  return hmac.finalize().toString(CryptoJS.enc.Hex);
}
