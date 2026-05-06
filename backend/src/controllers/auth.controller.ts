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
    res.json(user);
  },

  logout: (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: 0 });
    res.status(204).end();
  },
};
