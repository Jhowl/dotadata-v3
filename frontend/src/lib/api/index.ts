import type {
  AppUser,
  Hero,
  League,
  Match,
  Patch,
  PickBanStat,
  Team,
} from "@shared/types/index";
import { api } from "./client";

const ONE_HOUR = 60 * 60;
const SIX_HOURS = ONE_HOUR * 6;
const ONE_DAY = ONE_HOUR * 24;

export type Counts = { leagues: number; teams: number; matches: number; heroes: number };

export type LeagueSummary = {
  leagueId: string;
  totalMatches: number;
  totalTeams: number | null;
  avgDuration: number | null;
  avgScore: number | null;
  radiantWinrate: number | null;
  avgFirstTowerTime: number | null;
  lastMatchTime: string | null;
  minScore: number | null;
  maxScore: number | null;
  minScoreMatchId: string | null;
  maxScoreMatchId: string | null;
  fastestMatchId: string | null;
  fastestMatchDuration: number | null;
  longestMatchId: string | null;
  longestMatchDuration: number | null;
};

export type TeamSummary = LeagueSummary & {
  teamId: string;
  radiantMatches: number | null;
  direMatches: number | null;
  radiantWinrate: number | null;
  direWinrate: number | null;
};

export const apiClient = {
  counts: () => api.get<Counts>("/counts", { revalidate: ONE_DAY }),

  leagues: {
    list: () => api.get<League[]>("/leagues", { revalidate: ONE_DAY }),
    summaries: () => api.get<LeagueSummary[]>("/leagues/summaries", { revalidate: ONE_DAY }),
    lastWinners: () =>
      api.get<Record<string, { teamId: string; matchId: string; startTime: string | null }>>(
        "/leagues/last-winners",
        { revalidate: SIX_HOURS },
      ),
    bySlug: (slug: string) =>
      api.get<League>(`/leagues/${encodeURIComponent(slug)}`, { revalidate: ONE_DAY }),
    summary: (slug: string) =>
      api.get<LeagueSummary | null>(`/leagues/${encodeURIComponent(slug)}/summary`, {
        revalidate: ONE_DAY,
      }),
    matches: (slug: string, all = false) =>
      api.get<Match[]>(`/leagues/${encodeURIComponent(slug)}/matches${all ? "?all=1" : ""}`, {
        revalidate: ONE_HOUR,
      }),
    champion: (slug: string) =>
      api.get<unknown>(`/leagues/${encodeURIComponent(slug)}/champion`, {
        revalidate: SIX_HOURS,
      }),
    participation: (slug: string) =>
      api.get<unknown[]>(`/leagues/${encodeURIComponent(slug)}/participation`, {
        revalidate: SIX_HOURS,
      }),
    pickBan: (slug: string) =>
      api.get<{ mostPicked: PickBanStat[]; mostBanned: PickBanStat[]; mostContested: PickBanStat[] }>(
        `/leagues/${encodeURIComponent(slug)}/pickban`,
        { revalidate: SIX_HOURS },
      ),
    pickBanAnalysis: (slug: string) =>
      api.get<unknown>(`/leagues/${encodeURIComponent(slug)}/pickban/analysis`, {
        revalidate: SIX_HOURS,
      }),
    topPerformers: (slug: string) =>
      api.get<unknown[]>(`/leagues/${encodeURIComponent(slug)}/top-performers`, {
        revalidate: SIX_HOURS,
      }),
  },

  teams: {
    list: () => api.get<Team[]>("/teams", { revalidate: ONE_DAY }),
    summaries: () => api.get<TeamSummary[]>("/teams/summaries", { revalidate: ONE_DAY }),
    bySlug: (slug: string) =>
      api.get<Team>(`/teams/${encodeURIComponent(slug)}`, { revalidate: ONE_DAY }),
    summary: (slug: string) =>
      api.get<TeamSummary | null>(`/teams/${encodeURIComponent(slug)}/summary`, {
        revalidate: ONE_DAY,
      }),
    matches: (slug: string) =>
      api.get<Match[]>(`/teams/${encodeURIComponent(slug)}/matches`, { revalidate: ONE_HOUR }),
    handicap: (slug: string) =>
      api.get<Match[]>(`/teams/${encodeURIComponent(slug)}/handicap`, { revalidate: ONE_HOUR }),
    pickBan: (slug: string) =>
      api.get<{ mostPicked: PickBanStat[]; mostBanned: PickBanStat[]; mostContested: PickBanStat[] }>(
        `/teams/${encodeURIComponent(slug)}/pickban`,
        { revalidate: SIX_HOURS },
      ),
    topPerformers: (slug: string) =>
      api.get<unknown[]>(`/teams/${encodeURIComponent(slug)}/top-performers`, {
        revalidate: SIX_HOURS,
      }),
  },

  patches: {
    list: () =>
      api.get<Array<Patch & { matchCount: number }>>("/patches", { revalidate: ONE_DAY }),
    bySlug: (patch: string) =>
      api.get<Patch>(`/patches/${encodeURIComponent(patch)}`, { revalidate: ONE_DAY }),
    matches: (patch: string) =>
      api.get<Match[]>(`/patches/${encodeURIComponent(patch)}/matches`, {
        revalidate: ONE_HOUR,
      }),
    topPerformers: (patch: string) =>
      api.get<unknown[]>(`/patches/${encodeURIComponent(patch)}/top-performers`, {
        revalidate: SIX_HOURS,
      }),
  },

  heroes: () => api.get<Hero[]>("/heroes", { revalidate: ONE_DAY }),

  players: (ids: Array<string | number>) => {
    const list = ids.map((value) => String(value)).filter(Boolean);
    if (!list.length) return Promise.resolve<Record<string, string>>({});
    return api.get<Record<string, string>>(`/players?ids=${encodeURIComponent(list.join(","))}`, {
      revalidate: ONE_DAY,
    });
  },

  seasons: {
    byYear: (year: number) =>
      api.get<unknown>(`/seasons/${year}`, { revalidate: ONE_DAY }),
    matches: (year: number) =>
      api.get<Match[]>(`/seasons/${year}/matches`, { revalidate: ONE_HOUR }),
  },

  blog: {
    list: () => api.get<unknown[]>("/blog", { revalidate: 300 }),
    bySlug: (slug: string) =>
      api.get<unknown>(`/blog/${encodeURIComponent(slug)}`, { revalidate: 900 }),
  },

  comments: {
    list: (entityType: "league" | "team", entityId: string) =>
      api.get<unknown[]>(
        `/comments?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`,
      ),
    create: (entityType: "league" | "team", entityId: string, body: string) =>
      api.post<unknown>("/comments", { entityType, entityId, body }),
    remove: (id: string) => api.delete<void>(`/comments/${encodeURIComponent(id)}`),
  },

  auth: {
    me: () => api.get<AppUser | null>("/auth/me", { cache: "no-store" }),
    logout: () => api.post<void>("/auth/logout"),
    loginUrl: () => `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/auth/steam/login`,
  },

  contact: (payload: { name: string; email: string; subject: string; message: string; hp?: string }) =>
    api.post<void>("/contact", payload),
};

export type { League, Team, Match, Patch, Hero, PickBanStat, AppUser };
