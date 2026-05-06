import { withRedisCache } from '@/lib/cache/redis';
import { leagues as mockLeagues, matches as mockMatches, patches as mockPatches, teams as mockTeams } from '@/lib/data/mock';
import { supabase } from '@/lib/supabase/client';
import type { Hero, League, Match, Patch, PickBanEntry, PickBanStat, Team } from '@/lib/types';

const supabaseClient = supabase as NonNullable<typeof supabase>;
const HOUR_IN_SECONDS = 60 * 60;
const SIX_HOURS_IN_SECONDS = HOUR_IN_SECONDS * 6;
const DAY_IN_SECONDS = HOUR_IN_SECONDS * 24;

const normalizeIds = (values: Array<string | number | bigint | null | undefined>) =>
    Array.from(
        new Set(
            values
                .map((value) => {
                    if (typeof value === 'string') {
                        return value.trim();
                    }
                    if (typeof value === 'number' || typeof value === 'bigint') {
                        return String(value);
                    }
                    return '';
                })
                .filter(Boolean),
        ),
    ).sort((left, right) => left.localeCompare(right));

const encodeCachePart = (value: string | number) => encodeURIComponent(String(value));

const isNumericId = (value: string) => /^\d+$/.test(value.trim());

const teamOrFilter = (teamId: string) =>
    `radiant_team_id.eq.${teamId},dire_team_id.eq.${teamId}`;

const toNumberOrNull = (value: unknown) =>
    value === null || value === undefined ? null : Number(value);

const PAGE_SIZE = 1000;

async function paginate<T>(
    buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
    pageSize = PAGE_SIZE,
): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await buildPage(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        out.push(...data);
        if (data.length < pageSize) break;
    }
    return out;
}

const mapLeague = (row: Record<string, unknown>): League => ({
    id: String(row.league_id ?? row.id ?? ''),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    startDate: (row.start_date as string | null) ?? null,
    endDate: (row.end_date as string | null) ?? null,
});

const mapTeam = (row: Record<string, unknown>): Team => ({
    id: String(row.team_id ?? row.id ?? ''),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    logoUrl: (row.logo_url as string | null) ?? null,
});

const mapPatch = (row: Record<string, unknown>): Patch => ({
    id: String(row.id ?? ''),
    patch: String(row.patch ?? ''),
});

const mapHero = (row: Record<string, unknown>): Hero => ({
    id: String(row.id ?? ''),
    localizedName: String(row.localized_name ?? row.localizedName ?? ''),
    name: String(row.name ?? ''),
});

const mapMatch = (row: Record<string, unknown>): Match => ({
    id: String(row.match_id ?? row.id ?? ''),
    leagueId: String(row.league_id ?? ''),
    duration: Number(row.duration ?? 0),
    startTime: String(row.start_time ?? ''),
    direScore: Number(row.dire_score ?? 0),
    radiantScore: Number(row.radiant_score ?? 0),
    radiantWin: Boolean(row.radiant_win ?? false),
    seriesType: row.series_type ? String(row.series_type) : null,
    seriesId: row.series_id ? String(row.series_id) : null,
    radiantTeamId: row.radiant_team_id ? String(row.radiant_team_id) : null,
    direTeamId: row.dire_team_id ? String(row.dire_team_id) : null,
    firstTowerTeamId: row.first_tower_team_id ? String(row.first_tower_team_id) : null,
    firstTowerTime: row.first_tower_time ? Number(row.first_tower_time) : null,
    picksBans: Array.isArray(row.picks_bans) ? (row.picks_bans as PickBanEntry[]) : null,
    patchId: String(row.patch_id ?? ''),
});

export async function getCounts(): Promise<{ leagues: number; teams: number; matches: number; heroes: number }> {
    if (!supabase) {
        return {
            leagues: mockLeagues.length,
            teams: mockTeams.length,
            matches: mockMatches.length,
            heroes: 0,
        };
    }

    return withRedisCache('counts', DAY_IN_SECONDS, async () => {
        const [leagueResult, teamResult, matchResult, heroResult] = await Promise.all([
            supabaseClient.from('leagues').select('league_id', { count: 'exact', head: true }),
            supabaseClient.from('teams').select('team_id', { count: 'exact', head: true }),
            supabaseClient.from('matches').select('match_id', { count: 'exact', head: true }),
            supabaseClient.from('heroes').select('id', { count: 'exact', head: true }),
        ]);

        return {
            leagues: leagueResult.count ?? 0,
            teams: teamResult.count ?? 0,
            matches: matchResult.count ?? 0,
            heroes: heroResult.count ?? 0,
        };
    });
}

export async function getLeagues(): Promise<League[]> {
    if (!supabase) {
        return mockLeagues;
    }

    return withRedisCache('leagues', DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient
            .from('leagues')
            .select('league_id,slug,name,start_date,end_date')
            .order('start_date', { ascending: false });

        if (error || !data) {
            return mockLeagues;
        }

        return data.map((row) => mapLeague(row as Record<string, unknown>));
    });
}

export async function getLeagueBySlug(slug: string): Promise<League | null> {
    if (!supabase) {
        return mockLeagues.find((league) => league.slug === slug) ?? null;
    }

    if (!slug) {
        return null;
    }

    const trimmedSlug = slug.trim();
    const idMatch = trimmedSlug.match(/-(\d+)$/);
    const leagueId = /^\d+$/.test(trimmedSlug) ? trimmedSlug : idMatch ? idMatch[1] : null;

    return withRedisCache(`league:${encodeCachePart(trimmedSlug)}`, DAY_IN_SECONDS, async () => {
        if (leagueId) {
            const { data, error } = await supabaseClient
                .from('leagues')
                .select('league_id,slug,name,start_date,end_date')
                .eq('league_id', leagueId)
                .maybeSingle();

            if (!error && data) {
                return mapLeague(data as Record<string, unknown>);
            }
        }

        const { data, error } = await supabaseClient
            .from('leagues')
            .select('league_id,slug,name,start_date,end_date')
            .eq('slug', trimmedSlug)
            .maybeSingle();

        if (error || !data) {
            return mockLeagues.find((league) => league.slug === slug) ?? null;
        }

        return mapLeague(data as Record<string, unknown>);
    });
}

export async function getTeams(): Promise<Team[]> {
    if (!supabase) {
        return mockTeams;
    }

    return withRedisCache('teams', DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient
            .from('teams')
            .select('team_id,slug,name,logo_url')
            .order('name', { ascending: true });

        if (error || !data) {
            return mockTeams;
        }

        const teams = data.map((row) => mapTeam(row as Record<string, unknown>));

        const { data: viewRows } = await supabaseClient
            .from('team_summary_view')
            .select('team_id,last_match_time');

        const latestMatchByTeam = new Map<string, number>();
        for (const row of (viewRows as Array<Record<string, unknown>> | null) ?? []) {
            const id = row.team_id ? String(row.team_id) : '';
            const ts = Date.parse(String(row.last_match_time ?? ''));
            if (id && Number.isFinite(ts)) {
                latestMatchByTeam.set(id, ts);
            }
        }

        return teams.sort((a, b) => {
            const timeA = latestMatchByTeam.get(a.id) ?? 0;
            const timeB = latestMatchByTeam.get(b.id) ?? 0;
            return timeB - timeA;
        });
    });
}

