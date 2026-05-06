import { setRequestLocale, getTranslations } from "next-intl/server";

import { ExportCsvButton } from "@/components/export-csv-button";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { YearlyMetricLine } from "@/components/charts/yearly-metric-line";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { createHeroImageResolver } from "@/lib/hero";
import {
  getHeroes,
  getMatchesByIds,
  getPlayersByIds,
  getSeasonSnapshot,
  getTeams,
} from "@/lib/supabase/queries";

interface SeasonPageProps {
  params: Promise<{ locale: string; year: string }>;
}

const formatMinutes = (seconds: number) => `${(seconds / 60).toFixed(1)} min`;

export async function generateStaticParams() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: Math.max(0, currentYear - 2022) }, (_, index) => 2023 + index);
  return routing.locales.flatMap((locale) =>
    years.map((year) => ({ locale, year: String(year) })),
  );
}

export async function generateMetadata({ params }: SeasonPageProps) {
  const { locale, year } = await params;
  const t = await getTranslations({ locale, namespace: "season" });
  const localePath = locale === routing.defaultLocale ? "" : `/${locale}`;
  const title = t("metaTitle", { year });
  const description = t("metaDescription", { year });
  return {
    title,
    description,
    openGraph: { title, description, type: "website" as const, url: `${localePath}/seasons/${year}` },
    twitter: { card: "summary_large_image" as const, title, description },
    alternates: {
      canonical: `${localePath}/seasons/${year}`,
      languages: { en: `/seasons/${year}`, ru: `/ru/seasons/${year}` },
    },
  };
}

export const revalidate = 86400;

