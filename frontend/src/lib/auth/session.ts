import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "dd_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type SessionPayload = { sub: string; exp: number };

const getSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a value at least 32 characters long.");
  }
  return secret;
};

const sign = (payload: string) =>
  createHmac("sha256", getSecret()).update(payload).digest("base64url");

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

  let expected: string;
  try {
    expected = sign(encoded);
  } catch {
    return null;
  }

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

export const setSessionCookie = async (token: string) => {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
};

export const clearSessionCookie = async () => {
  const store = await cookies();
  store.delete(COOKIE_NAME);
};

export const getSession = async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
};
