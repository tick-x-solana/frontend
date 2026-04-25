import { NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit-core/signing";

type RpSignatureRequestBody = {
  action?: string;
};

function getRequiredEnv(name: "RP_ID" | "RP_SIGNING_KEY") {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { action } = (await request.json()) as RpSignatureRequestBody;
    if (!action || action.trim().length === 0) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    const signingKeyHex = getRequiredEnv("RP_SIGNING_KEY");
    const rpId = getRequiredEnv("RP_ID");

    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex,
      action,
    });

    return NextResponse.json({
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
      rp_id: rpId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate signature";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