export default async function SeasonPage({ params }: SeasonPageProps) {
  const { locale, year } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("season");
  const seasonYear = Number(year);

  if (!Number.isFinite(seasonYear) || seasonYear < 2023) {
    return <div className="py-20 text-center text-muted-foreground">{t("invalidYear")}</div>;
  }

  const [teams, heroes, snapshot] = await Promise.all([
    getTeams(),
    getHeroes(),
    getSeasonSnapshot(seasonYear),
  ]);

  const teamNameLookup = new Map(teams.map((team) => [team.id, team.name]));
  const heroLookup = new Map(heroes.map((hero) => [hero.id, hero.localizedName]));
  const buildHeroImageUrl = createHeroImageResolver(heroes);

  const summary = snapshot?.totals ?? {
    totalMatches: 0,
    avgDuration: 0,
    avgScore: 0,
    avgFirstTowerTime: null,
    radiantWinRate: 0,
    minScore: 0,
    maxScore: 0,
    minScoreMatchId: null,
    maxScoreMatchId: null,
    fastestMatchId: null,
    fastestMatchDuration: null,
    longestMatchId: null,
    longestMatchDuration: null,
    lastMatchDate: null,
  };

  const yearLeagues = new Map<string, number>(
    (snapshot?.leagues ?? []).map((league) => [league.id, league.matchCount])
  );
  const yearTeams = new Map<string, number>(
    (snapshot?.teams ?? []).map((team) => [team.id, team.matchCount])
  );

  const leaguesList = snapshot?.leagues ?? [];
  const topTeams = (snapshot?.teams ?? []).filter((team) => team.matchCount >= 100);

  const monthlyDuration = snapshot?.monthlyDuration ?? [];
  const monthlyScore = snapshot?.monthlyScore ?? [];

  const lastMatchDate = summary.lastMatchDate ? formatDate(summary.lastMatchDate) : "N/A";

  const pickBanBuckets = snapshot?.pickBan ?? { picked: [], banned: [], contested: [] };
  const aggregatedTopPerformers = snapshot?.topPerformers ?? [];

  const highlightMatchIds = [
    summary.minScoreMatchId,
    summary.maxScoreMatchId,
    summary.fastestMatchId,
    summary.longestMatchId,
  ].filter(Boolean) as string[];
  const performerAccountIds = aggregatedTopPerformers
    .map((entry) => entry.performer?.accountId)
    .filter((value): value is string => Boolean(value));

  const [highlightMatches, playerLookup] = await Promise.all([
    getMatchesByIds([...new Set(highlightMatchIds)]),
    getPlayersByIds(performerAccountIds),
  ]);
  const matchById = new Map(highlightMatches.map((match) => [match.id, match]));

  const minScoreMatch = summary.minScoreMatchId ? matchById.get(summary.minScoreMatchId) ?? null : null;
  const maxScoreMatch = summary.maxScoreMatchId ? matchById.get(summary.maxScoreMatchId) ?? null : null;
  const fastestMatch = summary.fastestMatchId ? matchById.get(summary.fastestMatchId) ?? null : null;
  const longestMatch = summary.longestMatchId ? matchById.get(summary.longestMatchId) ?? null : null;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Badge className="w-fit bg-primary/10 text-primary">Season {seasonYear}</Badge>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <ExportCsvButton href={`/seasons/${seasonYear}/export`} />
            <span className="text-muted-foreground">Download match data for this season.</span>
            <ShareButton
              title={`Dota 2 Season ${seasonYear}`}
              text={`📅 Dota 2 Season ${seasonYear}: ${formatNumber(summary.totalMatches)} matches — leagues, teams, and trends on DotaData`}
              url={`/seasons/${seasonYear}`}
            />
          </div>
        </div>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">Dota 2 Season {seasonYear}</h1>
        <p className="max-w-3xl text-muted-foreground">
          A year-by-year snapshot of professional Dota 2 competition. Track the most active leagues, top teams, and
          monthly shifts in match length and total scores.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Matches</p>
            <p className="text-3xl font-semibold text-primary">{formatNumber(summary.totalMatches)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active Leagues</p>
            <p className="text-3xl font-semibold text-foreground">{formatNumber(yearLeagues.size)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active Teams</p>
            <p className="text-3xl font-semibold text-foreground">{formatNumber(yearTeams.size)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Avg Duration</p>
            <p className="text-3xl font-semibold text-foreground">
              {summary.totalMatches ? formatMinutes(summary.avgDuration) : "—"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Season Averages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Average Score</span>
              <span className="text-foreground">{summary.totalMatches ? summary.avgScore.toFixed(1) : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Average First Tower</span>
              <span className="text-foreground">
                {summary.avgFirstTowerTime ? formatMinutes(summary.avgFirstTowerTime) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Radiant Winrate</span>
              <span className="text-foreground">{summary.totalMatches ? formatPercent(summary.radiantWinRate) : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Latest Match</span>
              <span className="text-foreground">{lastMatchDate}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Monthly Avg Duration (min)</CardTitle>
          </CardHeader>
          <CardContent>
            <YearlyMetricLine data={monthlyDuration} color="var(--chart-2)" />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Monthly Avg Score</CardTitle>
          </CardHeader>
          <CardContent>
            <YearlyMetricLine data={monthlyScore} color="var(--chart-3)" />
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Score Range</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Min Score</p>
              <p className="text-2xl font-semibold text-foreground">{summary.minScore}</p>
              <p className="text-xs text-muted-foreground">Match ID: {minScoreMatch?.id ?? "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Max Score</p>
              <p className="text-2xl font-semibold text-foreground">{summary.maxScore}</p>
              <p className="text-xs text-muted-foreground">Match ID: {maxScoreMatch?.id ?? "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fastest Match</p>
              <p className="text-2xl font-semibold text-foreground">
                {fastestMatch
                  ? formatMinutes(fastestMatch.duration)
                  : summary.fastestMatchDuration
                    ? formatMinutes(summary.fastestMatchDuration)
                    : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Match ID: {fastestMatch?.id ?? "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Longest Match</p>
              <p className="text-2xl font-semibold text-foreground">
                {longestMatch
                  ? formatMinutes(longestMatch.duration)
                  : summary.longestMatchDuration
                    ? formatMinutes(summary.longestMatchDuration)
                    : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Match ID: {longestMatch?.id ?? "N/A"}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/80 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="font-display text-xl font-semibold">Top Teams (100+ matches)</h2>
          <p className="text-xs text-muted-foreground">Sorted by match volume</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {topTeams.length ? (
            topTeams.map((team) => (
              <div key={team.id} className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(team.matchCount)} matches</p>
                  </div>
                  <Link href={`/teams/${team.slug}`} className="text-xs font-semibold text-primary">
                    View →
                  </Link>
                </div>
                <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                  <div className="rounded-md border border-border/60 bg-card/60 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Overall</p>
                    <p className="text-base font-semibold text-foreground">{formatPercent(team.overallWinrate)}</p>
                  </div>
                  <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-emerald-200">Radiant</p>
                    <p className="text-base font-semibold text-emerald-100">{formatPercent(team.radiantWinrate)}</p>
                  </div>
                  <div className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-rose-200">Dire</p>
                    <p className="text-base font-semibold text-rose-100">{formatPercent(team.direWinrate)}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No teams with 100+ matches this season.</p>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {[
          { title: "Most Picked", entries: pickBanBuckets.picked },
          { title: "Most Banned", entries: pickBanBuckets.banned },
          { title: "Most Contested", entries: pickBanBuckets.contested },
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
                    <div key={entry.heroId} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
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
          {aggregatedTopPerformers.length ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {aggregatedTopPerformers.map((entry) => {
                if (!entry.performer) {
                  return null;
                }
                const performer = entry.performer;
                const heroName = performer.heroId ? heroLookup.get(performer.heroId) ?? performer.heroId : "Unknown";
                const teamName = performer.teamId
                  ? teamNameLookup.get(performer.teamId) ?? performer.teamId
                  : "Unknown";
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
                        <p className="mt-1 text-2xl font-semibold text-primary">
                          {formatNumber(performer.statValue)}
                        </p>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <p>
                            Player:{" "}
                            <span className="text-foreground">
                              {performer.accountId
                                ? playerLookup.get(performer.accountId) ?? `Player ${performer.accountId}`
                                : "Unknown"}
                            </span>
                          </p>
                          <p>Hero: <span className="text-foreground">{heroName}</span></p>
                          <p>Team: <span className="text-foreground">{teamName}</span></p>
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

      <section className="rounded-2xl border border-border/60 bg-card/80 p-6">
        <h2 className="font-display text-xl font-semibold">All Leagues</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {leaguesList.length ? (
            leaguesList.map((league) => (
              <div key={league.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{league.name}</p>
                  <p className="text-xs text-muted-foreground">{formatNumber(league.matchCount)} matches</p>
                </div>
                <Link href={`/leagues/${league.slug}`} className="text-sm font-semibold text-primary">
                  View →
                </Link>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No leagues found for this season.</p>
          )}
        </div>
      </section>
    </div>
  );
}
