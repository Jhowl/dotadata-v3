import { NextResponse } from "next/server";

import { buildSteamLoginUrl } from "@/lib/auth/steam";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = (process.env.AUTH_BASE_URL ?? url.origin).replace(/\/$/, "");
  return NextResponse.redirect(buildSteamLoginUrl(origin));
}
