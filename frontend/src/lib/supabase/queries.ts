import { apiFetch } from "@/lib/api/client";
import type {
  Hero,
  League,
  Match,
  Patch,
  PickBanStat,
  Team,
} from "@shared/types/index";

const ONE_HOUR = 60 * 60;
const SIX_HOURS = ONE_HOUR * 6;
const ONE_DAY = ONE_HOUR * 24;

// ── Type re-exports + extras ─────────────────────────────────────────────────

export type PatchWithCount = Patch & { matchCount: number };

export type TopPerformer = {
  matchId: string;
  heroId: string | null;
  teamId: string | null;
  accountId: string | null;
  statValue: number;
  kills: number;
  deaths: number;
  assists: number;
};

export type TopPerformerStat = {
  key: string;
  title: string;
  performer: TopPerformer | null;
};

export type LeagueTeamParticipation = {
  teamId: string;
  matchCount: number;
  wins: number;
  winrate: number;
  mostPickedHeroId: string | null;
  mostPickedTotal: number;
};

export type LeagueChampionPlayer = {
  accountId: string | null;
  heroId: string | null;
  kills: number;
  deaths: number;
  assists: number;
};

export type LeagueChampion = {
  leagueId: string;
  winnerTeamId: string;
  runnerUpTeamId: string | null;
  winnerWins: number;
  runnerUpWins: number;
  seriesId: string | null;
  seriesType: string | null;
  finalMatchId: string;
  finalMatchStartTime: string | null;
  roster: LeagueChampionPlayer[];
};

export type LeagueLastWinner = {
  teamId: string;
  matchId: string;
  startTime: string | null;
};

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

