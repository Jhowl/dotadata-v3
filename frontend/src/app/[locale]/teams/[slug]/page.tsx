import Image from "next/image";
import Script from "next/script";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CommentsSection } from "@/components/comments/comments-section";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { createHeroImageResolver } from "@/lib/hero";
import { getTeamStaticParams } from "@/lib/static-params";
import {
  getHeroes,
  getLeagueLastWinners,
  getLeagues,
  getMatchesByIds,
  getPlayersByIds,
  getTeamBySlug,
  getTeamPickBanStats,
  getTeamSummary,
  getTeams,
  getTopPerformersByTeam,
} from "@/lib/supabase/queries";

interface TeamPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

const formatMinutes = (seconds: number) => `${(seconds / 60).toFixed(1)} min`;

export async function generateStaticParams() {
  const slugs = await getTeamStaticParams();
  return routing.locales.flatMap((locale) =>
    slugs.map((entry) => ({ locale, slug: entry.slug })),
  );
}

const isLeagueOver = (endDate: string | null) => {
  if (!endDate) return false;
  const parsed = Date.parse(endDate);
  if (Number.isNaN(parsed)) return false;
  return parsed <= Date.now();
};

export async function generateMetadata({ params }: TeamPageProps) {
  const { locale, slug } = await params;
  const team = await getTeamBySlug(slug);
  const localePath = locale === routing.defaultLocale ? "" : `/${locale}`;

  if (!team) {
    return { title: "Team not found" };
  }

  const title = `${team.name} - Dota 2 Team Statistics & Performance Analysis`;
  const description = `Comprehensive statistics for ${team.name} with match history and performance analysis.`;
  const path = `${localePath}/teams/${team.slug}`;

  return {
    title,
    description,
    openGraph: { title, description, type: "article" as const, url: path },
    twitter: { card: "summary_large_image" as const, title, description },
    alternates: {
      canonical: path,
      languages: { en: `/teams/${team.slug}`, ru: `/ru/teams/${team.slug}` },
    },
  };
}

export const revalidate = 86400;

