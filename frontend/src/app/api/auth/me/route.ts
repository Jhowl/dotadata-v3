import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession().catch(() => null);
  return NextResponse.json({ steamid: session?.sub ?? null });
}