export type TeamSummary = {
  teamId: string;
  totalMatches: number;
  avgDuration: number | null;
  avgScore: number | null;
  avgFirstTowerTime: number | null;
  radiantMatches: number | null;
  direMatches: number | null;
  radiantWinrate: number | null;
  direWinrate: number | null;
  lastMatchTime: string | null;
  minScore: number | null;
  maxScore: number | null;
  minScoreMatchId: string | null;
  maxScoreMatchId: string | null;
  fastestMatchId: string | null;
  fastestMatchDuration: number | null;
  longestMatchId: string | null;
  longestMatchDuration: number | null;
  leagues?: Array<{
    id: string;
    name: string;
    slug: string;
    matchCount: number;
    radiantWinrate: number;
    direWinrate: number;
    overallWinrate: number;
    lastMatchTime: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
};

export type SeasonSnapshot = {
  year: number;
  totals: {
    totalMatches: number;
    avgDuration: number;
    avgScore: number;
    avgFirstTowerTime: number | null;
    radiantWinRate: number;
    minScore: number;
    maxScore: number;
    minScoreMatchId: string | null;
    maxScoreMatchId: string | null;
    fastestMatchId: string | null;
    fastestMatchDuration: number | null;
    longestMatchId: string | null;
    longestMatchDuration: number | null;
    lastMatchDate: string | null;
  };
  activeLeagues: number;
  activeTeams: number;
  monthlyDuration: Array<{ month: string; value: number }>;
  monthlyScore: Array<{ month: string; value: number }>;
  leagues: Array<{ id: string; name: string; slug: string; matchCount: number }>;
  teams: Array<{
    id: string;
    name: string;
    slug: string;
    matchCount: number;
    radiantWinrate: number;
    direWinrate: number;
    overallWinrate: number;
  }>;
  pickBan: {
    picked: Array<{ heroId: string; total: number }>;
    banned: Array<{ heroId: string; total: number }>;
    contested: Array<{ heroId: string; total: number }>;
  };
  topPerformers: TopPerformerStat[];
};

export type LeagueDraftHero = {
  heroId: string;
  picks: number;
  bans: number;
  contested: number;
  contestRate: number;
  pickRate: number;
  banRate: number;
  winsWhenPicked: number;
  winRate: number | null;
  radiantPicks: number;
  direPicks: number;
  avgPickOrder: number | null;
  avgBanOrder: number | null;
  earliestPickOrder: number | null;
  earliestBanOrder: number | null;
};

export type LeagueDraftTeamSnapshot = {
  teamId: string;
  matches: number;
  topPicks: Array<{ heroId: string; total: number }>;
  topBans: Array<{ heroId: string; total: number }>;
};

export type LeaguePickBanAnalysis = {
  totalMatches: number;
  matchesWithDraft: number;
  totalPicks: number;
  totalBans: number;
  uniqueHeroesPicked: number;
  uniqueHeroesBanned: number;
  uniqueHeroesSeen: number;
  heroes: LeagueDraftHero[];
  teams: LeagueDraftTeamSnapshot[];
};

type PickBanResult = {
  mostPicked: PickBanStat[];
  mostBanned: PickBanStat[];
  mostContested: PickBanStat[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

const enc = (value: string | number) => encodeURIComponent(String(value));

// ── Counts / leagues ─────────────────────────────────────────────────────────

export const getCounts = () =>
  safe(
    () =>
      apiFetch<{ leagues: number; teams: number; matches: number; heroes: number }>(
        "/counts",
        { revalidate: ONE_DAY },
      ),
    { leagues: 0, teams: 0, matches: 0, heroes: 0 },
  );

export const getLeagues = () =>
  safe(() => apiFetch<League[]>("/leagues", { revalidate: ONE_DAY }), []);

export const getLeagueBySlug = async (slug: string): Promise<League | null> => {
  if (!slug) return null;
  return safe(
    () => apiFetch<League>(`/leagues/${enc(slug)}`, { revalidate: ONE_DAY }),
    null,
  );
};

export const getLeagueLastWinners = () =>
  safe(
    () =>
      apiFetch<Record<string, LeagueLastWinner>>("/leagues/last-winners", {
        revalidate: SIX_HOURS,
      }),
    {} as Record<string, LeagueLastWinner>,
  );

export const getLeagueSummary = async (leagueId: string): Promise<LeagueSummary | null> => {
  if (!leagueId) return null;
  return safe(
    () =>
      apiFetch<LeagueSummary | null>(`/leagues/${enc(leagueId)}/summary`, {
        revalidate: ONE_DAY,
      }),
    null,
  );
};

export const getLeagueSummaries = () =>
  safe(
    () => apiFetch<LeagueSummary[]>("/leagues/summaries", { revalidate: ONE_DAY }),
    [],
  );

export const getLeagueChampion = async (leagueId: string): Promise<LeagueChampion | null> => {
  if (!leagueId) return null;
  return safe(
    () =>
      apiFetch<LeagueChampion | null>(`/leagues/${enc(leagueId)}/champion`, {
        revalidate: SIX_HOURS,
      }),
    null,
  );
};

export const getLeagueTeamParticipation = async (
  leagueId: string,
): Promise<LeagueTeamParticipation[]> => {
  if (!leagueId) return [];
  return safe(
    () =>
      apiFetch<LeagueTeamParticipation[]>(
        `/leagues/${enc(leagueId)}/participation`,
        { revalidate: SIX_HOURS },
      ),
    [],
  );
};

export const getLeaguePickBanStats = async (
  leagueId: string,
  _limit = 10,
): Promise<PickBanResult> => {
  if (!leagueId) return { mostPicked: [], mostBanned: [], mostContested: [] };
  return safe(
    () =>
      apiFetch<PickBanResult>(`/leagues/${enc(leagueId)}/pickban`, {
        revalidate: SIX_HOURS,
      }),
    { mostPicked: [], mostBanned: [], mostContested: [] },
  );
};

export const getLeaguePickBanAnalysis = async (
  leagueId: string,
): Promise<LeaguePickBanAnalysis | null> => {
  if (!leagueId) return null;
  return safe(
    () =>
      apiFetch<LeaguePickBanAnalysis | null>(
        `/leagues/${enc(leagueId)}/pickban/analysis`,
        { revalidate: SIX_HOURS },
      ),
    null,
  );
};

export const getTopPerformersByLeague = async (
  leagueId: string,
): Promise<TopPerformerStat[]> => {
  if (!leagueId) return [];
  return safe(
    () =>
      apiFetch<TopPerformerStat[]>(`/leagues/${enc(leagueId)}/top-performers`, {
        revalidate: SIX_HOURS,
      }),
    [],
  );
};

// ── Teams ────────────────────────────────────────────────────────────────────

export const getTeams = () =>
  safe(() => apiFetch<Team[]>("/teams", { revalidate: ONE_DAY }), []);

export const getTeamsByIds = async (teamIds: string[]): Promise<Team[]> => {
  const ids = teamIds.filter(Boolean);
  if (!ids.length) return [];
  return safe(
    () =>
      apiFetch<Team[]>(`/teams?ids=${enc(ids.join(","))}`, {
        revalidate: ONE_DAY,
      }),
    [],
  );
};

export const getTeamBySlug = async (slug: string): Promise<Team | null> => {
  if (!slug) return null;
  return safe(
    () => apiFetch<Team>(`/teams/${enc(slug)}`, { revalidate: ONE_DAY }),
    null,
  );
};

export const getTeamSummary = async (teamId: string): Promise<TeamSummary | null> => {
  if (!teamId) return null;
  return safe(
    () =>
      apiFetch<TeamSummary | null>(`/teams/${enc(teamId)}/summary`, {
        revalidate: ONE_DAY,
      }),
    null,
  );
};

export const getTeamSummaries = () =>
  safe(() => apiFetch<TeamSummary[]>("/teams/summaries", { revalidate: ONE_DAY }), []);

export const getTeamPickBanStats = async (
  teamId: string,
  _limit = 10,
): Promise<PickBanResult> => {
  if (!teamId) return { mostPicked: [], mostBanned: [], mostContested: [] };
  return safe(
    () =>
      apiFetch<PickBanResult>(`/teams/${enc(teamId)}/pickban`, {
        revalidate: SIX_HOURS,
      }),
    { mostPicked: [], mostBanned: [], mostContested: [] },
  );
};

export const getTopPerformersByTeam = async (
  teamId: string,
): Promise<TopPerformerStat[]> => {
  if (!teamId) return [];
  return safe(
    () =>
      apiFetch<TopPerformerStat[]>(`/teams/${enc(teamId)}/top-performers`, {
        revalidate: SIX_HOURS,
      }),
    [],
  );
};

// ── Patches ──────────────────────────────────────────────────────────────────

export const getPatches = () =>
  safe(() => apiFetch<Patch[]>("/patches", { revalidate: ONE_DAY }), []);

export const getPatchesWithCounts = () =>
  safe(
    () => apiFetch<PatchWithCount[]>("/patches", { revalidate: ONE_DAY }),
    [] as PatchWithCount[],
  );

export const getPatchBySlug = async (patch: string): Promise<Patch | null> => {
  if (!patch) return null;
  return safe(
    () => apiFetch<Patch>(`/patches/${enc(patch)}`, { revalidate: ONE_DAY }),
    null,
  );
};

export const getMatchesByPatch = async (patchId: string): Promise<Match[]> => {
  if (!patchId) return [];
  return safe(
    () =>
      apiFetch<Match[]>(`/patches/${enc(patchId)}/matches`, {
        revalidate: ONE_HOUR,
      }),
    [],
  );
};

export const getTopPerformersByPatch = async (
  patchId: string,
): Promise<TopPerformerStat[]> => {
  if (!patchId) return [];
  return safe(
    () =>
      apiFetch<TopPerformerStat[]>(`/patches/${enc(patchId)}/top-performers`, {
        revalidate: SIX_HOURS,
      }),
    [],
  );
};

// ── Matches ──────────────────────────────────────────────────────────────────

export const getMatchesByLeague = async (leagueId: string, _limit = 10): Promise<Match[]> => {
  if (!leagueId) return [];
  return safe(
    () =>
      apiFetch<Match[]>(`/leagues/${enc(leagueId)}/matches`, {
        revalidate: ONE_HOUR,
      }),
    [],
  );
};

export const getAllMatchesByLeague = async (leagueId: string): Promise<Match[]> => {
  if (!leagueId) return [];
  return safe(
    () =>
      apiFetch<Match[]>(`/leagues/${enc(leagueId)}/matches?all=1`, {
        revalidate: ONE_HOUR,
      }),
    [],
  );
};

export const getMatchesByTeam = async (teamId: string, _limit = 10): Promise<Match[]> => {
  if (!teamId) return [];
  return safe(
    () =>
      apiFetch<Match[]>(`/teams/${enc(teamId)}/matches`, {
        revalidate: ONE_HOUR,
      }),
    [],
  );
};

export const getMatchesByTeamForHandicap = async (teamId: string): Promise<Match[]> => {
  if (!teamId) return [];
  return safe(
    () =>
      apiFetch<Match[]>(`/teams/${enc(teamId)}/handicap`, {
        revalidate: ONE_HOUR,
      }),
    [],
  );
};

export const getMatchesByLeagueIds = async (leagueIds: string[]): Promise<Match[]> => {
  const ids = leagueIds.filter(Boolean);
  if (!ids.length) return [];
  return safe(
    () =>
      apiFetch<Match[]>(`/matches?leagueIds=${enc(ids.join(","))}`, {
        revalidate: ONE_HOUR,
      }),
    [],
  );
};

export const getMatchesByIds = async (matchIds: string[]): Promise<Match[]> => {
  const ids = matchIds.filter(Boolean);
  if (!ids.length) return [];
  return safe(
    () =>
      apiFetch<Match[]>(`/matches?ids=${enc(ids.join(","))}`, {
        revalidate: ONE_HOUR,
      }),
    [],
  );
};

export const getMatchesByYear = async (year: number): Promise<Match[]> => {
  if (!year) return [];
  return safe(
    () =>
      apiFetch<Match[]>(`/seasons/${year}/matches`, { revalidate: ONE_HOUR }),
    [],
  );
};

export const getSeasonSnapshot = async (year: number): Promise<SeasonSnapshot | null> => {
  if (!year) return null;
  return safe(
    () =>
      apiFetch<SeasonSnapshot | null>(`/seasons/${year}`, { revalidate: ONE_DAY }),
    null,
  );
};

// ── Heroes / players ─────────────────────────────────────────────────────────

export const getHeroes = () =>
  safe(() => apiFetch<Hero[]>("/heroes", { revalidate: ONE_DAY }), []);

export const getPlayersByIds = async (
  ids: Array<string | number | null | undefined>,
): Promise<Map<string, string>> => {
  const list = ids
    .map((value) => (value === null || value === undefined ? "" : String(value)))
    .filter(Boolean);
  if (!list.length) return new Map();
  const result = await safe(
    () =>
      apiFetch<Record<string, string>>(`/players?ids=${enc(list.join(","))}`, {
        revalidate: ONE_DAY,
      }),
    {} as Record<string, string>,
  );
  return new Map(Object.entries(result));
};
