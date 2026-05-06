import { setRequestLocale, getTranslations } from 'next-intl/server';

import { YearlyMetricLine } from '@/components/charts/yearly-metric-line';
import { ShareButton } from '@/components/share-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { createHeroImageResolver } from '@/lib/hero';
import { getPatchStaticParams } from '@/lib/static-params';
import { getHeroes, getLeagues, getMatchesByPatch, getPatchBySlug, getPlayersByIds, getTeams, getTopPerformersByPatch } from '@/lib/supabase/queries';

interface PatchPageProps {
    params: Promise<{ locale: string; patch: string }>;
}

const formatMinutes = (seconds: number) => `${(seconds / 60).toFixed(1)} min`;

export async function generateStaticParams() {
    const slugs = await getPatchStaticParams();
    return routing.locales.flatMap((locale) =>
        slugs.map((entry) => ({ locale, patch: entry.patch })),
    );
}

export async function generateMetadata({ params }: PatchPageProps) {
    const { locale, patch } = await params;
    const patchEntry = await getPatchBySlug(patch);
    const t = await getTranslations({ locale, namespace: 'patch' });
    const localePath = locale === routing.defaultLocale ? '' : `/${locale}`;

    if (!patchEntry) {
        return { title: 'Patch not found' };
    }

    const title = t('header.heading', { patch: patchEntry.patch });
    const description = t('header.lead', { patch: patchEntry.patch });
    const path = `${localePath}/patches/${patchEntry.patch}`;

    return {
        title,
        description,
        openGraph: { title, description, type: 'article' as const, url: path },
        twitter: { card: 'summary_large_image' as const, title, description },
        alternates: {
            canonical: path,
            languages: { en: `/patches/${patchEntry.patch}`, ru: `/ru/patches/${patchEntry.patch}` },
        },
    };
}

export const revalidate = 86400;

