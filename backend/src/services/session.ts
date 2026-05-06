import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/config/env.js";

export const SESSION_COOKIE = "dd_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type SessionPayload = { sub: string; exp: number };

const sign = (payload: string) =>
  createHmac("sha256", env.AUTH_SECRET).update(payload).digest("base64url");

export const createSessionToken = (steamid: string): string => {
  const payload: SessionPayload = {
    sub: steamid,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
};

export const verifySessionToken = (token: string): SessionPayload | null => {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;

  const expected = sign(encoded);
  const sigBuf = Buffer.from(signature, "base64url");
  const expectedBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
  } catch {
    return null;
  }
  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp * 1000 < Date.now()) return null;
  return payload;
};

export const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS * 1000,
  domain: env.COOKIE_DOMAIN,
});
