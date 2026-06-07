/**
 * @file route.ts
 * @description Acknowledges stale onboarding cleanup requests after an embedded wallet address changes.
 */

import { NextRequest, NextResponse } from "next/server";

interface ClearOnboardingRequestBody {
  oldAddress?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as ClearOnboardingRequestBody | null;
  const oldAddress = body?.oldAddress;

  if (oldAddress && !/^0x[0-9a-fA-F]{40}$/.test(oldAddress)) {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    clearedAddress: oldAddress ?? null,
  });
}