export async function getTeamsByIds(teamIds: string[]): Promise<Team[]> {
    const uniqueTeamIds = normalizeIds(teamIds);
    if (!uniqueTeamIds.length) {
        return [];
    }

    if (!supabase) {
        return mockTeams.filter((team) => uniqueTeamIds.includes(team.id));
    }

    return withRedisCache(`teams:${uniqueTeamIds.map(encodeCachePart).join(',')}`, DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient.from('teams').select('team_id,slug,name,logo_url').in('team_id', uniqueTeamIds);

        if (error || !data) {
            return [];
        }

        return data.map((row) => mapTeam(row as Record<string, unknown>)).sort((a, b) => a.name.localeCompare(b.name));
    });
}

export async function getTeamBySlug(slug: string): Promise<Team | null> {
    if (!supabase) {
        return mockTeams.find((team) => team.slug === slug) ?? null;
    }

    const trimmedSlug = slug.trim();

    return withRedisCache(`team:${encodeCachePart(trimmedSlug)}`, DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient
            .from('teams')
            .select('team_id,slug,name,logo_url')
            .eq('slug', trimmedSlug)
            .maybeSingle();

        if (error || !data) {
            return mockTeams.find((team) => team.slug === slug) ?? null;
        }

        return mapTeam(data as Record<string, unknown>);
    });
}

export async function getPatches(): Promise<Patch[]> {
    if (!supabase) {
        return mockPatches;
    }

    return withRedisCache('patches', DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient.from('patch').select('id,patch').order('id', { ascending: false });

        if (error || !data) {
            return mockPatches;
        }

        return data.map((row) => mapPatch(row as Record<string, unknown>));
    });
}

export type PatchWithCount = Patch & { matchCount: number };

export async function getPatchesWithCounts(): Promise<PatchWithCount[]> {
    if (!supabase) {
        const counts = mockMatches.reduce<Record<string, number>>((acc, match) => {
            acc[match.patchId] = (acc[match.patchId] ?? 0) + 1;
            return acc;
        }, {});
        return mockPatches.map((patch) => ({
            ...patch,
            matchCount: counts[patch.id] ?? 0,
        }));
    }

    return withRedisCache('patches:with-counts', DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient.from('patch').select('id,patch,matches(count)').order('id', { ascending: false });

        if (error || !data) {
            return [];
        }

        return data.map((row) => {
            const record = row as Record<string, unknown>;
            const matches = Array.isArray(record.matches) ? (record.matches as Array<Record<string, unknown>>) : [];
            const matchCount = matches[0]?.count ? Number(matches[0].count) : 0;
            return {
                id: String(record.id ?? ''),
                patch: String(record.patch ?? ''),
                matchCount,
            };
        });
    });
}

export async function getPatchBySlug(patchSlug: string): Promise<Patch | null> {
    if (!supabase || !patchSlug) {
        return null;
    }

    const trimmedPatchSlug = patchSlug.trim();
    return withRedisCache(`patch:${encodeCachePart(trimmedPatchSlug)}`, DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient.from('patch').select('id,patch').eq('patch', trimmedPatchSlug).maybeSingle();
        if (error || !data) {
            return null;
        }
        return mapPatch(data as Record<string, unknown>);
    });
}

export async function getMatchesByPatch(patchId: string): Promise<Match[]> {
    if (!patchId) {
        return [];
    }

    if (!supabase) {
        return mockMatches.filter((match) => match.patchId === patchId);
    }

    return withRedisCache(`matches:patch:${encodeCachePart(patchId)}`, HOUR_IN_SECONDS, async () => {
        const rows = await paginate<Record<string, unknown>>((from, to) =>
            supabaseClient
                .from('matches')
                .select(
                    'match_id,league_id,start_time,duration,dire_score,radiant_score,radiant_win,series_id,series_type,radiant_team_id,dire_team_id,first_tower_time,patch_id,picks_bans',
                )
                .eq('patch_id', patchId)
                .order('start_time', { ascending: false })
                .range(from, to),
        );
        return rows.map(mapMatch);
    });
}

export async function getHeroes(): Promise<Hero[]> {
    if (!supabase) {
        return [];
    }

    return withRedisCache('heroes', DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient.from('heroes').select('id, localized_name, name').order('id', { ascending: true });

        if (error || !data) {
            return [];
        }

        return data.map((row) => mapHero(row as Record<string, unknown>));
    });
}

export async function getPlayersByIds(ids: Array<string | number | null | undefined>): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const cleanIds = normalizeIds(ids);
    if (!supabase || cleanIds.length === 0) {
        return result;
    }

    const cacheKey = `players:by-ids:v2:${encodeCachePart(cleanIds.join(','))}`;
    const rows = await withRedisCache(cacheKey, DAY_IN_SECONDS, async () => {
        const collected: Array<{ id: string; name: string }> = [];
        const chunkSize = 200;
        for (let i = 0; i < cleanIds.length; i += chunkSize) {
            const chunk = cleanIds.slice(i, i + chunkSize);
            const { data, error } = await supabaseClient
                .from('players')
                .select('id,name')
                .in('id', chunk);
            if (error || !data) continue;
            (data as Array<Record<string, unknown>>).forEach((row) => {
                const id = String(row.id ?? '');
                const name = String(row.name ?? '').trim();
                if (id && name) {
                    collected.push({ id, name });
                }
            });
        }
        return collected;
    });

    rows.forEach((row) => result.set(row.id, row.name));
    return result;
}

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

const TOP_PERFORMER_STATS = [
    { key: 'kills', title: 'Most Kills', field: 'kills' },
    { key: 'deaths', title: 'Most Deaths', field: 'deaths' },
    { key: 'assists', title: 'Most Assists', field: 'assists' },
    { key: 'gold', title: 'Most Gold', field: 'gold' },
    { key: 'denies', title: 'Most Denies', field: 'denies' },
    { key: 'hero_damage', title: 'Most Hero Damage', field: 'hero_damage' },
    { key: 'last_hits', title: 'Most Last Hits', field: 'last_hits' },
    { key: 'tower_damage', title: 'Most Tower Damage', field: 'tower_damage' },
    { key: 'hero_healing', title: 'Most Healing', field: 'hero_healing' },
] as const;

type TopPerformerField = (typeof TOP_PERFORMER_STATS)[number]['field'];

const TOP_PERFORMER_ROW_SELECT =
    'id,match_id,hero_id,team_id,account_id,kills,deaths,assists,gold,denies,hero_damage,last_hits,tower_damage,hero_healing';
const TOP_PERFORMER_PAGE_SIZE = 5000;

const emptyTopPerformerStats = (): TopPerformerStat[] =>
    TOP_PERFORMER_STATS.map((stat) => ({ key: stat.key, title: stat.title, performer: null }));

const readTopPerformerValue = (row: Record<string, unknown>, field: TopPerformerField): number => {
    const value = row[field];
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
};

const toTopPerformerStat = (row: Record<string, unknown>, field: TopPerformerField, key: string, title: string): TopPerformerStat => ({
    key,
    title,
    performer: {
        matchId: String(row.match_id ?? ''),
        heroId: row.hero_id ? String(row.hero_id) : null,
        teamId: row.team_id ? String(row.team_id) : null,
        accountId: row.account_id ? String(row.account_id) : null,
        statValue: readTopPerformerValue(row, field),
        kills: Number(row.kills ?? 0),
        deaths: Number(row.deaths ?? 0),
        assists: Number(row.assists ?? 0),
    },
});

