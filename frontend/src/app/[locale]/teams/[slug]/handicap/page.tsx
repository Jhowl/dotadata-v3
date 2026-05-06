import { setRequestLocale, getTranslations } from "next-intl/server";

import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { getTeamStaticParams } from "@/lib/static-params";
import { getLeagues, getMatchesByTeamForHandicap, getPatches, getTeamBySlug } from "@/lib/supabase/queries";

interface TeamHandicapPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

type HandicapStats = {
  totalMatches: number;
  wins: number;
  losses: number;
  lastMatchTime: string | null;
  handicapStatsWins: Record<string, number>;
  handicapStatsLosses: Record<string, number>;
  percentagesWins: Record<string, number>;
  percentagesLosses: Record<string, number>;
  percentagesTotal: Record<string, number>;
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

const createStats = (handicapRange: string[]): HandicapStats => ({
  totalMatches: 0,
  wins: 0,
  losses: 0,
  lastMatchTime: null,
  handicapStatsWins: Object.fromEntries(handicapRange.map((handicap) => [handicap, 0])),
  handicapStatsLosses: Object.fromEntries(handicapRange.map((handicap) => [handicap, 0])),
  percentagesWins: Object.fromEntries(handicapRange.map((handicap) => [handicap, 0])),
  percentagesLosses: Object.fromEntries(handicapRange.map((handicap) => [handicap, 0])),
  percentagesTotal: Object.fromEntries(handicapRange.map((handicap) => [handicap, 0])),
});

const parseMatchTime = (value: string | null) => {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const applyHandicap = (killDifference: number, handicapRange: string[], stats: Record<string, number>) => {
  handicapRange.forEach((handicap) => {
    const handicapFloat = Number(handicap);
    if (killDifference + handicapFloat > 0) {
      stats[handicap] += 1;
    }
  });
};

const finalizePercentages = (stats: HandicapStats, handicapRange: string[]) => {
  handicapRange.forEach((handicap) => {
    const wins = stats.handicapStatsWins[handicap] ?? 0;
    const losses = stats.handicapStatsLosses[handicap] ?? 0;
    stats.percentagesWins[handicap] = stats.wins ? Number(((wins / stats.wins) * 100).toFixed(2)) : 0;
    stats.percentagesLosses[handicap] = stats.losses ? Number(((losses / stats.losses) * 100).toFixed(2)) : 0;
    stats.percentagesTotal[handicap] =
      stats.wins + stats.losses ? Number((((wins + losses) / (stats.wins + stats.losses)) * 100).toFixed(2)) : 0;
  });
};

export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await getTeamStaticParams();
  return routing.locales.flatMap((locale) =>
    slugs.map((entry) => ({ locale, slug: entry.slug })),
  );
}

export async function generateMetadata({ params }: TeamHandicapPageProps) {
  const { locale, slug } = await params;
  const team = await getTeamBySlug(slug);
  const localePath = locale === routing.defaultLocale ? "" : `/${locale}`;
  if (!team) {
    return { title: "Team handicap analysis" };
  }
  const title = `${team.name} Handicap Analysis - Dota 2 Kill Score Trends`;
  const description = `Kill-score handicap trends for ${team.name} across leagues and patches.`;
  const path = `${localePath}/teams/${team.slug}/handicap`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" as const, url: path },
    twitter: { card: "summary_large_image" as const, title, description },
    alternates: {
      canonical: path,
      languages: { en: `/teams/${team.slug}/handicap`, ru: `/ru/teams/${team.slug}/handicap` },
    },
  };
}

