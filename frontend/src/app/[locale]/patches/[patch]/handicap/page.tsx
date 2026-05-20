import { setRequestLocale, getTranslations } from 'next-intl/server';

import { ShareButton } from '@/components/share-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HandicapTable } from '@/components/handicap-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { formatNumber, formatPercent } from '@/lib/format';
import { getPatchStaticParams } from '@/lib/static-params';
import { getMatchesByPatch, getPatchBySlug, getTeamsByIds } from '@/lib/supabase/queries';
import type { Match, Team } from '@/lib/types';

interface PatchHandicapPageProps {
    params: Promise<{ locale: string; patch: string }>;
    searchParams?: Promise<{ team1?: string; team2?: string }>;
}

type HandicapBuckets = Record<string, number>;

type TeamHandicapData = {
    team: Team;
    totalMatches: number;
    victories: number;
    losses: number;
    avgKillDifference: number;
    avgDurationMinutes: number;
    handicap: {
        counts: {
            victories: HandicapBuckets;
            losses: HandicapBuckets;
            general: HandicapBuckets;
        };
        percentages: {
            victories: HandicapBuckets;
            losses: HandicapBuckets;
            general: HandicapBuckets;
        };
    };
};

const formatHandicap = (value: number) => (value % 1 === 0 ? value.toFixed(0) : value.toFixed(1));

const buildHandicapRange = () => {
    const range: string[] = [];
    for (let value = -16.5; value <= 0; value += 2.0) {
        range.push(formatHandicap(value));
    }
    for (let value = 0.5; value <= 16.5; value += 2.0) {
        range.push(formatHandicap(value));
    }
    return range;
};

const createBuckets = (handicapRange: string[]) => Object.fromEntries(handicapRange.map((handicap) => [handicap, 0])) as HandicapBuckets;

const applyHandicapRange = (killDifference: number, handicapRange: string[], handicapValues: number[], bucket: HandicapBuckets) => {
    for (let i = 0; i < handicapRange.length; i += 1) {
        if (killDifference + handicapValues[i] > 0) {
            bucket[handicapRange[i]] = (bucket[handicapRange[i]] ?? 0) + 1;
        }
    }
};

const calculatePercentages = (handicapRange: string[], counts: HandicapBuckets, total: number) => {
    const percentages: HandicapBuckets = {};
    handicapRange.forEach((handicap) => {
        const value = total > 0 ? Number(((Number(counts[handicap] ?? 0) / total) * 100).toFixed(2)) : 0;
        percentages[handicap] = value;
    });
    return percentages;
};

const calculateTeamHandicapData = (matches: Match[], team: Team, handicapRange: string[]): TeamHandicapData => {
    const handicapValues = handicapRange.map((value) => Number(value));
    const counts = {
        victories: createBuckets(handicapRange),
        losses: createBuckets(handicapRange),
        general: createBuckets(handicapRange),
    };

    let totalMatches = 0;
    let victories = 0;
    let losses = 0;
    let killSum = 0;
    let durationSum = 0;

    matches.forEach((match) => {
        const isRadiant = match.radiantTeamId === team.id;
        const isDire = match.direTeamId === team.id;
        if (!isRadiant && !isDire) {
            return;
        }

        const teamWon = (isRadiant && match.radiantWin) || (isDire && !match.radiantWin);
        const killDifference = isRadiant ? match.radiantScore - match.direScore : match.direScore - match.radiantScore;

        totalMatches += 1;
        killSum += killDifference;
        durationSum += Number(match.duration ?? 0);

        applyHandicapRange(killDifference, handicapRange, handicapValues, counts.general);
        if (teamWon) {
            victories += 1;
            applyHandicapRange(killDifference, handicapRange, handicapValues, counts.victories);
        } else {
            losses += 1;
            applyHandicapRange(killDifference, handicapRange, handicapValues, counts.losses);
        }
    });

    const percentages = {
        victories: calculatePercentages(handicapRange, counts.victories, victories),
        losses: calculatePercentages(handicapRange, counts.losses, losses),
        general: calculatePercentages(handicapRange, counts.general, totalMatches),
    };

    return {
        team,
        totalMatches,
        victories,
        losses,
        avgKillDifference: totalMatches ? Number((killSum / totalMatches).toFixed(2)) : 0,
        avgDurationMinutes: totalMatches ? Number((durationSum / totalMatches / 60).toFixed(1)) : 0,
        handicap: {
            counts,
            percentages,
        },
    };
};