const summarizeTopPerformers = (rows: Array<Record<string, unknown>>): TopPerformerStat[] => {
    const topRows = new Map<TopPerformerField, Record<string, unknown>>();

    rows.forEach((row) => {
        TOP_PERFORMER_STATS.forEach((stat) => {
            const value = readTopPerformerValue(row, stat.field);
            if (!Number.isFinite(value) || value <= 0) {
                return;
            }

            const current = topRows.get(stat.field);
            if (!current || value > readTopPerformerValue(current, stat.field)) {
                topRows.set(stat.field, row);
            }
        });
    });

    return TOP_PERFORMER_STATS.map((stat) => {
        const row = topRows.get(stat.field);
        if (!row) {
            return { key: stat.key, title: stat.title, performer: null };
        }

        return toTopPerformerStat(row, stat.field, stat.key, stat.title);
    });
};

export async function getTopPerformersByLeague(leagueId: string): Promise<TopPerformerStat[]> {
    if (!supabase || !leagueId) {
        return emptyTopPerformerStats();
    }

    return withRedisCache(`top-performers:league:v2:${encodeCachePart(leagueId)}`, SIX_HOURS_IN_SECONDS, async () => {
        const rows = await paginate<Record<string, unknown>>(
            (from, to) =>
                supabaseClient
                    .from('player_matches')
                    .select(`${TOP_PERFORMER_ROW_SELECT},matches!inner(league_id)`)
                    .eq('matches.league_id', leagueId)
                    .order('id', { ascending: true })
                    .range(from, to),
            TOP_PERFORMER_PAGE_SIZE,
        );
        return summarizeTopPerformers(rows);
    });
}

export async function getTopPerformersByTeam(teamId: string): Promise<TopPerformerStat[]> {
    if (!supabase || !teamId) {
        return emptyTopPerformerStats();
    }

    return withRedisCache(`top-performers:team:v2:${encodeCachePart(teamId)}`, SIX_HOURS_IN_SECONDS, async () => {
        const rows = await paginate<Record<string, unknown>>(
            (from, to) =>
                supabaseClient
                    .from('player_matches')
                    .select(TOP_PERFORMER_ROW_SELECT)
                    .eq('team_id', teamId)
                    .order('id', { ascending: true })
                    .range(from, to),
            TOP_PERFORMER_PAGE_SIZE,
        );
        return summarizeTopPerformers(rows);
    });
}

export async function getLeagueTeamParticipation(leagueId: string): Promise<LeagueTeamParticipation[]> {
    if (!supabase || !leagueId) {
        return [];
    }

    return withRedisCache(`league-team-participation:${encodeCachePart(leagueId)}`, SIX_HOURS_IN_SECONDS, async () => {
        const [matchRows, playerMatchRows] = await Promise.all([
            paginate<Record<string, unknown>>((from, to) =>
                supabaseClient
                    .from('matches')
                    .select('radiant_team_id,dire_team_id,radiant_win')
                    .eq('league_id', leagueId)
                    .order('match_id', { ascending: false })
                    .range(from, to),
            ),
            paginate<Record<string, unknown>>((from, to) =>
                supabaseClient
                    .from('player_matches')
                    .select('id,team_id,hero_id,matches!inner(league_id)')
                    .eq('matches.league_id', leagueId)
                    .order('id', { ascending: true })
                    .range(from, to),
            ),
        ]);

        const teamStats = new Map<string, { matches: number; wins: number }>();
        for (const match of matchRows) {
            const radiantId = match.radiant_team_id ? String(match.radiant_team_id) : null;
            const direId = match.dire_team_id ? String(match.dire_team_id) : null;
            const radiantWin = Boolean(match.radiant_win);

            if (radiantId) {
                const stats = teamStats.get(radiantId) ?? { matches: 0, wins: 0 };
                stats.matches += 1;
                if (radiantWin) stats.wins += 1;
                teamStats.set(radiantId, stats);
            }
            if (direId) {
                const stats = teamStats.get(direId) ?? { matches: 0, wins: 0 };
                stats.matches += 1;
                if (!radiantWin) stats.wins += 1;
                teamStats.set(direId, stats);
            }
        }

        const heroStats = new Map<string, Map<string, number>>();
        for (const row of playerMatchRows) {
            const teamId = row.team_id ? String(row.team_id) : null;
            const heroId = row.hero_id ? String(row.hero_id) : null;
            if (!teamId || !heroId) continue;
            let teamHeroes = heroStats.get(teamId);
            if (!teamHeroes) {
                teamHeroes = new Map();
                heroStats.set(teamId, teamHeroes);
            }
            teamHeroes.set(heroId, (teamHeroes.get(heroId) ?? 0) + 1);
        }

        const participation: LeagueTeamParticipation[] = Array.from(teamStats.entries()).map(([teamId, stats]) => {
            const heroes = heroStats.get(teamId) ?? new Map();
            let topHeroId: string | null = null;
            let topHeroCount = 0;
            heroes.forEach((count, heroId) => {
                if (count > topHeroCount) {
                    topHeroCount = count;
                    topHeroId = heroId;
                }
            });

            return {
                teamId,
                matchCount: stats.matches,
                wins: stats.wins,
                winrate: stats.matches ? Number(((stats.wins / stats.matches) * 100).toFixed(1)) : 0,
                mostPickedHeroId: topHeroId,
                mostPickedTotal: topHeroCount,
            };
        });

        return participation.sort((a, b) => b.matchCount - a.matchCount);
    });
}

