"use client";

import { bytesToHex, hexToBytes, stringToBytes } from "viem";

function normalizeHexKey(value: string): `0x${string}` {
  return value.startsWith("0x") ? (value as `0x${string}`) : `0x${value}`;
}

export async function signWssMessage(
  wssKey: string,
  message: string,
  challenge?: string,
): Promise<string> {
  const rawKey = Uint8Array.from(hexToBytes(normalizeHexKey(wssKey)));
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const payload = challenge ? `${message}${challenge}` : message;
  const payloadBytes = Uint8Array.from(stringToBytes(payload));
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    payloadBytes,
  );

  return bytesToHex(new Uint8Array(signature)).slice(2);
}
