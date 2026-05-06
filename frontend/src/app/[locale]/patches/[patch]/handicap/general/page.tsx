import { setRequestLocale, getTranslations } from 'next-intl/server';

import { ShareButton } from '@/components/share-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HandicapGeneralTable } from '@/components/handicap-general-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getPatchStaticParams } from '@/lib/static-params';
import { getMatchesByPatch, getPatchBySlug, getTeamsByIds } from '@/lib/supabase/queries';
import type { Match, Team } from '@/lib/types';

interface PatchHandicapGeneralPageProps {
    params: Promise<{ locale: string; patch: string }>;
    searchParams?: Promise<{ search?: string }>;
}

type HandicapBuckets = Record<string, number>;

type TeamBuckets = {
    totalMatches: number;
    victories: number;
    losses: number;
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
        percentages[handicap] = total > 0 ? Number(((Number(counts[handicap] ?? 0) / total) * 100).toFixed(2)) : 0;
    });
    return percentages;
};

const initBucketsByTeam = (teams: Team[], handicapRange: string[]) => {
    const buckets = new Map<string, TeamBuckets>();
    teams.forEach((team) => {
        buckets.set(team.id, {
            totalMatches: 0,
            victories: 0,
            losses: 0,
            counts: {
                victories: createBuckets(handicapRange),
                losses: createBuckets(handicapRange),
                general: createBuckets(handicapRange),
            },
            percentages: {
                victories: createBuckets(handicapRange),
                losses: createBuckets(handicapRange),
                general: createBuckets(handicapRange),
            },
        });
    });
    return buckets;
};

const accumulateMatchForTeam = (
    match: Match,
    teamId: string,
    isRadiant: boolean,
    handicapRange: string[],
    handicapValues: number[],
    bucketsByTeam: Map<string, TeamBuckets>,
) => {
    const buckets = bucketsByTeam.get(teamId);
    if (!buckets) {
        return;
    }

    const killDifference = isRadiant ? match.radiantScore - match.direScore : match.direScore - match.radiantScore;
    const teamWon = isRadiant ? match.radiantWin : !match.radiantWin;

    buckets.totalMatches += 1;
    applyHandicapRange(killDifference, handicapRange, handicapValues, buckets.counts.general);

    if (teamWon) {
        buckets.victories += 1;
        applyHandicapRange(killDifference, handicapRange, handicapValues, buckets.counts.victories);
    } else {
        buckets.losses += 1;
        applyHandicapRange(killDifference, handicapRange, handicapValues, buckets.counts.losses);
    }
};

export const revalidate = 86400;

export async function generateStaticParams() {
    const slugs = await getPatchStaticParams();
    return routing.locales.flatMap((locale) =>
        slugs.map((entry) => ({ locale, patch: entry.patch })),
    );
}

export async function generateMetadata({ params }: PatchHandicapGeneralPageProps) {
    const { locale, patch } = await params;
    const patchEntry = await getPatchBySlug(patch);
    const t = await getTranslations({ locale, namespace: 'patchHandicapGeneral' });
    const localePath = locale === routing.defaultLocale ? '' : `/${locale}`;
    if (!patchEntry) {
        return { title: t('header.heading', { patch }) };
    }
    return {
        title: t('header.heading', { patch: patchEntry.patch }),
        description: t('header.lead', { patch: patchEntry.patch }),
        alternates: {
            canonical: `${localePath}/patches/${patchEntry.patch}/handicap/general`,
            languages: {
                en: `/patches/${patchEntry.patch}/handicap/general`,
                ru: `/ru/patches/${patchEntry.patch}/handicap/general`,
            },
        },
    };
}

export default async function PatchHandicapGeneralPage({ params, searchParams }: PatchHandicapGeneralPageProps) {
    const { locale, patch } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('patchHandicapGeneral');
    const tc = await getTranslations('common');
    const patchEntry = await getPatchBySlug(patch);

    if (!patchEntry) {
        return <div className="py-20 text-center text-muted-foreground">Patch not found.</div>;
    }

    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const query = resolvedSearchParams?.search?.trim().toLowerCase() ?? '';

    const matches = await getMatchesByPatch(patchEntry.id);
    const handicapRange = buildHandicapRange();
    const handicapValues = handicapRange.map((value) => Number(value));

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
    const filteredTeams = query ? teams.filter((team) => team.name.toLowerCase().includes(query)) : teams;
    const bucketsByTeam = initBucketsByTeam(teams, handicapRange);

    matches.forEach((match) => {
        if (match.radiantTeamId) {
            accumulateMatchForTeam(match, match.radiantTeamId, true, handicapRange, handicapValues, bucketsByTeam);
        }
        if (match.direTeamId) {
            accumulateMatchForTeam(match, match.direTeamId, false, handicapRange, handicapValues, bucketsByTeam);
        }
    });

    const rows = filteredTeams
        .map((team) => {
            const stats = bucketsByTeam.get(team.id);
            if (!stats) {
                return null;
            }
            const percentages = {
                victories: calculatePercentages(handicapRange, stats.counts.victories, stats.victories),
                losses: calculatePercentages(handicapRange, stats.counts.losses, stats.losses),
                general: calculatePercentages(handicapRange, stats.counts.general, stats.totalMatches),
            };
            stats.percentages = percentages;
            return { team, stats };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => b.stats.totalMatches - a.stats.totalMatches);

    const renderTable = (type: 'victories' | 'losses' | 'general', title: string, note: string) => (
        <Card className="border-border/60 bg-card/80">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <p className="text-sm text-muted-foreground">{note}</p>
            </CardHeader>
            <CardContent>
                <HandicapGeneralTable rows={rows} handicapRange={handicapRange} type={type} />
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-10">
            <section className="rounded-2xl border border-border/60 bg-card/80 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <Badge className="w-fit bg-primary/10 text-primary">{t('header.badge')}</Badge>
                        <h1 className="font-display mt-3 text-3xl font-semibold md:text-4xl">{t('header.heading', { patch: patchEntry.patch })}</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            {t('header.lead', { patch: patchEntry.patch })}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button asChild variant="outline">
                            <Link href={`/patches/${encodeURIComponent(patchEntry.patch)}`}>{tc('backToPatch')}</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href={`/patches/${encodeURIComponent(patchEntry.patch)}/handicap`}>{t('header.teamComparison')}</Link>
                        </Button>
                        <ShareButton
                            title={t('header.heading', { patch: patchEntry.patch })}
                            text={t('shareText', { patch: patchEntry.patch })}
                            url={`/patches/${encodeURIComponent(patchEntry.patch)}/handicap/general`}
                        />
                    </div>
                </div>

                <form method="GET" className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
                    <Input name="search" placeholder={t('form.search')} defaultValue={resolvedSearchParams?.search ?? ''} />
                    <Button type="submit" variant="outline">
                        {t('form.filter')}
                    </Button>
                </form>
            </section>

            {rows.length ? (
                <>
                    {renderTable(
                        'general',
                        'General Matches',
                        'Overall handicap success rate across all matches in this patch. Best single indicator for betting analysis.',
                    )}
                    {renderTable(
                        'victories',
                        'Victory Matches',
                        'Handicap success rate when the team won the match. Higher values mean consistent winning margins.',
                    )}
                    {renderTable(
                        'losses',
                        'Loss Matches',
                        'Handicap success rate when the team lost the match. Shows how competitive they are in losses.',
                    )}
                </>
            ) : (
                <Card className="border-border/60 bg-card/80">
                    <CardContent className="p-6 text-sm text-muted-foreground">No teams found for this patch.</CardContent>
                </Card>
            )}
        </div>
    );
}