export async function getLeagueChampion(leagueId: string): Promise<LeagueChampion | null> {
    if (!supabase || !leagueId) {
        return null;
    }

    return withRedisCache(`league-champion:v1:${encodeCachePart(leagueId)}`, SIX_HOURS_IN_SECONDS, async () => {
        type MatchRow = {
            match_id: string;
            start_time: string | null;
            series_id: string | null;
            series_type: string | null;
            radiant_team_id: string | null;
            dire_team_id: string | null;
            radiant_win: boolean;
        };
        const rawRows = await paginate<Record<string, unknown>>((from, to) =>
            supabaseClient
                .from('matches')
                .select('match_id,start_time,series_id,series_type,radiant_team_id,dire_team_id,radiant_win')
                .eq('league_id', leagueId)
                .order('start_time', { ascending: false })
                .range(from, to),
        );
        const matchRows: MatchRow[] = rawRows.map((row) => ({
            match_id: row.match_id ? String(row.match_id) : '',
            start_time: (row.start_time as string | null) ?? null,
            series_id: row.series_id ? String(row.series_id) : null,
            series_type: (row.series_type as string | null) ?? null,
            radiant_team_id: row.radiant_team_id ? String(row.radiant_team_id) : null,
            dire_team_id: row.dire_team_id ? String(row.dire_team_id) : null,
            radiant_win: Boolean(row.radiant_win),
        }));

        if (!matchRows.length) {
            return null;
        }

        const parseTime = (value: string | null) => {
            if (!value) return 0;
            const parsed = Date.parse(value);
            return Number.isNaN(parsed) ? 0 : parsed;
        };

        // Group by series_id; matches without series form their own singleton series.
        type SeriesGroup = {
            seriesId: string | null;
            seriesType: string | null;
            matches: typeof matchRows;
            latestStart: number;
        };
        const seriesMap = new Map<string, SeriesGroup>();
        matchRows.forEach((match) => {
            const key = match.series_id ?? `solo:${match.match_id}`;
            const existing = seriesMap.get(key);
            const ts = parseTime(match.start_time);
            if (existing) {
                existing.matches.push(match);
                if (ts > existing.latestStart) {
                    existing.latestStart = ts;
                }
            } else {
                seriesMap.set(key, {
                    seriesId: match.series_id,
                    seriesType: match.series_type,
                    matches: [match],
                    latestStart: ts,
                });
            }
        });

        // Pick the series whose latest match is most recent — that's the final.
        const finalSeries = Array.from(seriesMap.values()).sort(
            (a, b) => b.latestStart - a.latestStart,
        )[0];

        if (!finalSeries) {
            return null;
        }

        const finalMatches = [...finalSeries.matches].sort(
            (a, b) => parseTime(a.start_time) - parseTime(b.start_time),
        );
        const decidingMatch = finalMatches[finalMatches.length - 1];
        if (!decidingMatch || (!decidingMatch.radiant_team_id && !decidingMatch.dire_team_id)) {
            return null;
        }

        // Tally wins by team across the series matches.
        const tallies = new Map<string, number>();
        finalMatches.forEach((match) => {
            const winnerId = match.radiant_win ? match.radiant_team_id : match.dire_team_id;
            if (!winnerId) return;
            tallies.set(winnerId, (tallies.get(winnerId) ?? 0) + 1);
        });

        const winnerTeamId = decidingMatch.radiant_win
            ? decidingMatch.radiant_team_id
            : decidingMatch.dire_team_id;
        if (!winnerTeamId) {
            return null;
        }

        const runnerUpTeamId =
            decidingMatch.radiant_team_id === winnerTeamId
                ? decidingMatch.dire_team_id
                : decidingMatch.radiant_team_id;

        const winnerWins = tallies.get(winnerTeamId) ?? 0;
        const runnerUpWins = runnerUpTeamId ? tallies.get(runnerUpTeamId) ?? 0 : 0;

        // Roster: pull player_matches for the deciding match for the winning team.
        const { data: rosterRows, error: rosterError } = await supabaseClient
            .from('player_matches')
            .select('account_id,hero_id,kills,deaths,assists,player_slot')
            .eq('match_id', decidingMatch.match_id)
            .eq('team_id', winnerTeamId)
            .order('player_slot', { ascending: true });

        const roster: LeagueChampionPlayer[] = !rosterError && rosterRows
            ? rosterRows.map((row) => ({
                  accountId: row.account_id ? String(row.account_id) : null,
                  heroId: row.hero_id ? String(row.hero_id) : null,
                  kills: Number(row.kills ?? 0),
                  deaths: Number(row.deaths ?? 0),
                  assists: Number(row.assists ?? 0),
              }))
            : [];

        return {
            leagueId,
            winnerTeamId,
            runnerUpTeamId: runnerUpTeamId ?? null,
            winnerWins,
            runnerUpWins,
            seriesId: finalSeries.seriesId,
            seriesType: finalSeries.seriesType,
            finalMatchId: decidingMatch.match_id,
            finalMatchStartTime: decidingMatch.start_time,
            roster,
        };
    });
}

export type LeagueLastWinner = {
    teamId: string;
    matchId: string;
    startTime: string | null;
};

export async function getLeagueLastWinners(): Promise<Record<string, LeagueLastWinner>> {
    if (!supabase) {
        return {};
    }

    return withRedisCache('league-last-winners:v1', SIX_HOURS_IN_SECONDS, async () => {
        const rows = await paginate<Record<string, unknown>>((from, to) =>
            supabaseClient
                .from('matches')
                .select('league_id,match_id,start_time,radiant_team_id,dire_team_id,radiant_win')
                .order('start_time', { ascending: false })
                .range(from, to),
        );

        const map: Record<string, LeagueLastWinner> = {};
        for (const row of rows) {
            const leagueId = row.league_id ? String(row.league_id) : '';
            if (!leagueId || map[leagueId]) continue;
            const winnerTeamId = row.radiant_win ? row.radiant_team_id : row.dire_team_id;
            if (!winnerTeamId) continue;
            map[leagueId] = {
                teamId: String(winnerTeamId),
                matchId: row.match_id ? String(row.match_id) : '',
                startTime: (row.start_time as string | null) ?? null,
            };
        }
        return map;
    });
}

export async function getTopPerformersByPatch(patchId: string): Promise<TopPerformerStat[]> {
    if (!supabase || !patchId) {
        return emptyTopPerformerStats();
    }

    return withRedisCache(`top-performers:patch:v2:${encodeCachePart(patchId)}`, SIX_HOURS_IN_SECONDS, async () => {
        const rows = await paginate<Record<string, unknown>>(
            (from, to) =>
                supabaseClient
                    .from('player_matches')
                    .select(`${TOP_PERFORMER_ROW_SELECT},matches!inner(patch_id)`)
                    .eq('matches.patch_id', patchId)
                    .order('id', { ascending: true })
                    .range(from, to),
            TOP_PERFORMER_PAGE_SIZE,
        );
        return summarizeTopPerformers(rows);
    });
}

export async function getMatchesByLeague(leagueId: string, limit = 10): Promise<Match[]> {
    if (!supabase) {
        return mockMatches.filter((match) => match.leagueId === leagueId).slice(0, limit);
    }

    return withRedisCache(`matches:league:${encodeCachePart(leagueId)}:${limit}`, HOUR_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient
            .from('matches')
            .select('match_id,league_id,start_time,duration,dire_score,radiant_score,radiant_win,series_id,series_type,radiant_team_id,dire_team_id,first_tower_time,patch_id')
            .eq('league_id', leagueId)
            .order('start_time', { ascending: false })
            .limit(limit);

        if (error || !data) {
            return mockMatches.filter((match) => match.leagueId === leagueId).slice(0, limit);
        }

        return data.map((row) => mapMatch(row as Record<string, unknown>));
    });
}

export async function getAllMatchesByLeague(leagueId: string): Promise<Match[]> {
    if (!leagueId) {
        return [];
    }

    if (!supabase) {
        return mockMatches.filter((match) => match.leagueId === leagueId);
    }

    return withRedisCache(`matches:league-all:${encodeCachePart(leagueId)}`, HOUR_IN_SECONDS, async () => {
        const rows = await paginate<Record<string, unknown>>((from, to) =>
            supabaseClient
                .from('matches')
                .select(
                    'match_id,league_id,start_time,dire_score,radiant_score,radiant_win,series_id,series_type,radiant_team_id,dire_team_id,patch_id,duration',
                )
                .eq('league_id', leagueId)
                .order('start_time', { ascending: false })
                .range(from, to),
        );
        return rows.map(mapMatch);
    });
}

