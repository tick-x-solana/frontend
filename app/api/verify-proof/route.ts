import { NextResponse } from "next/server";
import type { IDKitResult } from "@worldcoin/idkit";

type VerifyProofRequestBody = {
  rp_id?: string;
  idkitResponse?: IDKitResult;
};

function getRequiredEnv(name: "RP_ID") {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { rp_id, idkitResponse } =
      (await request.json()) as VerifyProofRequestBody;

    if (!idkitResponse) {
      return NextResponse.json(
        { error: "Missing idkitResponse" },
        { status: 400 },
      );
    }

    const rpId = rp_id ?? getRequiredEnv("RP_ID");
    if (!rpId) {
      return NextResponse.json({ error: "Missing rp_id" }, { status: 400 });
    }

    const response = await fetch(
      `https://developer.world.org/api/v4/verify/${rpId}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(idkitResponse),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        {
          error: "Verification failed",
          details: errorBody || response.statusText,
        },
        { status: 400 },
      );
    }

    const verifyResponse =
      (await response.json().catch(() => null)) as unknown | null;
    return NextResponse.json({ success: true, verifyResponse });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