const TeamSummaryCard = ({ data }: { data: TeamHandicapData }) => (
    <Card className="border-border/60 bg-card/80">
        <CardHeader>
            <CardTitle className="text-primary">{data.team.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
                {formatNumber(data.totalMatches)} matches | {formatPercent(data.totalMatches ? (data.victories / data.totalMatches) * 100 : 0)}{' '}
                winrate
            </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
            {[
                { label: 'Victories', value: formatNumber(data.victories) },
                { label: 'Losses', value: formatNumber(data.losses) },
                { label: 'Avg Kill Diff', value: data.avgKillDifference.toFixed(2) },
                { label: 'Avg Duration', value: `${data.avgDurationMinutes.toFixed(1)}m` },
            ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border/60 bg-background/40 p-4">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>
                </div>
            ))}
        </CardContent>
    </Card>
);

export const revalidate = 86400;

export async function generateStaticParams() {
    const slugs = await getPatchStaticParams();
    return routing.locales.flatMap((locale) =>
        slugs.map((entry) => ({ locale, patch: entry.patch })),
    );
}

export async function generateMetadata({ params }: PatchHandicapPageProps) {
    const { locale, patch } = await params;
    const patchEntry = await getPatchBySlug(patch);
    const t = await getTranslations({ locale, namespace: 'patchHandicap' });
    const localePath = locale === routing.defaultLocale ? '' : `/${locale}`;
    if (!patchEntry) {
        return { title: t('header.heading', { patch }) };
    }
    const title = t('header.heading', { patch: patchEntry.patch });
    const description = t('header.lead', { patch: patchEntry.patch });
    return {
        title,
        description,
        alternates: {
            canonical: `${localePath}/patches/${patchEntry.patch}/handicap`,
            languages: {
                en: `/patches/${patchEntry.patch}/handicap`,
                ru: `/ru/patches/${patchEntry.patch}/handicap`,
            },
        },
    };
}