export async function getMatchesByTeam(teamId: string, limit = 10): Promise<Match[]> {
    if (!supabase) {
        return mockMatches.filter((match) => match.radiantTeamId === teamId || match.direTeamId === teamId).slice(0, limit);
    }
    if (!isNumericId(teamId)) return [];

    return withRedisCache(`matches:team:${encodeCachePart(teamId)}:${limit}`, HOUR_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient
            .from('matches')
            .select('match_id,league_id,start_time,duration,dire_score,radiant_score,radiant_win,series_id,series_type,radiant_team_id,dire_team_id,first_tower_time,patch_id')
            .or(teamOrFilter(teamId))
            .order('start_time', { ascending: false })
            .limit(limit);

        if (error || !data) {
            return mockMatches.filter((match) => match.radiantTeamId === teamId || match.direTeamId === teamId).slice(0, limit);
        }

        return data.map((row) => mapMatch(row as Record<string, unknown>));
    });
}

export async function getMatchesByTeamForHandicap(teamId: string): Promise<Match[]> {
    if (!teamId) {
        return [];
    }

    if (!supabase) {
        return mockMatches.filter((match) => match.radiantTeamId === teamId || match.direTeamId === teamId);
    }
    if (!isNumericId(teamId)) return [];

    return withRedisCache(`matches:team-handicap:${encodeCachePart(teamId)}`, HOUR_IN_SECONDS, async () => {
        const rows = await paginate<Record<string, unknown>>((from, to) =>
            supabaseClient
                .from('matches')
                .select('match_id,league_id,radiant_team_id,dire_team_id,radiant_score,dire_score,radiant_win,patch_id')
                .or(teamOrFilter(teamId))
                .order('match_id', { ascending: false })
                .range(from, to),
        );
        return rows.map(mapMatch);
    });
}

export async function getMatchesByLeagueIds(leagueIds: string[]): Promise<Match[]> {
    const normalizedLeagueIds = normalizeIds(leagueIds);
    if (!normalizedLeagueIds.length) {
        return [];
    }

    if (!supabase) {
        return mockMatches.filter((match) => normalizedLeagueIds.includes(match.leagueId));
    }

    return withRedisCache(
        `matches:league-ids:${normalizedLeagueIds.map(encodeCachePart).join(',')}`,
        HOUR_IN_SECONDS,
        async () => {
            const rows = await paginate<Record<string, unknown>>((from, to) =>
                supabaseClient
                    .from('matches')
                    .select('match_id,league_id,start_time,duration,dire_score,radiant_score,radiant_win,series_id,series_type,radiant_team_id,dire_team_id,first_tower_time,patch_id')
                    .in('league_id', normalizedLeagueIds)
                    .order('start_time', { ascending: false })
                    .range(from, to),
            );
            return rows.map(mapMatch);
        },
    );
}

export async function getMatchesByIds(matchIds: string[]): Promise<Match[]> {
    const normalizedMatchIds = normalizeIds(matchIds);
    if (!normalizedMatchIds.length) {
        return [];
    }

    if (!supabase) {
        return mockMatches.filter((match) => normalizedMatchIds.includes(match.id));
    }

    return withRedisCache(`matches:ids:${normalizedMatchIds.map(encodeCachePart).join(',')}`, HOUR_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient
            .from('matches')
            .select('match_id,league_id,start_time,dire_score,radiant_score,radiant_win,radiant_team_id,dire_team_id,duration')
            .in('match_id', normalizedMatchIds);
        if (error || !data) {
            return [];
        }

        return data.map((row) => mapMatch(row as Record<string, unknown>));
    });
}

export async function getMatchesByYear(year: number): Promise<Match[]> {
    if (!year) {
        return [];
    }

    if (!supabase) {
        return mockMatches.filter((match) => new Date(match.startTime).getFullYear() === year);
    }

    const start = `${year}-01-01`;
    const end = `${year + 1}-01-01`;

    return withRedisCache(`matches:year:${year}`, HOUR_IN_SECONDS, async () => {
        const rows = await paginate<Record<string, unknown>>((from, to) =>
            supabaseClient
                .from('matches')
                .select('match_id,league_id,start_time,duration,dire_score,radiant_score,radiant_win,radiant_team_id,dire_team_id,first_tower_time,patch_id,series_id,series_type')
                .gte('start_time', start)
                .lt('start_time', end)
                .order('start_time', { ascending: true })
                .range(from, to),
        );
        return rows.map(mapMatch);
    });
}

const LEAGUE_VIEW_COLUMNS =
    'league_id, total_matches, total_teams, avg_duration, avg_score, avg_first_tower_time, radiant_winrate, last_match_time';
const TEAM_VIEW_COLUMNS =
    'team_id, total_matches, avg_duration, avg_score, radiant_matches, dire_matches, radiant_winrate, dire_winrate, last_match_time';

const mapLeagueSummaryView = (row: Record<string, unknown>): LeagueSummary | null => {
    const totalMatches = Number(row.total_matches ?? 0);
    if (!totalMatches) return null;
    return {
        leagueId: String(row.league_id),
        totalMatches,
        totalTeams: toNumberOrNull(row.total_teams),
        avgDuration: toNumberOrNull(row.avg_duration),
        avgScore: toNumberOrNull(row.avg_score),
        radiantWinrate: toNumberOrNull(row.radiant_winrate),
        avgFirstTowerTime: toNumberOrNull(row.avg_first_tower_time),
        lastMatchTime: (row.last_match_time as string | null) ?? null,
        minScore: null,
        maxScore: null,
        minScoreMatchId: null,
        maxScoreMatchId: null,
        fastestMatchId: null,
        fastestMatchDuration: null,
        longestMatchId: null,
        longestMatchDuration: null,
    };
};

const mapTeamSummaryView = (row: Record<string, unknown>): TeamSummary | null => {
    const totalMatches = Number(row.total_matches ?? 0);
    if (!totalMatches) return null;
    return {
        teamId: String(row.team_id),
        totalMatches,
        avgDuration: toNumberOrNull(row.avg_duration),
        avgScore: toNumberOrNull(row.avg_score),
        avgFirstTowerTime: null,
        radiantMatches: toNumberOrNull(row.radiant_matches),
        direMatches: toNumberOrNull(row.dire_matches),
        radiantWinrate: toNumberOrNull(row.radiant_winrate),
        direWinrate: toNumberOrNull(row.dire_winrate),
        lastMatchTime: (row.last_match_time as string | null) ?? null,
        minScore: null,
        maxScore: null,
        minScoreMatchId: null,
        maxScoreMatchId: null,
        fastestMatchId: null,
        fastestMatchDuration: null,
        longestMatchId: null,
        longestMatchDuration: null,
    };
};

export async function getLeagueSummary(leagueId: string): Promise<LeagueSummary | null> {
    if (!supabase || !leagueId) {
        return null;
    }
    return withRedisCache(`league-summary:${encodeCachePart(leagueId)}`, DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient.from('league_snapshots').select('payload').eq('league_id', leagueId).maybeSingle();
        if (!error && data?.payload) {
            return data.payload as LeagueSummary;
        }
        const { data: viewRow, error: viewError } = await supabaseClient
            .from('league_summary_view')
            .select(LEAGUE_VIEW_COLUMNS)
            .eq('league_id', leagueId)
            .maybeSingle();
        if (viewError || !viewRow) return null;
        return mapLeagueSummaryView(viewRow as Record<string, unknown>);
    });
}