export default async function TeamHandicapPage({ params }: TeamHandicapPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("teamHandicap");
  const tc = await getTranslations("common");
  const team = await getTeamBySlug(slug);

  if (!team) {
    return <div className="py-20 text-center text-muted-foreground">Team not found.</div>;
  }

  const [matches, leagues, patches] = await Promise.all([
    getMatchesByTeamForHandicap(team.id),
    getLeagues(),
    getPatches(),
  ]);

  const handicapRange = buildHandicapRange();
  const leagueLookup = new Map(leagues.map((league) => [league.id, league]));
  const patchLookup = new Map(patches.map((patch) => [patch.id, patch]));

  const leagueStats = new Map<string, HandicapStats>();
  const patchStats = new Map<string, HandicapStats>();
  const overallStats = createStats(handicapRange);

  matches.forEach((match) => {
    const isRadiant = match.radiantTeamId === team.id;
    const teamWon = (isRadiant && match.radiantWin) || (!isRadiant && !match.radiantWin);
    const killDifference = isRadiant
      ? match.radiantScore - match.direScore
      : match.direScore - match.radiantScore;

    overallStats.totalMatches += 1;
    if (teamWon) {
      overallStats.wins += 1;
      applyHandicap(killDifference, handicapRange, overallStats.handicapStatsWins);
    } else {
      overallStats.losses += 1;
      applyHandicap(killDifference, handicapRange, overallStats.handicapStatsLosses);
    }

    const leagueId = match.leagueId;
    if (leagueId) {
      if (!leagueStats.has(leagueId)) {
        leagueStats.set(leagueId, createStats(handicapRange));
      }
      const stats = leagueStats.get(leagueId);
      if (!stats) {
        return;
      }
      stats.totalMatches += 1;
      if (parseMatchTime(match.startTime) > parseMatchTime(stats.lastMatchTime)) {
        stats.lastMatchTime = match.startTime;
      }
      if (teamWon) {
        stats.wins += 1;
        applyHandicap(killDifference, handicapRange, stats.handicapStatsWins);
      } else {
        stats.losses += 1;
        applyHandicap(killDifference, handicapRange, stats.handicapStatsLosses);
      }
    }

    const patchId = match.patchId;
    if (patchId) {
      if (!patchStats.has(patchId)) {
        patchStats.set(patchId, createStats(handicapRange));
      }
      const stats = patchStats.get(patchId);
      if (!stats) {
        return;
      }
      stats.totalMatches += 1;
      if (parseMatchTime(match.startTime) > parseMatchTime(stats.lastMatchTime)) {
        stats.lastMatchTime = match.startTime;
      }
      if (teamWon) {
        stats.wins += 1;
        applyHandicap(killDifference, handicapRange, stats.handicapStatsWins);
      } else {
        stats.losses += 1;
        applyHandicap(killDifference, handicapRange, stats.handicapStatsLosses);
      }
    }
  });

  const leagueRows = Array.from(leagueStats.entries())
    .map(([leagueId, stats]) => {
      finalizePercentages(stats, handicapRange);
      const league = leagueLookup.get(leagueId);
      return {
        id: leagueId,
        name: league?.name ?? `League ${leagueId}`,
        slug: league?.slug ?? leagueId,
        stats,
      };
    })
    .sort((a, b) => parseMatchTime(b.stats.lastMatchTime) - parseMatchTime(a.stats.lastMatchTime));

  const patchRows = Array.from(patchStats.entries())
    .map(([patchId, stats]) => {
      finalizePercentages(stats, handicapRange);
      const patch = patchLookup.get(patchId);
      return {
        id: patchId,
        patch: patch?.patch ?? patchId,
        stats,
      };
    })
    .sort((a, b) => parseMatchTime(b.stats.lastMatchTime) - parseMatchTime(a.stats.lastMatchTime));

  finalizePercentages(overallStats, handicapRange);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-border/60 bg-card/80 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge className="w-fit bg-primary/10 text-primary">{t("header.badge")}</Badge>
            <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
              {t("header.heading", { team: team.name })}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("header.lead", { matches: formatNumber(matches.length) })}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href={`/teams/${team.slug}`}>{tc("backToTeam")}</Link>
            </Button>
            <ShareButton
              title={t("header.heading", { team: team.name })}
              text={t("shareText", { team: team.name, matches: formatNumber(matches.length) })}
              url={`/teams/${team.slug}/handicap`}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-blue-500/10 p-4 text-sm text-blue-100">
        <p>
          <strong>{t("howItWorks.heading")}</strong> {t("howItWorks.body")}
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Matches</p>
            <p className="text-3xl font-semibold text-primary">{formatNumber(overallStats.totalMatches)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Wins</p>
            <p className="text-3xl font-semibold text-emerald-200">{formatNumber(overallStats.wins)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Losses</p>
            <p className="text-3xl font-semibold text-red-200">{formatNumber(overallStats.losses)}</p>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Overall Handicap Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-border/60 text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Handicap</th>
                  <th className="px-3 py-2">Wins %</th>
                  <th className="px-3 py-2">Losses %</th>
                  <th className="px-3 py-2">Total %</th>
                  <th className="px-3 py-2">Matches Covered</th>
                </tr>
              </thead>
              <tbody>
                {handicapRange.map((handicap) => {
                  const winsCovered = overallStats.handicapStatsWins[handicap] ?? 0;
                  const lossesCovered = overallStats.handicapStatsLosses[handicap] ?? 0;
                  const totalCovered = winsCovered + lossesCovered;
                  return (
                    <tr key={handicap} className="border-t border-border/60">
                      <td className="px-3 py-2 font-semibold text-foreground">{handicap}</td>
                      <td className="px-3 py-2 text-emerald-200">{overallStats.percentagesWins[handicap]}%</td>
                      <td className="px-3 py-2 text-red-200">{overallStats.percentagesLosses[handicap]}%</td>
                      <td className="px-3 py-2 text-muted-foreground">{overallStats.percentagesTotal[handicap]}%</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatNumber(totalCovered)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-semibold text-foreground">Handicap Analysis by League</h2>
        {leagueRows.length ? (
          <div className="space-y-6">
            {leagueRows.map((league) => (
              <Card key={league.id} className="border-border/60 bg-card/80">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>
                      <Link href={`/leagues/${league.slug}`} className="text-primary">
                        {league.name}
                      </Link>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatNumber(league.stats.totalMatches)} matches •{" "}
                      <span className="text-emerald-200">{league.stats.wins}</span> wins •{" "}
                      <span className="text-red-200">{league.stats.losses}</span> losses
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-border/60 text-sm">
                      <thead className="bg-muted/60">
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2">Handicap</th>
                          <th className="px-3 py-2">Wins %</th>
                          <th className="px-3 py-2">Losses %</th>
                          <th className="px-3 py-2">Total %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {handicapRange.map((handicap) => (
                          <tr key={handicap} className="border-t border-border/60">
                            <td className="px-3 py-2 font-semibold text-foreground">{handicap}</td>
                            <td className="px-3 py-2 text-emerald-200">{league.stats.percentagesWins[handicap]}%</td>
                            <td className="px-3 py-2 text-red-200">{league.stats.percentagesLosses[handicap]}%</td>
                            <td className="px-3 py-2 text-muted-foreground">{league.stats.percentagesTotal[handicap]}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-6 text-sm text-muted-foreground">No league data available for this team.</CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-semibold text-foreground">Handicap Analysis by Patch</h2>
        {patchRows.length ? (
          <div className="space-y-6">
            {patchRows.map((patch) => (
              <Card key={patch.id} className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>Patch {patch.patch}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(patch.stats.totalMatches)} matches •{" "}
                    <span className="text-emerald-200">{patch.stats.wins}</span> wins •{" "}
                    <span className="text-red-200">{patch.stats.losses}</span> losses
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-border/60 text-sm">
                      <thead className="bg-muted/60">
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2">Handicap</th>
                          <th className="px-3 py-2">Wins %</th>
                          <th className="px-3 py-2">Losses %</th>
                          <th className="px-3 py-2">Total %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {handicapRange.map((handicap) => (
                          <tr key={handicap} className="border-t border-border/60">
                            <td className="px-3 py-2 font-semibold text-foreground">{handicap}</td>
                            <td className="px-3 py-2 text-emerald-200">{patch.stats.percentagesWins[handicap]}%</td>
                            <td className="px-3 py-2 text-red-200">{patch.stats.percentagesLosses[handicap]}%</td>
                            <td className="px-3 py-2 text-muted-foreground">{patch.stats.percentagesTotal[handicap]}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-6 text-sm text-muted-foreground">No patch data available for this team.</CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