export default async function PatchHandicapPage({ params, searchParams }: PatchHandicapPageProps) {
    const { locale, patch } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('patchHandicap');
    const tc = await getTranslations('common');
    const patchEntry = await getPatchBySlug(patch);

    if (!patchEntry) {
        return <div className="py-20 text-center text-muted-foreground">Patch not found.</div>;
    }

    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const team1Input = resolvedSearchParams?.team1?.trim() ?? '';
    const team2Input = resolvedSearchParams?.team2?.trim() ?? '';

    const matches = await getMatchesByPatch(patchEntry.id);
    const handicapRange = buildHandicapRange();

    const participatingTeamIds = Array.from(
        matches.reduce((acc, match) => {
            if (match.radiantTeamId) {
                acc.add(match.radiantTeamId);
            }
            if (match.direTeamId) {
                acc.add(match.direTeamId);
            }
            return acc;
        }, new Set<string>()),
    );

    const teams = await getTeamsByIds(participatingTeamIds);
    const teamLookup = new Map<string, Team>();
    teams.forEach((team) => {
        if (team.slug) {
            teamLookup.set(team.slug, team);
        }
        teamLookup.set(team.id, team);
    });

    const team1 = team1Input ? (teamLookup.get(team1Input) ?? null) : null;
    const team2 = team2Input ? (teamLookup.get(team2Input) ?? null) : null;

    const team1Data = team1 ? calculateTeamHandicapData(matches, team1, handicapRange) : null;
    const team2Data = team2 ? calculateTeamHandicapData(matches, team2, handicapRange) : null;

    const headToHead =
        team1 && team2
            ? (() => {
                  let team1Wins = 0;
                  let team2Wins = 0;
                  let total = 0;

                  matches.forEach((match) => {
                      const radiant = match.radiantTeamId;
                      const dire = match.direTeamId;
                      if (!radiant || !dire) {
                          return;
                      }
                      const isMatch = (radiant === team1.id && dire === team2.id) || (radiant === team2.id && dire === team1.id);
                      if (!isMatch) {
                          return;
                      }
                      total += 1;
                      const team1IsRadiant = radiant === team1.id;
                      const team1Won = (team1IsRadiant && match.radiantWin) || (!team1IsRadiant && !match.radiantWin);
                      if (team1Won) {
                          team1Wins += 1;
                      } else {
                          team2Wins += 1;
                      }
                  });

                  return { total, team1Wins, team2Wins };
              })()
            : null;

    return (
        <div className="space-y-10">
            <section className="rounded-2xl border border-border/60 bg-card/80 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <Badge className="w-fit bg-primary/10 text-primary">{t('header.badge')}</Badge>
                        <h1 className="font-display mt-3 text-3xl font-semibold md:text-4xl">{t('header.heading', { patch: patchEntry.patch })}</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {t('header.lead', { patch: patchEntry.patch })}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button asChild variant="outline">
                            <Link href={`/patches/${encodeURIComponent(patchEntry.patch)}`}>{tc('backToPatch')}</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href={`/patches/${encodeURIComponent(patchEntry.patch)}/handicap/general`}>{t('header.generalTable')}</Link>
                        </Button>
                        <ShareButton
                            title={t('header.heading', { patch: patchEntry.patch })}
                            text={t('shareText', { patch: patchEntry.patch })}
                            url={`/patches/${encodeURIComponent(patchEntry.patch)}/handicap`}
                        />
                    </div>
                </div>

                <form method="GET" className="mt-6 grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" htmlFor="team1">
                            Team 1 (required)
                        </label>
                        <Input id="team1" name="team1" list="patch-teams" placeholder="team-slug or team-id" defaultValue={team1Input} required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" htmlFor="team2">
                            Team 2 (optional)
                        </label>
                        <Input id="team2" name="team2" list="patch-teams" placeholder="team-slug or team-id" defaultValue={team2Input} />
                    </div>
                    <div className="flex items-end">
                        <Button type="submit" className="w-full">
                            Analyze
                        </Button>
                    </div>
                    <datalist id="patch-teams">
                        {teams.map((team) => (
                            <option key={team.id} value={team.slug || team.id}>
                                {team.name}
                            </option>
                        ))}
                    </datalist>
                </form>
            </section>

            {!team1Input ? (
                <Card className="border-border/60 bg-card/80">
                    <CardContent className="p-6 text-sm text-muted-foreground">Select a team to generate handicap tables for this patch.</CardContent>
                </Card>
            ) : !team1 ? (
                <Card className="border-border/60 bg-card/80">
                    <CardContent className="p-6 text-sm text-muted-foreground">
                        Team &quot;{team1Input}&quot; not found for patch {patchEntry.patch}. Use the suggestions from the dropdown.
                    </CardContent>
                </Card>
            ) : (
                <>
                    <section className={`grid gap-6 ${team2Data ? 'lg:grid-cols-2' : ''}`}>
                        {team1Data ? <TeamSummaryCard data={team1Data} /> : null}
                        {team2Data ? <TeamSummaryCard data={team2Data} /> : null}
                    </section>

                    {headToHead ? (
                        <Card className="border-border/60 bg-card/80">
                            <CardHeader>
                                <CardTitle>Head-to-head in Patch {patchEntry.patch}</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Matches</p>
                                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(headToHead.total)}</p>
                                </div>
                                <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{team1.name} wins</p>
                                    <p className="mt-2 text-2xl font-semibold text-emerald-200">{formatNumber(headToHead.team1Wins)}</p>
                                </div>
                                <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        {team2?.name ?? 'Team 2'} wins
                                    </p>
                                    <p className="mt-2 text-2xl font-semibold text-red-200">{formatNumber(headToHead.team2Wins)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}

                    {(
                        [
                            {
                                key: 'victories' as const,
                                title: 'Victory Matches',
                                accent: 'text-emerald-200',
                                note: 'Handicap success rates when the team won the match.',
                            },
                            {
                                key: 'losses' as const,
                                title: 'Loss Matches',
                                accent: 'text-red-200',
                                note: 'Handicap success rates when the team lost the match.',
                            },
                            {
                                key: 'general' as const,
                                title: 'General Matches',
                                accent: 'text-primary',
                                note: 'Overall handicap success rate across all matches.',
                            },
                        ] as const
                    ).map((section) => (
                        <Card key={section.key} className="border-border/60 bg-card/80">
                            <CardHeader>
                                <CardTitle>{section.title}</CardTitle>
                                <p className="text-sm text-muted-foreground">{section.note}</p>
                            </CardHeader>
                            <CardContent className={`grid gap-6 ${team2Data ? 'lg:grid-cols-2' : ''}`}>
                                {team1Data ? (
                                    <div>
                                        <p className="mb-3 text-sm font-semibold text-foreground">{team1Data.team.name}</p>
                                        <HandicapTable handicapRange={handicapRange} data={team1Data} type={section.key} accent={section.accent} />
                                    </div>
                                ) : null}
                                {team2Data ? (
                                    <div>
                                        <p className="mb-3 text-sm font-semibold text-foreground">{team2Data.team.name}</p>
                                        <HandicapTable handicapRange={handicapRange} data={team2Data} type={section.key} accent={section.accent} />
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>
                    ))}
                </>
            )}
        </div>
    );
}