export async function getTeamSummary(teamId: string): Promise<TeamSummary | null> {
    if (!supabase || !teamId) {
        return null;
    }
    return withRedisCache(`team-summary:${encodeCachePart(teamId)}`, DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient.from('team_snapshots').select('payload').eq('team_id', teamId).maybeSingle();
        if (!error && data?.payload) {
            return data.payload as TeamSummary;
        }
        const { data: viewRow, error: viewError } = await supabaseClient
            .from('team_summary_view')
            .select(TEAM_VIEW_COLUMNS)
            .eq('team_id', teamId)
            .maybeSingle();
        if (viewError || !viewRow) return null;
        return mapTeamSummaryView(viewRow as Record<string, unknown>);
    });
}

export async function getSeasonSnapshot(year: number): Promise<SeasonSnapshot | null> {
    if (!supabase || !year) {
        return null;
    }
    return withRedisCache(`season-snapshot:${year}`, DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient.from('season_snapshots').select('payload').eq('year', year).maybeSingle();
        if (!error && data?.payload) {
            return data.payload as SeasonSnapshot;
        }
        return buildSeasonSnapshotFromMatches(year);
    });
}

async function buildSeasonSnapshotFromMatches(year: number): Promise<SeasonSnapshot | null> {
    const start = `${year}-01-01T00:00:00Z`;
    const end = `${year + 1}-01-01T00:00:00Z`;
    type Row = {
        match_id: string | number;
        league_id: string | number | null;
        start_time: string | null;
        duration: number | null;
        radiant_score: number | null;
        dire_score: number | null;
        radiant_win: boolean | null;
        radiant_team_id: string | number | null;
        dire_team_id: string | number | null;
    };
    const rows = await paginate<Row>((from, to) =>
        supabaseClient
            .from('matches')
            .select('match_id,league_id,start_time,duration,radiant_score,dire_score,radiant_win,radiant_team_id,dire_team_id')
            .gte('start_time', start)
            .lt('start_time', end)
            .order('start_time', { ascending: true })
            .range(from, to),
    );

    if (rows.length === 0) {
        return null;
    }

    const totalMatches = rows.length;
    let durationSum = 0;
    let scoreSum = 0;
    let radiantWins = 0;
    let minScore = Number.POSITIVE_INFINITY;
    let maxScore = Number.NEGATIVE_INFINITY;
    let minScoreMatchId: string | null = null;
    let maxScoreMatchId: string | null = null;
    let fastestDuration = Number.POSITIVE_INFINITY;
    let longestDuration = Number.NEGATIVE_INFINITY;
    let fastestMatchId: string | null = null;
    let longestMatchId: string | null = null;
    let lastMatchDate: string | null = null;

    const leagueCounts = new Map<string, number>();
    const teamStats = new Map<string, { matches: number; radiantMatches: number; direMatches: number; radiantWins: number; direWins: number }>();
    const monthlyDurationAgg = new Map<string, { sum: number; count: number }>();
    const monthlyScoreAgg = new Map<string, { sum: number; count: number }>();

    const bumpTeam = (id: string, isRadiant: boolean, win: boolean) => {
        const current = teamStats.get(id) ?? { matches: 0, radiantMatches: 0, direMatches: 0, radiantWins: 0, direWins: 0 };
        current.matches += 1;
        if (isRadiant) {
            current.radiantMatches += 1;
            if (win) current.radiantWins += 1;
        } else {
            current.direMatches += 1;
            if (win) current.direWins += 1;
        }
        teamStats.set(id, current);
    };

    for (const row of rows) {
        const matchId = String(row.match_id);
        const score = (row.radiant_score ?? 0) + (row.dire_score ?? 0);
        const duration = row.duration ?? 0;
        durationSum += duration;
        scoreSum += score;
        if (row.radiant_win) radiantWins += 1;
        if (score < minScore) { minScore = score; minScoreMatchId = matchId; }
        if (score > maxScore) { maxScore = score; maxScoreMatchId = matchId; }
        if (duration > 0 && duration < fastestDuration) { fastestDuration = duration; fastestMatchId = matchId; }
        if (duration > longestDuration) { longestDuration = duration; longestMatchId = matchId; }
        if (row.start_time) {
            if (!lastMatchDate || row.start_time > lastMatchDate) lastMatchDate = row.start_time;
            const month = row.start_time.slice(0, 7);
            const dAgg = monthlyDurationAgg.get(month) ?? { sum: 0, count: 0 };
            dAgg.sum += duration; dAgg.count += 1;
            monthlyDurationAgg.set(month, dAgg);
            const sAgg = monthlyScoreAgg.get(month) ?? { sum: 0, count: 0 };
            sAgg.sum += score; sAgg.count += 1;
            monthlyScoreAgg.set(month, sAgg);
        }
        if (row.league_id !== null && row.league_id !== undefined) {
            const lid = String(row.league_id);
            leagueCounts.set(lid, (leagueCounts.get(lid) ?? 0) + 1);
        }
        if (row.radiant_team_id !== null && row.radiant_team_id !== undefined) {
            bumpTeam(String(row.radiant_team_id), true, Boolean(row.radiant_win));
        }
        if (row.dire_team_id !== null && row.dire_team_id !== undefined) {
            bumpTeam(String(row.dire_team_id), false, !row.radiant_win);
        }
    }

    const [allLeagues, allTeams] = await Promise.all([getLeagues(), getTeams()]);
    const leagueLookup = new Map(allLeagues.map((league) => [league.id, league]));
    const teamLookup = new Map(allTeams.map((team) => [team.id, team]));

    const leaguesList = Array.from(leagueCounts.entries())
        .map(([id, matchCount]) => {
            const league = leagueLookup.get(id);
            return league ? { id, name: league.name, slug: league.slug, matchCount } : null;
        })
        .filter((entry): entry is { id: string; name: string; slug: string; matchCount: number } => Boolean(entry))
        .sort((a, b) => b.matchCount - a.matchCount);

    const teamsList = Array.from(teamStats.entries())
        .map(([id, stats]) => {
            const team = teamLookup.get(id);
            if (!team) return null;
            const radiantWinrate = stats.radiantMatches ? (stats.radiantWins / stats.radiantMatches) * 100 : 0;
            const direWinrate = stats.direMatches ? (stats.direWins / stats.direMatches) * 100 : 0;
            const overallWinrate = stats.matches ? ((stats.radiantWins + stats.direWins) / stats.matches) * 100 : 0;
            return {
                id,
                name: team.name,
                slug: team.slug,
                matchCount: stats.matches,
                radiantWinrate,
                direWinrate,
                overallWinrate,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((a, b) => b.matchCount - a.matchCount);

    const monthsSorted = Array.from(new Set([...monthlyDurationAgg.keys(), ...monthlyScoreAgg.keys()])).sort();
    const monthlyDuration = monthsSorted.map((month) => {
        const agg = monthlyDurationAgg.get(month);
        return { month, value: agg && agg.count ? agg.sum / agg.count : 0 };
    });
    const monthlyScore = monthsSorted.map((month) => {
        const agg = monthlyScoreAgg.get(month);
        return { month, value: agg && agg.count ? agg.sum / agg.count : 0 };
    });

    return {
        year,
        totals: {
            totalMatches,
            avgDuration: totalMatches ? durationSum / totalMatches : 0,
            avgScore: totalMatches ? scoreSum / totalMatches : 0,
            avgFirstTowerTime: null,
            radiantWinRate: totalMatches ? (radiantWins / totalMatches) * 100 : 0,
            minScore: Number.isFinite(minScore) ? minScore : 0,
            maxScore: Number.isFinite(maxScore) ? maxScore : 0,
            minScoreMatchId,
            maxScoreMatchId,
            fastestMatchId,
            fastestMatchDuration: Number.isFinite(fastestDuration) ? fastestDuration : null,
            longestMatchId,
            longestMatchDuration: Number.isFinite(longestDuration) ? longestDuration : null,
            lastMatchDate,
        },
        activeLeagues: leagueCounts.size,
        activeTeams: teamStats.size,
        monthlyDuration,
        monthlyScore,
        leagues: leaguesList,
        teams: teamsList,
        pickBan: { picked: [], banned: [], contested: [] },
        topPerformers: [],
    };
}

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
    topPerformers: Array<{
        key: string;
        title: string;
        performer: {
            matchId: string;
            heroId: string | null;
            teamId: string | null;
            accountId: string | null;
            statValue: number;
            kills: number;
            deaths: number;
            assists: number;
        } | null;
    }>;
};

const parsePickBans = (value: unknown): PickBanEntry[] => {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value as PickBanEntry[];
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? (parsed as PickBanEntry[]) : [];
        } catch {
            return [];
        }
    }
    return [];
};