export default async function TeamPage({ params }: TeamPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("team");
  const tc = await getTranslations("common");
  const team = await getTeamBySlug(slug);

  if (!team) {
    return <div className="py-20 text-center text-muted-foreground">Team not found.</div>;
  }

  const [teamSummary, teams, heroes, topPerformers, pickBanStats, leagues, lastWinners] = await Promise.all([
    getTeamSummary(team.id),
    getTeams(),
    getHeroes(),
    getTopPerformersByTeam(team.id),
    getTeamPickBanStats(team.id, 5),
    getLeagues(),
    getLeagueLastWinners(),
  ]);

  // Compute championships: leagues this team won (last-match winner heuristic) where the league has ended.
  const leagueLookup = new Map(leagues.map((l) => [l.id, l]));
  const championships = Object.entries(lastWinners)
    .filter(([leagueId, winner]) => {
      if (winner.teamId !== team.id) return false;
      const league = leagueLookup.get(leagueId);
      return Boolean(league && isLeagueOver(league.endDate));
    })
    .map(([leagueId, winner]) => {
      const league = leagueLookup.get(leagueId);
      return {
        leagueId,
        leagueName: league?.name ?? leagueId,
        leagueSlug: league?.slug ?? "",
        endDate: league?.endDate ?? null,
        wonAt: winner.startTime,
      };
    })
    .sort((a, b) => {
      const aTs = a.endDate ? Date.parse(a.endDate) : 0;
      const bTs = b.endDate ? Date.parse(b.endDate) : 0;
      return bTs - aTs;
    });

  const highlightMatchIds = [
    teamSummary?.minScoreMatchId,
    teamSummary?.maxScoreMatchId,
    teamSummary?.fastestMatchId,
    teamSummary?.longestMatchId,
  ].filter(Boolean) as string[];

  const performerAccountIds = topPerformers
    .map((entry) => entry.performer?.accountId)
    .filter((value): value is string => Boolean(value));

  const [highlightMatches, playerLookup] = await Promise.all([
    getMatchesByIds([...new Set(highlightMatchIds)]),
    getPlayersByIds(performerAccountIds),
  ]);

  const teamLookup = new Map(teams.map((entry) => [entry.id, entry.name]));
  const heroLookup = new Map(heroes.map((hero) => [hero.id, hero.localizedName]));
  const matchById = new Map(highlightMatches.map((match) => [match.id, match]));
  const summary = {
    totalMatches: teamSummary?.totalMatches ?? 0,
    avgDuration: teamSummary?.avgDuration ?? 0,
    avgScore: teamSummary?.avgScore ?? 0,
    minScore: teamSummary?.minScore ?? 0,
    maxScore: teamSummary?.maxScore ?? 0,
    avgFirstTowerTime: teamSummary?.avgFirstTowerTime ?? null,
    fastestMatch: teamSummary?.fastestMatchId ? matchById.get(teamSummary.fastestMatchId) ?? null : null,
    longestMatch: teamSummary?.longestMatchId ? matchById.get(teamSummary.longestMatchId) ?? null : null,
    minScoreMatch: teamSummary?.minScoreMatchId ? matchById.get(teamSummary.minScoreMatchId) ?? null : null,
    maxScoreMatch: teamSummary?.maxScoreMatchId ? matchById.get(teamSummary.maxScoreMatchId) ?? null : null,
  };
  const teamLeagues = teamSummary?.leagues ?? [];

  const overallWinRate = summary.totalMatches
    ? ((teamSummary?.radiantWinrate ?? 0) * (teamSummary?.radiantMatches ?? 0) +
        (teamSummary?.direWinrate ?? 0) * (teamSummary?.direMatches ?? 0)) /
        summary.totalMatches
    : 0;
  const radiantWinRate = teamSummary?.radiantWinrate ?? 0;
  const direWinRate = teamSummary?.direWinrate ?? 0;
  const buildHeroImageUrl = createHeroImageResolver(heroes);

  return (
    <>
      <Script id="team-ld-json" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SportsTeam",
          name: team.name,
          sport: "Dota 2",
          url: `https://dotadata.org/teams/${team.slug}`,
          logo: team.logoUrl ?? undefined,
          memberOf: {
            "@type": "Organization",
            name: "DotaData",
            url: "https://dotadata.org",
          },
        })}
      </Script>
      <div className="space-y-10">
      <Breadcrumbs
        items={[
          { title: "Teams", url: "/teams" },
          { title: team.name },
        ]}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Badge className="w-fit bg-primary/10 text-primary">{t("header.badge")}</Badge>
          <ShareButton
            title={`${team.name} — Dota 2 Team Stats`}
            text={t("shareText", { team: team.name, matches: formatNumber(summary.totalMatches) })}
            url={`/teams/${team.slug}`}
          />
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {team.logoUrl ? (
              <Image
                src={team.logoUrl}
                alt={`${team.name} logo`}
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 rounded-xl border border-border/60 bg-background/60 object-contain p-1"
              />
            ) : null}
            <div>
              <h1 className="font-display text-3xl font-semibold md:text-4xl">{team.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{t("header.teamId", { id: team.id })}</span>
                {championships.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                    🏆 {championships.length} {tc("champion")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href={`/teams/${team.slug}/handicap`}>Handicap Analysis</Link>
          </Button>
        </div>
      </section>

      {championships.length > 0 && (
        <section
          aria-labelledby="championships-heading"
          className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-background p-6 md:p-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl"
          />
          <div className="relative flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                {tc("champion")}
              </p>
              <h2
                id="championships-heading"
                className="mt-1 font-display text-2xl font-semibold text-foreground"
              >
                🏆 {championships.length}{" "}
                {championships.length === 1 ? "championship" : "championships"}
              </h2>
            </div>
          </div>
          <ul className="relative mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {championships.map((entry) => (
              <li
                key={entry.leagueId}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
              >
                <Link
                  href={`/leagues/${entry.leagueSlug}`}
                  className="truncate text-sm font-semibold text-foreground hover:text-primary"
                  title={entry.leagueName}
                >
                  {entry.leagueName}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.endDate ? formatDate(entry.endDate) : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!summary.totalMatches ? (
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-semibold text-foreground">No Match Data Available</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This team doesn&apos;t have any matches in the database yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60 bg-card/80">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Total Matches</p>
                <p className="text-3xl font-semibold text-primary">{formatNumber(summary.totalMatches)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Average Duration</p>
                <p className="text-3xl font-semibold text-foreground">{formatMinutes(summary.avgDuration)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className="text-3xl font-semibold text-foreground">{summary.avgScore.toFixed(1)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Avg First Tower</p>
                <p className="text-3xl font-semibold text-foreground">
                  {summary.avgFirstTowerTime ? formatMinutes(summary.avgFirstTowerTime) : "N/A"}
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Score Range</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Min Score</p>
                  <p className="text-2xl font-semibold text-foreground">{summary.minScore}</p>
                  <p className="text-xs text-muted-foreground">Match ID: {summary.minScoreMatch?.id ?? "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Score</p>
                  <p className="text-2xl font-semibold text-foreground">{summary.maxScore}</p>
                  <p className="text-xs text-muted-foreground">Match ID: {summary.maxScoreMatch?.id ?? "N/A"}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Winrate</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Overall</p>
                  <p className="text-2xl font-semibold text-foreground">{formatPercent(overallWinRate)}</p>
                  <p className="text-xs text-muted-foreground">{formatNumber(summary.totalMatches)} matches</p>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-sm font-semibold text-emerald-300">Radiant</p>
                  <p className="text-2xl font-semibold text-emerald-200">{formatPercent(radiantWinRate)}</p>
                </div>
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm font-semibold text-red-300">Dire</p>
                  <p className="text-2xl font-semibold text-red-200">{formatPercent(direWinRate)}</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            {summary.fastestMatch ? (
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>Fastest Match</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Duration: {formatMinutes(summary.fastestMatch.duration)}</p>
                  <p>Match ID: {summary.fastestMatch.id}</p>
                  <p>
                    Radiant: {summary.fastestMatch.radiantTeamId ? teamLookup.get(summary.fastestMatch.radiantTeamId) : "Unknown"}
                  </p>
                  <p>
                    Dire: {summary.fastestMatch.direTeamId ? teamLookup.get(summary.fastestMatch.direTeamId) : "Unknown"}
                  </p>
                  <p>Winner: {summary.fastestMatch.radiantWin ? "Radiant" : "Dire"}</p>
                </CardContent>
              </Card>
            ) : null}
            {summary.longestMatch ? (
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>Longest Match</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Duration: {formatMinutes(summary.longestMatch.duration)}</p>
                  <p>Match ID: {summary.longestMatch.id}</p>
                  <p>
                    Radiant: {summary.longestMatch.radiantTeamId ? teamLookup.get(summary.longestMatch.radiantTeamId) : "Unknown"}
                  </p>
                  <p>
                    Dire: {summary.longestMatch.direTeamId ? teamLookup.get(summary.longestMatch.direTeamId) : "Unknown"}
                  </p>
                  <p>Winner: {summary.longestMatch.radiantWin ? "Radiant" : "Dire"}</p>
                </CardContent>
              </Card>
            ) : null}
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            {[
              { title: "Most Picked", entries: pickBanStats.mostPicked },
              { title: "Most Banned", entries: pickBanStats.mostBanned },
              { title: "Most Contested", entries: pickBanStats.mostContested },
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
                            <p className="text-xs text-muted-foreground">{team.name}</p>
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
              <CardTitle>Player Performance</CardTitle>
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
                    const heroName = performer.heroId ? heroLookup.get(performer.heroId) ?? performer.heroId : "Unknown";
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
                              <p>Player: <span className="text-foreground">{performer.accountId ? playerLookup.get(performer.accountId) ?? `Player ${performer.accountId}` : "Unknown"}</span></p>
                              <p>Hero: <span className="text-foreground">{heroName}</span></p>
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
              <CardTitle>League Participation</CardTitle>
              <p className="text-sm text-muted-foreground">Performance across leagues this team competed in.</p>
            </CardHeader>
            <CardContent>
              {teamLeagues.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-border/60 text-sm">
                    <thead className="bg-muted/60">
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">League</th>
                        <th className="px-4 py-3">Matches</th>
                        <th className="px-4 py-3">Overall</th>
                        <th className="px-4 py-3">Radiant</th>
                        <th className="px-4 py-3">Dire</th>
                        <th className="px-4 py-3">Last Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamLeagues.map((league) => (
                        <tr key={league.id} className="border-t border-border/60">
                          <td className="px-4 py-3 font-semibold text-primary">
                            <Link href={`/leagues/${league.slug}`}>{league.name}</Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatNumber(league.matchCount)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatPercent(league.overallWinrate)}</td>
                          <td className="px-4 py-3 text-emerald-200">{formatPercent(league.radiantWinrate)}</td>
                          <td className="px-4 py-3 text-red-200">{formatPercent(league.direWinrate)}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {league.lastMatchTime ? formatDate(league.lastMatchTime) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No league participation data yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
        <CommentsSection entityType="team" entityId={team.id} />
      </div>
    </>
  );
}
