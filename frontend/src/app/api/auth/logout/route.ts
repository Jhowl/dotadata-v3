import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await clearSessionCookie();
  const url = new URL(request.url);
  const origin = (process.env.AUTH_BASE_URL ?? url.origin).replace(/\/$/, "");
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
