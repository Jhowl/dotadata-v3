import { NextResponse } from "next/server";

import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { fetchSteamProfile, verifySteamOpenId } from "@/lib/auth/steam";
import { upsertSteamUser } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = (process.env.AUTH_BASE_URL ?? url.origin).replace(/\/$/, "");

  const steamid = await verifySteamOpenId(url.searchParams);
  if (!steamid) {
    return NextResponse.redirect(`${origin}/?auth=failed`);
  }

  const profile = await fetchSteamProfile(steamid);
  await upsertSteamUser({
    steamid,
    personaName: profile?.personaName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    profileUrl: profile?.profileUrl ?? null,
  });

  const token = createSessionToken(steamid);
  await setSessionCookie(token);

  return NextResponse.redirect(`${origin}/`);
}