export default async function PatchPage({ params }: PatchPageProps) {
    const { locale, patch } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('patch');
    const patchEntry = await getPatchBySlug(patch);

    if (!patchEntry) {
        return <div className="py-20 text-center text-muted-foreground">Patch not found.</div>;
    }

    const [matches, leagues, teams, heroes, topPerformers] = await Promise.all([
        getMatchesByPatch(patchEntry.id),
        getLeagues(),
        getTeams(),
        getHeroes(),
        getTopPerformersByPatch(patchEntry.id),
    ]);

    const performerAccountIds = topPerformers
        .map((entry) => entry.performer?.accountId)
        .filter((value): value is string => Boolean(value));
    const playerLookup = await getPlayersByIds(performerAccountIds);

    if (!matches.length) {
        return (
            <div className="space-y-6">
                <section className="space-y-3">
                    <Badge className="w-fit bg-primary/10 text-primary">{t('header.badge')}</Badge>
                    <h1 className="font-display text-3xl font-semibold md:text-4xl">Patch {patchEntry.patch}</h1>
                    <p className="max-w-2xl text-muted-foreground">There are no matches stored for this patch yet.</p>
                </section>
            </div>
        );
    }

    const summary = matches.reduce(
        (acc, match) => {
            acc.totalMatches += 1;
            acc.durationSum += match.duration;
            acc.scoreSum += match.radiantScore + match.direScore;
            if (match.radiantWin) {
                acc.radiantWins += 1;
            }
            if (match.firstTowerTime != null) {
                acc.firstTowerSum += match.firstTowerTime;
                acc.firstTowerCount += 1;
            }
            if (!acc.fastest || match.duration < acc.fastest.duration) {
                acc.fastest = match;
            }
            if (!acc.longest || match.duration > acc.longest.duration) {
                acc.longest = match;
            }
            const start = match.startTime;
            if (!acc.latest || (start && new Date(start) > new Date(acc.latest))) {
                acc.latest = start;
            }
            return acc;
        },
        {
            totalMatches: 0,
            durationSum: 0,
            scoreSum: 0,
            radiantWins: 0,
            fastest: null as (typeof matches)[number] | null,
            longest: null as (typeof matches)[number] | null,
            latest: null as string | null,
            firstTowerSum: 0,
            firstTowerCount: 0,
        },
    );

    const avgDuration = summary.totalMatches ? summary.durationSum / summary.totalMatches : 0;
    const avgScore = summary.totalMatches ? summary.scoreSum / summary.totalMatches : 0;
    const radiantWinrate = summary.totalMatches ? (summary.radiantWins / summary.totalMatches) * 100 : 0;
    const direWinrate = 100 - radiantWinrate;
    const avgFirstTower = summary.firstTowerCount ? summary.firstTowerSum / summary.firstTowerCount : null;

    const durationByDay = Array.from(
        matches.reduce((acc, match) => {
            const dateKey = match.startTime ? match.startTime.slice(0, 10) : null;
            if (!dateKey) {
                return acc;
            }
            if (!acc.has(dateKey)) {
                acc.set(dateKey, { totalDuration: 0, count: 0 });
            }
            const entry = acc.get(dateKey);
            if (!entry) {
                return acc;
            }
            entry.totalDuration += Number(match.duration ?? 0);
            entry.count += 1;
            return acc;
        }, new Map<string, { totalDuration: number; count: number }>()),
    )
        .map(([dateKey, entry]) => ({
            month: dateKey,
            value: Number((entry.totalDuration / entry.count / 60).toFixed(1)),
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

    const leagueLookup = new Map(leagues.map((league) => [league.id, league]));
    const teamLookup = new Map(teams.map((team) => [team.id, team]));
    const heroLookup = new Map(heroes.map((hero) => [hero.id, hero.localizedName]));
    const buildHeroImageUrl = createHeroImageResolver(heroes);
    const leagueStats = matches.reduce<Record<string, { matchCount: number; radiantWins: number }>>((acc, match) => {
        const leagueId = match.leagueId ?? '';
        if (!leagueId) {
            return acc;
        }
        if (!acc[leagueId]) {
            acc[leagueId] = { matchCount: 0, radiantWins: 0 };
        }
        acc[leagueId].matchCount += 1;
        if (match.radiantWin) {
            acc[leagueId].radiantWins += 1;
        }
        return acc;
    }, {});

    const leagueRows = Object.entries(leagueStats)
        .map(([leagueId, stats]) => {
            const league = leagueLookup.get(leagueId);
            if (!league) {
                return null;
            }
            const radiantRate = stats.matchCount ? (stats.radiantWins / stats.matchCount) * 100 : 0;
            return {
                id: league.id,
                name: league.name,
                slug: league.slug,
                startDate: league.startDate,
                endDate: league.endDate,
                matchCount: stats.matchCount,
                radiantWinrate: Number(radiantRate.toFixed(1)),
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((a, b) => b.matchCount - a.matchCount);

    const teamStats = new Map<
        string,
        {
            matchCount: number;
            radiantMatches: number;
            direMatches: number;
            radiantWins: number;
            direWins: number;
        }
    >();

    matches.forEach((match) => {
        const updateTeam = (teamId: string | null, isRadiant: boolean) => {
            if (!teamId) {
                return;
            }
            if (!teamStats.has(teamId)) {
                teamStats.set(teamId, {
                    matchCount: 0,
                    radiantMatches: 0,
                    direMatches: 0,
                    radiantWins: 0,
                    direWins: 0,
                });
            }
            const entry = teamStats.get(teamId);
            if (!entry) {
                return;
            }
            entry.matchCount += 1;
            if (isRadiant) {
                entry.radiantMatches += 1;
                if (match.radiantWin) {
                    entry.radiantWins += 1;
                }
            } else {
                entry.direMatches += 1;
                if (!match.radiantWin) {
                    entry.direWins += 1;
                }
            }
        };

        updateTeam(match.radiantTeamId, true);
        updateTeam(match.direTeamId, false);
    });

    const teamRows = Array.from(teamStats.entries())
        .map(([teamId, stats]) => {
            const team = teamLookup.get(teamId);
            if (!team) {
                return null;
            }
            const overallRate = stats.matchCount ? ((stats.radiantWins + stats.direWins) / stats.matchCount) * 100 : 0;
            const radiantRate = stats.radiantMatches ? (stats.radiantWins / stats.radiantMatches) * 100 : 0;
            const direRate = stats.direMatches ? (stats.direWins / stats.direMatches) * 100 : 0;
            return {
                id: teamId,
                name: team.name,
                slug: team.slug,
                matchCount: stats.matchCount,
                overallWinrate: Number(overallRate.toFixed(1)),
                radiantWinrate: Number(radiantRate.toFixed(1)),
                direWinrate: Number(direRate.toFixed(1)),
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((a, b) => b.matchCount - a.matchCount)
        .slice(0, 12);

    const pickBanBuckets = matches.reduce<{
        picked: Record<string, number>;
        banned: Record<string, number>;
        contested: Record<string, number>;
    }>(
        (acc, match) => {
            const entries = Array.isArray(match.picksBans) ? match.picksBans : [];
            entries.forEach((entry) => {
                const heroId = String(entry.hero_id ?? '');
                if (!heroId) {
                    return;
                }
                if (entry.is_pick) {
                    acc.picked[heroId] = (acc.picked[heroId] ?? 0) + 1;
                } else {
                    acc.banned[heroId] = (acc.banned[heroId] ?? 0) + 1;
                }
                acc.contested[heroId] = (acc.contested[heroId] ?? 0) + 1;
            });
            return acc;
        },
        {
            picked: {},
            banned: {},
            contested: {},
        },
    );

    const toTopHeroes = (bucket: Record<string, number>, limit = 5) =>
        Object.entries(bucket)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([heroId, total]) => ({ heroId, total }));

    return (
        <div className="space-y-10">
            <section className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <Badge className="w-fit bg-primary/10 text-primary">{t('header.badge')}</Badge>
                    <ShareButton
                        title={`Dota 2 Patch ${patchEntry.patch}`}
                        text={`🔧 Patch ${patchEntry.patch}: ${formatNumber(matches.length)} matches — meta trends and league activity on DotaData`}
                        url={`/patches/${encodeURIComponent(patchEntry.patch)}`}
                    />
                </div>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <h1 className="font-display text-3xl font-semibold md:text-4xl">Patch {patchEntry.patch}</h1>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/patches/${encodeURIComponent(patchEntry.patch)}/handicap`}>{t('header.handicapAnalysis')}</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/patches/${encodeURIComponent(patchEntry.patch)}/handicap/general`}>{t('header.generalHandicapTable')}</Link>
                        </Button>
                    </div>
                </div>
                <p className="max-w-2xl text-muted-foreground">{t('header.lead', { patch: patchEntry.patch })}</p>
            </section>

            <section className="grid gap-6 md:grid-cols-5">
                <Card className="border-border/60 bg-card/80">
                    <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground">Matches</p>
                        <p className="text-3xl font-semibold text-primary">{formatNumber(summary.totalMatches)}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/80">
                    <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground">Avg Duration</p>
                        <p className="text-3xl font-semibold text-foreground">{formatMinutes(avgDuration)}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/80">
                    <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground">Avg Score</p>
                        <p className="text-3xl font-semibold text-foreground">{avgScore.toFixed(1)}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/80">
                    <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground">Avg First Tower</p>
                        <p className="text-3xl font-semibold text-foreground">{avgFirstTower ? formatMinutes(avgFirstTower) : 'N/A'}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/80">
                    <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground">Radiant Winrate</p>
                        <p className="text-3xl font-semibold text-foreground">{formatPercent(radiantWinrate)}</p>
                    </CardContent>
                </Card>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
                <Card className="border-border/60 bg-card/80">
                    <CardHeader>
                        <CardTitle>Fastest Match</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <p>Duration: {summary.fastest ? formatMinutes(summary.fastest.duration) : 'N/A'}</p>
                        <p>Match ID: {summary.fastest?.id ?? 'N/A'}</p>
                        <p>Start: {summary.fastest?.startTime ? formatDate(summary.fastest.startTime) : 'N/A'}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/80">
                    <CardHeader>
                        <CardTitle>Longest Match</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <p>Duration: {summary.longest ? formatMinutes(summary.longest.duration) : 'N/A'}</p>
                        <p>Match ID: {summary.longest?.id ?? 'N/A'}</p>
                        <p>Start: {summary.longest?.startTime ? formatDate(summary.longest.startTime) : 'N/A'}</p>
                    </CardContent>
                </Card>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
                <Card className="border-border/60 bg-card/80">
                    <CardHeader>
                        <CardTitle>Side Winrate</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                            <p className="text-sm font-semibold text-emerald-300">Radiant</p>
                            <p className="text-2xl font-semibold text-emerald-100">{formatPercent(radiantWinrate)}</p>
                        </div>
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                            <p className="text-sm font-semibold text-red-300">Dire</p>
                            <p className="text-2xl font-semibold text-red-100">{formatPercent(direWinrate)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/80">
                    <CardHeader>
                        <CardTitle>Avg Duration by Day</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <YearlyMetricLine data={durationByDay} color="#54d2b4" />
                    </CardContent>
                </Card>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
                {[
                    { title: 'Most Picked', entries: toTopHeroes(pickBanBuckets.picked) },
                    { title: 'Most Banned', entries: toTopHeroes(pickBanBuckets.banned) },
                    { title: 'Most Contested', entries: toTopHeroes(pickBanBuckets.contested) },
                ].map((group) => (
                    <Card key={group.title} className="border-border/60 bg-card/80">
                        <CardHeader>
                            <CardTitle>{group.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {group.entries.length ? (
                                group.entries.map((entry) => {
                                    const heroName = heroLookup.get(entry.heroId) ?? entry.heroId;
                                    const heroImage = buildHeroImageUrl(entry.heroId);
                                    return (
                                        <div
                                            key={entry.heroId}
                                            className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                                        >
                                            <div className="h-8 w-8 overflow-hidden rounded-md border border-border/60 bg-muted">
                                                {heroImage ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={heroImage} alt={heroName} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                                        N/A
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-foreground">{heroName}</p>
                                            </div>
                                            <div className="text-sm font-semibold text-primary">{formatNumber(entry.total)}</div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-sm text-muted-foreground">No picks/bans data yet.</p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </section>

            <Card className="border-border/60 bg-card/80">
                <CardHeader>
                    <CardTitle>Top Performers</CardTitle>
                </CardHeader>
                <CardContent>
                    {topPerformers.some((entry) => entry.performer) ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {topPerformers.map((entry) => {
                                if (!entry.performer) {
                                    return (
                                        <div key={entry.key} className="rounded-lg border border-border/60 bg-background/40 p-4">
                                            <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                                            <p className="mt-2 text-sm text-muted-foreground">No data available.</p>
                                        </div>
                                    );
                                }

                                const performer = entry.performer;
                                const heroName = performer.heroId ? (heroLookup.get(performer.heroId) ?? performer.heroId) : 'Unknown';
                                const heroImage = buildHeroImageUrl(performer.heroId);

                                return (
                                    <div key={entry.key} className="rounded-lg border border-border/60 bg-background/40 p-4">
                                        <div className="flex items-start gap-4">
                                            <div className="h-14 w-14 overflow-hidden rounded-lg border border-border/60 bg-muted">
                                                {heroImage ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={heroImage} alt={heroName} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                                                        N/A
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                                                <p className="mt-1 text-2xl font-semibold text-primary">{formatNumber(performer.statValue)}</p>
                                                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                                    <p>
                                                        Player:{' '}
                                                        <span className="text-foreground">
                                                            {performer.accountId
                                                                ? (playerLookup.get(performer.accountId) ?? `Player ${performer.accountId}`)
                                                                : 'Unknown'}
                                                        </span>
                                                    </p>
                                                    <p>Hero: <span className="text-foreground">{heroName}</span></p>
                                                    <p>
                                                        Team:{' '}
                                                        <span className="text-foreground">
                                                            {performer.teamId ? (teamLookup.get(performer.teamId)?.name ?? performer.teamId) : 'Unknown'}
                                                        </span>
                                                    </p>
                                                    <p>
                                                        KDA: <span className="text-foreground">{performer.kills}/{performer.deaths}/{performer.assists}</span>
                                                    </p>
                                                    <p className="text-xs">Match ID: {performer.matchId}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No player match data available yet.</p>
                    )}
                </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80">
                <CardHeader>
                    <CardTitle>Top Teams in this Patch</CardTitle>
                    <p className="text-sm text-muted-foreground">Teams ranked by match volume during this patch.</p>
                </CardHeader>
                <CardContent>
                    {teamRows.length ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full border border-border/60 text-sm">
                                <thead className="bg-muted/60">
                                    <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                                        <th className="px-4 py-3">Team</th>
                                        <th className="px-4 py-3">Matches</th>
                                        <th className="px-4 py-3">Overall</th>
                                        <th className="px-4 py-3">Radiant</th>
                                        <th className="px-4 py-3">Dire</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamRows.map((team) => (
                                        <tr key={team.id} className="border-t border-border/60">
                                            <td className="px-4 py-3 font-semibold text-primary">
                                                <Link href={`/teams/${team.slug ?? team.id}`}>{team.name}</Link>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{formatNumber(team.matchCount)}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{formatPercent(team.overallWinrate)}</td>
                                            <td className="px-4 py-3 text-emerald-200">{formatPercent(team.radiantWinrate)}</td>
                                            <td className="px-4 py-3 text-red-200">{formatPercent(team.direWinrate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No team data available for this patch.</p>
                    )}
                </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80">
                <CardHeader>
                    <CardTitle>Leagues in this Patch</CardTitle>
                    <p className="text-sm text-muted-foreground">Leagues ranked by match volume during {patchEntry.patch}.</p>
                </CardHeader>
                <CardContent>
                    {leagueRows.length ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full border border-border/60 text-sm">
                                <thead className="bg-muted/60">
                                    <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                                        <th className="px-4 py-3">League</th>
                                        <th className="px-4 py-3">Start</th>
                                        <th className="px-4 py-3">End</th>
                                        <th className="px-4 py-3">Matches</th>
                                        <th className="px-4 py-3">Radiant Winrate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leagueRows.map((league) => (
                                        <tr key={league.id} className="border-t border-border/60">
                                            <td className="px-4 py-3 font-semibold text-primary">
                                                <Link href={`/leagues/${league.slug ?? league.id}`}>{league.name}</Link>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{formatDate(league.startDate)}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{formatDate(league.endDate)}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{formatNumber(league.matchCount)}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{formatPercent(league.radiantWinrate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No league data available for this patch.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