const incrementBucketByHero = (bucket: Record<string, { heroId: string; team: number | null; total: number }>, entry: PickBanEntry) => {
    const heroId = String(entry.hero_id ?? '');
    if (!heroId) {
        return;
    }
    if (!bucket[heroId]) {
        bucket[heroId] = { heroId, team: null, total: 0 };
    }
    bucket[heroId].total += 1;
};

const bucketToSorted = (bucket: Record<string, { heroId: string; team: number | null; total: number }>, limit = 10): PickBanStat[] =>
    Object.values(bucket)
        .sort((a, b) => b.total - a.total)
        .slice(0, limit)
        .map((row) => ({ heroId: row.heroId, team: row.team, total: row.total }));

export async function getLeagueSummaries(): Promise<LeagueSummary[]> {
    if (!supabase) {
        return [];
    }

    return withRedisCache('league-summaries', DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient.from('league_snapshots').select('payload');
        const fromSnapshots = !error && data
            ? data.map((row) => row.payload as LeagueSummary).filter(Boolean)
            : [];

        const { data: viewRows, error: viewError } = await supabaseClient
            .from('league_summary_view')
            .select(LEAGUE_VIEW_COLUMNS);

        if (viewError || !viewRows) {
            return fromSnapshots;
        }

        const byId = new Map(fromSnapshots.map((summary) => [summary.leagueId, summary]));
        for (const row of viewRows as Array<Record<string, unknown>>) {
            const id = String(row.league_id);
            if (byId.has(id)) continue;
            const summary = mapLeagueSummaryView(row);
            if (summary) byId.set(id, summary);
        }
        return Array.from(byId.values());
    });
}

export async function getTeamSummaries(): Promise<TeamSummary[]> {
    if (!supabase) {
        return [];
    }

    return withRedisCache('team-summaries', DAY_IN_SECONDS, async () => {
        const { data, error } = await supabaseClient.from('team_snapshots').select('payload');
        const fromSnapshots = !error && data
            ? data.map((row) => row.payload as TeamSummary).filter(Boolean)
            : [];

        const { data: viewRows, error: viewError } = await supabaseClient
            .from('team_summary_view')
            .select(TEAM_VIEW_COLUMNS);

        if (viewError || !viewRows) {
            return fromSnapshots;
        }

        const byId = new Map(fromSnapshots.map((summary) => [summary.teamId, summary]));
        for (const row of viewRows as Array<Record<string, unknown>>) {
            const id = String(row.team_id);
            if (byId.has(id)) continue;
            const summary = mapTeamSummaryView(row);
            if (summary) byId.set(id, summary);
        }
        return Array.from(byId.values());
    });
}

export async function getLeaguePickBanStats(
    leagueId: string,
    limit = 10,
): Promise<{
    mostPicked: PickBanStat[];
    mostBanned: PickBanStat[];
    mostContested: PickBanStat[];
}> {
    const mostPicked: Record<string, { heroId: string; team: number | null; total: number }> = {};
    const mostBanned: Record<string, { heroId: string; team: number | null; total: number }> = {};
    const mostContested: Record<string, { heroId: string; team: number | null; total: number }> = {};

    const accumulate = (rows: Array<Record<string, unknown>>) => {
        rows.forEach((row) => {
            const entries = parsePickBans(row.picks_bans);
            entries.forEach((entry) => {
                if (entry.is_pick) {
                    incrementBucketByHero(mostPicked, entry);
                } else {
                    incrementBucketByHero(mostBanned, entry);
                }
                incrementBucketByHero(mostContested, entry);
            });
        });
    };

    if (!supabase || !leagueId) {
        return {
            mostPicked: [],
            mostBanned: [],
            mostContested: [],
        };
    }

    return withRedisCache(`pickban:league:${encodeCachePart(leagueId)}:${limit}`, SIX_HOURS_IN_SECONDS, async () => {
        const rows = await paginate<Record<string, unknown>>((from, to) =>
            supabaseClient
                .from('matches')
                .select('picks_bans')
                .eq('league_id', leagueId)
                .range(from, to),
        );
        accumulate(rows);

        return {
            mostPicked: bucketToSorted(mostPicked, limit),
            mostBanned: bucketToSorted(mostBanned, limit),
            mostContested: bucketToSorted(mostContested, limit),
        };
    });
}

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

type HeroAccumulator = {
    heroId: string;
    picks: number;
    bans: number;
    winsWhenPicked: number;
    radiantPicks: number;
    direPicks: number;
    pickOrderSum: number;
    pickOrderCount: number;
    banOrderSum: number;
    banOrderCount: number;
    earliestPickOrder: number | null;
    earliestBanOrder: number | null;
};

type TeamAccumulator = {
    teamId: string;
    matches: number;
    picks: Record<string, number>;
    bans: Record<string, number>;
};

