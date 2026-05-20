import type { Request, Response } from "express";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/services/session.js";
import {
  buildSteamLoginUrl,
  fetchSteamProfile,
  verifySteamOpenId,
} from "@/services/steam.js";
import { getUserBySteamid, upsertSteamUser } from "@/models/users.js";
import { env } from "@/config/env.js";
import { logger } from "@/services/logger.js";

export const authController = {
  login: (_req: Request, res: Response) => {
    res.redirect(buildSteamLoginUrl());
  },

  callback: async (req: Request, res: Response) => {
    const params = new URLSearchParams(req.url.split("?")[1] ?? "");
    const steamid = await verifySteamOpenId(params);
    if (!steamid) {
      res.redirect(`${env.FRONTEND_ORIGIN}/?auth_error=invalid`);
      return;
    }

    const profile = await fetchSteamProfile(steamid);
    await upsertSteamUser({
      steamid,
      personaName: profile?.personaName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      profileUrl: profile?.profileUrl ?? null,
    });

    const token = createSessionToken(steamid);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    res.redirect(env.FRONTEND_ORIGIN);
  },

  me: async (req: Request, res: Response) => {
    if (!req.user) {
      res.json(null);
      return;
    }
    const user = await getUserBySteamid(req.user.steamid);
    if (user) {
      res.json(user);
      return;
    }
    // Session cookie is valid but no DB row was found. This happens when the
    // `users` table is missing, RLS blocks the read, or the callback's upsert
    // silently failed. Returning null here would look identical to "not
    // logged in" to the frontend, so fall back to a session-derived stub
    // and log the miss so the underlying DB issue is visible in prod logs.
    logger.warn({ steamid: req.user.steamid }, "auth.me: session valid but users row missing");
    res.json({
      steamid64: req.user.steamid,
      personaName: null,
      avatarUrl: null,
      profileUrl: null,
    });
  },

  logout: (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: 0 });
    res.status(204).end();
  },
};