export async function getLeaguePickBanAnalysis(
    leagueId: string,
): Promise<LeaguePickBanAnalysis | null> {
    if (!supabase || !leagueId) {
        return null;
    }

    return withRedisCache(
        `pickban:league-analysis:${encodeCachePart(leagueId)}`,
        SIX_HOURS_IN_SECONDS,
        async () => {
            const heroes: Record<string, HeroAccumulator> = {};
            const teams: Record<string, TeamAccumulator> = {};
            let totalMatches = 0;
            let matchesWithDraft = 0;
            let totalPicks = 0;
            let totalBans = 0;

            const ensureHero = (heroId: string): HeroAccumulator => {
                if (!heroes[heroId]) {
                    heroes[heroId] = {
                        heroId,
                        picks: 0,
                        bans: 0,
                        winsWhenPicked: 0,
                        radiantPicks: 0,
                        direPicks: 0,
                        pickOrderSum: 0,
                        pickOrderCount: 0,
                        banOrderSum: 0,
                        banOrderCount: 0,
                        earliestPickOrder: null,
                        earliestBanOrder: null,
                    };
                }
                return heroes[heroId];
            };

            const ensureTeam = (teamId: string): TeamAccumulator => {
                if (!teams[teamId]) {
                    teams[teamId] = { teamId, matches: 0, picks: {}, bans: {} };
                }
                return teams[teamId];
            };

            const rows = await paginate<Record<string, unknown>>((from, to) =>
                supabaseClient
                    .from('matches')
                    .select('picks_bans,radiant_win,radiant_team_id,dire_team_id')
                    .eq('league_id', leagueId)
                    .range(from, to),
            );

            for (const row of rows) {
                totalMatches += 1;
                const radiantId = row.radiant_team_id ? String(row.radiant_team_id) : null;
                const direId = row.dire_team_id ? String(row.dire_team_id) : null;
                const radiantWin = Boolean(row.radiant_win);
                const entries = parsePickBans(row.picks_bans);

                if (!entries.length) {
                    if (radiantId) ensureTeam(radiantId).matches += 1;
                    if (direId) ensureTeam(direId).matches += 1;
                    continue;
                }

                matchesWithDraft += 1;
                if (radiantId) ensureTeam(radiantId).matches += 1;
                if (direId) ensureTeam(direId).matches += 1;

                entries.forEach((entry) => {
                        const heroId = String(entry.hero_id ?? '');
                        if (!heroId) return;

                        const hero = ensureHero(heroId);
                        const side = entry.team;
                        const order = typeof entry.order === 'number' ? entry.order : null;
                        const teamId = side === 0 ? radiantId : side === 1 ? direId : null;

                        if (entry.is_pick) {
                            hero.picks += 1;
                            totalPicks += 1;
                            if (side === 0) hero.radiantPicks += 1;
                            else if (side === 1) hero.direPicks += 1;

                            const sideWon = side === 0 ? radiantWin : !radiantWin;
                            if (side === 0 || side === 1) {
                                if (sideWon) hero.winsWhenPicked += 1;
                            }

                            if (order !== null) {
                                hero.pickOrderSum += order;
                                hero.pickOrderCount += 1;
                                if (
                                    hero.earliestPickOrder === null ||
                                    order < hero.earliestPickOrder
                                ) {
                                    hero.earliestPickOrder = order;
                                }
                            }

                            if (teamId) {
                                const team = ensureTeam(teamId);
                                team.picks[heroId] = (team.picks[heroId] ?? 0) + 1;
                            }
                        } else {
                            hero.bans += 1;
                            totalBans += 1;

                            if (order !== null) {
                                hero.banOrderSum += order;
                                hero.banOrderCount += 1;
                                if (
                                    hero.earliestBanOrder === null ||
                                    order < hero.earliestBanOrder
                                ) {
                                    hero.earliestBanOrder = order;
                                }
                            }

                            if (teamId) {
                                const team = ensureTeam(teamId);
                                team.bans[heroId] = (team.bans[heroId] ?? 0) + 1;
                            }
                        }
                    });
            }

            const denom = matchesWithDraft || 1;
            const heroList: LeagueDraftHero[] = Object.values(heroes)
                .map((hero) => {
                    const contested = hero.picks + hero.bans;
                    return {
                        heroId: hero.heroId,
                        picks: hero.picks,
                        bans: hero.bans,
                        contested,
                        contestRate: matchesWithDraft ? (contested / denom) * 100 : 0,
                        pickRate: matchesWithDraft ? (hero.picks / denom) * 100 : 0,
                        banRate: matchesWithDraft ? (hero.bans / denom) * 100 : 0,
                        winsWhenPicked: hero.winsWhenPicked,
                        winRate: hero.picks > 0 ? (hero.winsWhenPicked / hero.picks) * 100 : null,
                        radiantPicks: hero.radiantPicks,
                        direPicks: hero.direPicks,
                        avgPickOrder: hero.pickOrderCount
                            ? hero.pickOrderSum / hero.pickOrderCount
                            : null,
                        avgBanOrder: hero.banOrderCount
                            ? hero.banOrderSum / hero.banOrderCount
                            : null,
                        earliestPickOrder: hero.earliestPickOrder,
                        earliestBanOrder: hero.earliestBanOrder,
                    };
                })
                .sort((a, b) => b.contested - a.contested);

            const topByCount = (record: Record<string, number>, limit = 5) =>
                Object.entries(record)
                    .map(([heroId, total]) => ({ heroId, total }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, limit);

            const teamList: LeagueDraftTeamSnapshot[] = Object.values(teams)
                .filter((team) => team.matches > 0)
                .sort((a, b) => b.matches - a.matches)
                .slice(0, 12)
                .map((team) => ({
                    teamId: team.teamId,
                    matches: team.matches,
                    topPicks: topByCount(team.picks, 5),
                    topBans: topByCount(team.bans, 5),
                }));

            const uniqueHeroesPicked = heroList.filter((h) => h.picks > 0).length;
            const uniqueHeroesBanned = heroList.filter((h) => h.bans > 0).length;

            return {
                totalMatches,
                matchesWithDraft,
                totalPicks,
                totalBans,
                uniqueHeroesPicked,
                uniqueHeroesBanned,
                uniqueHeroesSeen: heroList.length,
                heroes: heroList,
                teams: teamList,
            };
        },
    );
}

export async function getTeamPickBanStats(
    teamId: string,
    limit = 10,
): Promise<{
    mostPicked: PickBanStat[];
    mostBanned: PickBanStat[];
    mostContested: PickBanStat[];
}> {
    const mostPicked: Record<string, { heroId: string; team: number | null; total: number }> = {};
    const mostBanned: Record<string, { heroId: string; team: number | null; total: number }> = {};
    const mostContested: Record<string, { heroId: string; team: number | null; total: number }> = {};

    const accumulate = (rows: Array<Record<string, unknown>>) => {
        rows.forEach((row) => {
            const radiantId = row.radiant_team_id ? String(row.radiant_team_id) : null;
            const direId = row.dire_team_id ? String(row.dire_team_id) : null;
            const side = radiantId === teamId ? 0 : direId === teamId ? 1 : null;
            if (side === null) {
                return;
            }

            const entries = parsePickBans(row.picks_bans);
            entries.forEach((entry) => {
                if (Number(entry.team ?? -1) !== side) {
                    return;
                }
                if (entry.is_pick) {
                    incrementBucketByHero(mostPicked, entry);
                } else {
                    incrementBucketByHero(mostBanned, entry);
                }
                incrementBucketByHero(mostContested, entry);
            });
        });
    };

    if (!supabase || !teamId || !isNumericId(teamId)) {
        return {
            mostPicked: [],
            mostBanned: [],
            mostContested: [],
        };
    }

    return withRedisCache(`pickban:team:${encodeCachePart(teamId)}:${limit}`, SIX_HOURS_IN_SECONDS, async () => {
        const rows = await paginate<Record<string, unknown>>((from, to) =>
            supabaseClient
                .from('matches')
                .select('picks_bans,radiant_team_id,dire_team_id')
                .or(teamOrFilter(teamId))
                .range(from, to),
        );
        accumulate(rows);

        return {
            mostPicked: bucketToSorted(mostPicked, limit),
            mostBanned: bucketToSorted(mostBanned, limit),
            mostContested: bucketToSorted(mostContested, limit),
        };
    });
}

