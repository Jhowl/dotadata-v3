import Image from "next/image";
import Script from "next/script";
import {
  ArrowRight,
  Calendar,
  Clock,
  Crown,
  Flame,
  Hash,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CommentsSection } from "@/components/comments/comments-section";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { createHeroImageResolver } from "@/lib/hero";
import { getLeagueStaticParams } from "@/lib/static-params";
import {
  getLeagueBySlug,
  getLeagueChampion,
  getHeroes,
  getLeaguePickBanStats,
  getLeagueTeamParticipation,
  getLeagueSummary,
  getMatchesByIds,
  getPlayersByIds,
  getTopPerformersByLeague,
  getTeams,
  type LeagueChampion,
} from "@/lib/supabase/queries";
import type { Team } from "@/lib/types";

interface LeaguePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

const formatMinutes = (seconds: number) => `${(seconds / 60).toFixed(1)} min`;

const computeDurationDays = (start?: string | null, end?: string | null) => {
  if (!start || !end) return null;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
};

const isLeagueOngoing = (end?: string | null) => {
  if (!end) return true;
  const parsed = Date.parse(end);
  if (Number.isNaN(parsed)) return false;
  return parsed > Date.now();
};

export async function generateStaticParams() {
  const slugs = await getLeagueStaticParams();
  return routing.locales.flatMap((locale) =>
    slugs.map((entry) => ({ locale, slug: entry.slug })),
  );
}

export async function generateMetadata({ params }: LeaguePageProps) {
  const { locale, slug } = await params;
  const league = await getLeagueBySlug(slug);
  const t = await getTranslations({ locale, namespace: "league" });
  const localePath = locale === routing.defaultLocale ? "" : `/${locale}`;

  if (!league) {
    return { title: t("notFound") };
  }

  const summary = await getLeagueSummary(league.id);
  const matchCount = summary?.totalMatches ?? 0;
  const teamCount = summary?.totalTeams ?? 0;
  const avgKills = summary?.avgScore ?? 0;

  const description = matchCount
    ? t("metaDescriptionWithStats", {
        name: league.name,
        matches: formatNumber(matchCount),
        teams: formatNumber(teamCount),
        avgKills: avgKills.toFixed(1),
      })
    : t("metaDescriptionFallback", { name: league.name });

  const title = t("metaTitle", { name: league.name });
  const path = `${localePath}/leagues/${league.slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article" as const,
      url: path,
      siteName: "DotaData",
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
    },
    alternates: {
      canonical: path,
      languages: { en: `/leagues/${league.slug}`, ru: `/ru/leagues/${league.slug}` },
    },
  };
}

export const revalidate = 86400;

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("league");
  const league = await getLeagueBySlug(slug);

  if (!league) {
    return <div className="py-20 text-center text-muted-foreground">{t("notFound")}</div>;
  }

  const [leagueSummary, teams, heroes, topPerformers, pickBanStats, teamParticipation, champion] = await Promise.all([
    getLeagueSummary(league.id),
    getTeams(),
    getHeroes(),
    getTopPerformersByLeague(league.id),
    getLeaguePickBanStats(league.id, 5),
    getLeagueTeamParticipation(league.id),
    getLeagueChampion(league.id),
  ]);

  const highlightMatchIds = [
    leagueSummary?.minScoreMatchId,
    leagueSummary?.maxScoreMatchId,
    leagueSummary?.fastestMatchId,
    leagueSummary?.longestMatchId,
  ].filter(Boolean) as string[];

  const performerAccountIds = topPerformers
    .map((entry) => entry.performer?.accountId)
    .filter((value): value is string => Boolean(value));

  const championAccountIds = champion?.roster
    .map((player) => player.accountId)
    .filter((value): value is string => Boolean(value)) ?? [];

  const [highlightMatches, playerLookup] = await Promise.all([
    getMatchesByIds([...new Set(highlightMatchIds)]),
    getPlayersByIds([...new Set([...performerAccountIds, ...championAccountIds])]),
  ]);

  const teamLookup = new Map(teams.map((team) => [team.id, team]));
  const heroLookup = new Map(heroes.map((hero) => [hero.id, hero.localizedName]));
  const matchById = new Map(highlightMatches.map((match) => [match.id, match]));
  const summary = {
    totalMatches: leagueSummary?.totalMatches ?? 0,
    totalTeams: leagueSummary?.totalTeams ?? teamParticipation.length,
    avgDuration: leagueSummary?.avgDuration ?? 0,
    avgScore: leagueSummary?.avgScore ?? 0,
    minScore: leagueSummary?.minScore ?? 0,
    maxScore: leagueSummary?.maxScore ?? 0,
    avgFirstTowerTime: leagueSummary?.avgFirstTowerTime ?? null,
    radiantWinRate: leagueSummary?.radiantWinrate ?? 0,
    lastMatchTime: leagueSummary?.lastMatchTime ?? null,
    fastestMatch: leagueSummary?.fastestMatchId ? matchById.get(leagueSummary.fastestMatchId) ?? null : null,
    longestMatch: leagueSummary?.longestMatchId ? matchById.get(leagueSummary.longestMatchId) ?? null : null,
    minScoreMatch: leagueSummary?.minScoreMatchId ? matchById.get(leagueSummary.minScoreMatchId) ?? null : null,
    maxScoreMatch: leagueSummary?.maxScoreMatchId ? matchById.get(leagueSummary.maxScoreMatchId) ?? null : null,
  };
  const direWinRate = summary.totalMatches ? 100 - summary.radiantWinRate : 0;
  const buildHeroImageUrl = createHeroImageResolver(heroes);
  const durationDays = computeDurationDays(league.startDate, league.endDate);
  const isOngoing = isLeagueOngoing(league.endDate);

  const topTeam = [...teamParticipation].sort((a, b) => b.winrate - a.winrate)[0];
  const topTeamName = topTeam ? teamLookup.get(topTeam.teamId)?.name ?? null : null;

  const championTeam = champion ? teamLookup.get(champion.winnerTeamId) ?? null : null;
  const runnerUpTeam = champion?.runnerUpTeamId
    ? teamLookup.get(champion.runnerUpTeamId) ?? null
    : null;
  const showChampion = Boolean(champion && championTeam && !isOngoing);
  const seriesScoreLabel = champion
    ? `${champion.winnerWins}–${champion.runnerUpWins}`
    : null;
  const mostPickedHero = pickBanStats.mostPicked[0];
  const mostPickedHeroName = mostPickedHero
    ? heroLookup.get(mostPickedHero.heroId) ?? null
    : null;

  const leagueShareText = summary.totalMatches
    ? `📊 ${league.name}: ${formatNumber(summary.totalMatches)} matches, ${formatNumber(summary.totalTeams)} teams, ${summary.avgScore.toFixed(1)} avg kills — full stats on DotaData`
    : `📊 ${league.name} on DotaData — Dota 2 league stats and analysis`;
  const leagueShareUrl = `/leagues/${league.slug}`;

  const faqEntries = summary.totalMatches
    ? [
        {
          question: `How many matches were played in ${league.name}?`,
          answer: `${formatNumber(summary.totalMatches)} matches were played in ${league.name}, featuring ${formatNumber(summary.totalTeams)} teams across the tournament.`,
        },
        {
          question: `What is the average match duration in ${league.name}?`,
          answer: `Matches in ${league.name} average ${formatMinutes(summary.avgDuration)}, with ${summary.avgScore.toFixed(1)} average kills per match.`,
        },
        {
          question: `Which side has a better winrate in ${league.name}?`,
          answer: `Radiant won ${formatPercent(summary.radiantWinRate)} of matches versus ${formatPercent(direWinRate)} for Dire across ${formatNumber(summary.totalMatches)} games.`,
        },
        ...(mostPickedHeroName
          ? [
              {
                question: `Who is the most-picked hero in ${league.name}?`,
                answer: `${mostPickedHeroName} is the most-picked hero in ${league.name} with ${formatNumber(mostPickedHero.total)} picks.`,
              },
            ]
          : []),
        ...(topTeamName
          ? [
              {
                question: `Which team has the best winrate in ${league.name}?`,
                answer: `${topTeamName} leads ${league.name} with a ${formatPercent(topTeam.winrate)} winrate over ${formatNumber(topTeam.matchCount)} matches.`,
              },
            ]
          : []),
      ]
    : [];

  return (
    <>
      <Script id="league-ld-json" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: league.name,
          sport: "Dota 2",
          startDate: league.startDate ?? undefined,
          endDate: league.endDate ?? undefined,
          eventStatus: isOngoing
            ? "https://schema.org/EventScheduled"
            : "https://schema.org/EventCompleted",
          url: `https://dotadata.org/leagues/${league.slug}`,
          description: summary.totalMatches
            ? `${league.name} statistics: ${formatNumber(summary.totalMatches)} matches across ${formatNumber(summary.totalTeams)} teams.`
            : league.name,
          organizer: {
            "@type": "Organization",
            name: "DotaData",
            url: "https://dotadata.org",
          },
        })}
      </Script>

      <Script id="league-breadcrumb-ld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://dotadata.org/" },
            { "@type": "ListItem", position: 2, name: "Leagues", item: "https://dotadata.org/leagues" },
            { "@type": "ListItem", position: 3, name: league.name, item: `https://dotadata.org/leagues/${league.slug}` },
          ],
        })}
      </Script>

      {faqEntries.length > 0 && (
        <Script id="league-faq-ld" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqEntries.map((entry) => ({
              "@type": "Question",
              name: entry.question,
              acceptedAnswer: { "@type": "Answer", text: entry.answer },
            })),
          })}
        </Script>
      )}

      <article className="space-y-12">
        <Breadcrumbs
          items={[
            { title: "Leagues", url: "/leagues" },
            { title: league.name },
          ]}
        />

        {/* ── Hero header ─────────────────────────────────────────────── */}
        <header className="rounded-2xl border border-border/60 bg-card/80 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary/10 text-primary">League overview</Badge>
                {isOngoing ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
                    <Flame className="mr-1 h-3 w-3" />
                    Ongoing
                  </Badge>
                ) : league.endDate ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    Completed
                  </Badge>
                ) : null}
                {durationDays && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {durationDays} day{durationDays === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
                {league.name}
              </h1>
              <p className="text-muted-foreground">
                {summary.totalMatches ? (
                  <>
                    Competitive Dota 2 statistics for{" "}
                    <span className="font-semibold text-foreground">{league.name}</span> covering{" "}
                    <span className="font-semibold text-foreground">
                      {formatNumber(summary.totalMatches)}
                    </span>{" "}
                    matches and{" "}
                    <span className="font-semibold text-foreground">
                      {formatNumber(summary.totalTeams)}
                    </span>{" "}
                    teams. Explore pick & ban trends, top performers, team participation and per-match
                    highlights below.
                  </>
                ) : (
                  <>
                    Profile and details for{" "}
                    <span className="font-semibold text-foreground">{league.name}</span>. Match data
                    will appear here once available.
                  </>
                )}
              </p>
              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  <dt className="sr-only">League ID</dt>
                  <dd>{league.id}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <dt className="sr-only">Start date</dt>
                  <dd>Start: {formatDate(league.startDate)}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <dt className="sr-only">End date</dt>
                  <dd>End: {formatDate(league.endDate)}</dd>
                </div>
                {summary.lastMatchTime && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <dt className="sr-only">Last match</dt>
                    <dd>Last match: {formatDate(summary.lastMatchTime)}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="flex flex-wrap items-start gap-2 md:flex-col md:items-end">
              {showChampion && championTeam && (
                <Badge className="border border-amber-400/40 bg-amber-400/10 text-amber-300">
                  <Crown className="mr-1 h-3 w-3" />
                  Champion: {championTeam.name}
                </Badge>
              )}
              <ShareButton
                title={league.name}
                text={leagueShareText}
                url={leagueShareUrl}
              />
              <ExportCsvButton href={`/leagues/${league.slug}/export`} />
              <p className="text-xs text-muted-foreground md:text-right">
                Download match data for this league.
              </p>
            </div>
          </div>
        </header>

        {showChampion && champion && championTeam && (
          <ChampionSpotlight
            champion={champion}
            championTeam={championTeam}
            runnerUpTeam={runnerUpTeam}
            seriesScoreLabel={seriesScoreLabel ?? ""}
            heroLookup={heroLookup}
            playerLookup={playerLookup}
            buildHeroImageUrl={buildHeroImageUrl}
            shareTitle={`${championTeam.name} — ${league.name} champion`}
            shareText={`🏆 ${championTeam.name} won ${league.name}${runnerUpTeam ? ` over ${runnerUpTeam.name}` : ""}${seriesScoreLabel ? ` (${seriesScoreLabel})` : ""} — full league stats on DotaData`}
            shareUrl={leagueShareUrl}
          />
        )}

        {!summary.totalMatches ? (
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold text-foreground">No Match Data Available</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This league doesn&apos;t have any matches in the database yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── Key metrics ─────────────────────────────────────────── */}
            <section aria-labelledby="metrics-heading" className="space-y-4">
              <h2 id="metrics-heading" className="font-display text-2xl font-semibold">
                Key metrics
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  icon={<Swords className="h-4 w-4 text-primary" />}
                  label="Total matches"
                  value={formatNumber(summary.totalMatches)}
                  hint="Played in this league"
                />
                <KpiCard
                  icon={<Users className="h-4 w-4 text-primary" />}
                  label="Teams"
                  value={formatNumber(summary.totalTeams)}
                  hint="Competing organisations"
                />
                <KpiCard
                  icon={<Clock className="h-4 w-4 text-primary" />}
                  label="Avg duration"
                  value={formatMinutes(summary.avgDuration)}
                  hint="Match length"
                />
                <KpiCard
                  icon={<Flame className="h-4 w-4 text-primary" />}
                  label="Avg kills"
                  value={summary.avgScore.toFixed(1)}
                  hint="Per match"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-border/60 bg-card/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Score range</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Min</p>
                      <p className="text-2xl font-semibold text-foreground">{summary.minScore}</p>
                    </div>
                    <div className="h-px flex-1 bg-border/60" />
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Max</p>
                      <p className="text-2xl font-semibold text-foreground">{summary.maxScore}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Side winrate</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Radiant</p>
                      <p className="text-2xl font-semibold text-emerald-500">
                        {formatPercent(summary.radiantWinRate)}
                      </p>
                    </div>
                    <div className="h-px flex-1 bg-border/60" />
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Dire</p>
                      <p className="text-2xl font-semibold text-rose-500">
                        {formatPercent(direWinRate)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Avg first tower</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-foreground">
                      {summary.avgFirstTowerTime ? formatMinutes(summary.avgFirstTowerTime) : "N/A"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Time to first tower destruction
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ── Match highlights ────────────────────────────────────── */}
            {(summary.fastestMatch || summary.longestMatch) && (
              <section aria-labelledby="highlights-heading" className="space-y-4">
                <div>
                  <h2 id="highlights-heading" className="font-display text-2xl font-semibold">
                    Match highlights
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Standout games from {league.name} — fastest stomps and marathon battles.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {summary.fastestMatch && (
                    <HighlightCard
                      icon="⚡"
                      title="Fastest match"
                      duration={formatMinutes(summary.fastestMatch.duration)}
                      matchId={summary.fastestMatch.id}
                      radiantTeam={
                        summary.fastestMatch.radiantTeamId
                          ? teamLookup.get(summary.fastestMatch.radiantTeamId)?.name ?? "Unknown"
                          : "Unknown"
                      }
                      direTeam={
                        summary.fastestMatch.direTeamId
                          ? teamLookup.get(summary.fastestMatch.direTeamId)?.name ?? "Unknown"
                          : "Unknown"
                      }
                      winner={summary.fastestMatch.radiantWin ? "Radiant" : "Dire"}
                      shareText={`⚡ Fastest match in ${league.name}: ${formatMinutes(summary.fastestMatch.duration)} — see the breakdown on DotaData`}
                      shareUrl={leagueShareUrl}
                    />
                  )}
                  {summary.longestMatch && (
                    <HighlightCard
                      icon="⏱️"
                      title="Longest match"
                      duration={formatMinutes(summary.longestMatch.duration)}
                      matchId={summary.longestMatch.id}
                      radiantTeam={
                        summary.longestMatch.radiantTeamId
                          ? teamLookup.get(summary.longestMatch.radiantTeamId)?.name ?? "Unknown"
                          : "Unknown"
                      }
                      direTeam={
                        summary.longestMatch.direTeamId
                          ? teamLookup.get(summary.longestMatch.direTeamId)?.name ?? "Unknown"
                          : "Unknown"
                      }
                      winner={summary.longestMatch.radiantWin ? "Radiant" : "Dire"}
                      shareText={`⏱️ Longest marathon in ${league.name}: ${formatMinutes(summary.longestMatch.duration)} — see the breakdown on DotaData`}
                      shareUrl={leagueShareUrl}
                    />
                  )}
                </div>
              </section>
            )}

            {/* ── Pick & ban ─────────────────────────────────────────── */}
            <section aria-labelledby="pickban-heading" className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="pickban-heading" className="font-display text-2xl font-semibold">
                    Pick &amp; ban analysis
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Most picked, banned and contested heroes in {league.name}.
                  </p>
                </div>
                <Link
                  href={`/leagues/${league.slug}/pick-ban`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Full draft breakdown
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
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
                            <div
                              key={`${entry.team}-${entry.heroId}`}
                              className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                            >
                              <div className="h-8 w-8 overflow-hidden rounded-md border border-border/60 bg-muted">
                                {heroImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={heroImage}
                                    alt={heroName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                    N/A
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-foreground">{heroName}</p>
                              </div>
                              <div className="text-sm font-semibold text-primary">
                                {formatNumber(entry.total)}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground">No picks/bans data yet.</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* ── Top performers ─────────────────────────────────────── */}
            <section aria-labelledby="performers-heading" className="space-y-4">
              <div>
                <h2 id="performers-heading" className="font-display text-2xl font-semibold">
                  Top performers
                </h2>
                <p className="text-sm text-muted-foreground">
                  Record-setting individual performances across {league.name}.
                </p>
              </div>
              <Card className="border-border/60 bg-card/80">
                <CardContent className="pt-6">
                  {topPerformers.some((entry) => entry.performer) ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {topPerformers.map((entry) => {
                        if (!entry.performer) {
                          return (
                            <div
                              key={entry.key}
                              className="rounded-lg border border-border/60 bg-background/40 p-4"
                            >
                              <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                              <p className="mt-2 text-sm text-muted-foreground">No data available.</p>
                            </div>
                          );
                        }

                        const performer = entry.performer;
                        const heroName = performer.heroId
                          ? heroLookup.get(performer.heroId) ?? performer.heroId
                          : "Unknown";
                        const teamName = performer.teamId
                          ? teamLookup.get(performer.teamId)?.name ?? performer.teamId
                          : "Unknown";
                        const playerName = performer.accountId
                          ? playerLookup.get(performer.accountId) ?? `Player ${performer.accountId}`
                          : "Unknown";
                        const heroImage = buildHeroImageUrl(performer.heroId);

                        const shareText = `${entry.title} in ${league.name}: ${formatNumber(performer.statValue)} — ${playerName} on ${heroName} for ${teamName} (KDA ${performer.kills}/${performer.deaths}/${performer.assists}) via DotaData`;

                        return (
                          <div
                            key={entry.key}
                            className="rounded-lg border border-border/60 bg-background/40 p-4"
                          >
                            <div className="flex items-start gap-4">
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                                {heroImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={heroImage}
                                    alt={heroName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                                    N/A
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold text-foreground">
                                    {entry.title}
                                  </p>
                                  <ShareButton
                                    title={entry.title}
                                    text={shareText}
                                    url={leagueShareUrl}
                                    variant="compact"
                                    className="shrink-0"
                                  />
                                </div>
                                <p className="mt-1 text-2xl font-semibold text-primary">
                                  {formatNumber(performer.statValue)}
                                </p>
                                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                  <p>
                                    Player: <span className="text-foreground">{playerName}</span>
                                  </p>
                                  <p>
                                    Hero: <span className="text-foreground">{heroName}</span>
                                  </p>
                                  <p>
                                    Team: <span className="text-foreground">{teamName}</span>
                                  </p>
                                  <p>
                                    KDA:{" "}
                                    <span className="text-foreground">
                                      {performer.kills}/{performer.deaths}/{performer.assists}
                                    </span>
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
            </section>

            {/* ── Team participation ──────────────────────────────────── */}
            <section aria-labelledby="teams-heading" className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="teams-heading" className="font-display text-2xl font-semibold">
                    Team participation
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Win rate, match volume, and signature hero per team in {league.name}.
                  </p>
                </div>
                {topTeamName && (
                  <Badge variant="outline" className="text-muted-foreground">
                    <Trophy className="mr-1 h-3 w-3 text-primary" />
                    Best winrate: {topTeamName}
                  </Badge>
                )}
              </div>
              <Card className="border-border/60 bg-card/80">
                <CardContent className="pt-6">
                  {teamParticipation.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-border/60 text-sm">
                        <thead className="bg-muted/60">
                          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-3">Team</th>
                            <th className="px-4 py-3">Matches</th>
                            <th className="px-4 py-3">Winrate</th>
                            <th className="px-4 py-3">Most Picked Hero</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamParticipation.map((entry) => {
                            const team = teamLookup.get(entry.teamId);
                            const heroName = entry.mostPickedHeroId
                              ? heroLookup.get(entry.mostPickedHeroId) ?? entry.mostPickedHeroId
                              : null;
                            const heroImage = buildHeroImageUrl(entry.mostPickedHeroId);
                            return (
                              <tr key={entry.teamId} className="border-t border-border/60">
                                <td className="px-4 py-3 font-semibold text-primary">
                                  {team ? (
                                    <Link href={`/teams/${team.slug}`}>{team.name}</Link>
                                  ) : (
                                    <span>{entry.teamId}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {formatNumber(entry.matchCount)}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {formatPercent(entry.winrate)}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {heroName ? (
                                    <div className="flex items-center gap-2">
                                      <div className="h-8 w-8 overflow-hidden rounded-md border border-border/60 bg-muted">
                                        {heroImage ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={heroImage}
                                            alt={heroName}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                            N/A
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-foreground">
                                          {heroName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatNumber(entry.mostPickedTotal)} picks
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No team participation data available yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* ── About / FAQ for SEO ─────────────────────────────────── */}
            {faqEntries.length > 0 && (
              <section aria-labelledby="faq-heading" className="space-y-4">
                <div>
                  <h2 id="faq-heading" className="font-display text-2xl font-semibold">
                    About {league.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Frequently asked questions about {league.name} statistics.
                  </p>
                </div>
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="pt-6">
                    <div className="divide-y divide-border/60">
                      {faqEntries.map((entry) => (
                        <details
                          key={entry.question}
                          className="group py-4 first:pt-0 last:pb-0"
                        >
                          <summary className="cursor-pointer list-none font-semibold text-foreground transition-colors hover:text-primary">
                            <span className="flex items-center justify-between gap-2">
                              {entry.question}
                              <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">
                                ▾
                              </span>
                            </span>
                          </summary>
                          <p className="mt-2 text-sm text-muted-foreground">{entry.answer}</p>
                        </details>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* ── Bottom share strip ─────────────────────────────────── */}
            <section className="rounded-2xl border border-border/60 bg-card/80 p-6 text-center md:p-8">
              <h2 className="font-display text-xl font-semibold">
                Found these stats useful?
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Share {league.name} insights with your team, scrim group, or community.
              </p>
              <div className="mt-4 flex justify-center">
                <ShareButton
                  title={league.name}
                  text={leagueShareText}
                  url={leagueShareUrl}
                />
              </div>
            </section>
          </>
        )}
        <CommentsSection entityType="league" entityId={league.id} />
      </article>
    </>
  );
}

// ─── Local card components ──────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}

function KpiCard({ icon, label, value, hint }: KpiCardProps) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

interface HighlightCardProps {
  icon: string;
  title: string;
  duration: string;
  matchId: string;
  radiantTeam: string;
  direTeam: string;
  winner: string;
  shareText: string;
  shareUrl: string;
}

function HighlightCard({
  icon,
  title,
  duration,
  matchId,
  radiantTeam,
  direTeam,
  winner,
  shareText,
  shareUrl,
}: HighlightCardProps) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span aria-hidden>{icon}</span> {title}
          </CardTitle>
          <p className="mt-1 text-2xl font-semibold text-primary">{duration}</p>
        </div>
        <ShareButton title={title} text={shareText} url={shareUrl} variant="compact" />
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Radiant</span>
          <span
            className={
              winner === "Radiant" ? "font-semibold text-emerald-500" : "text-foreground"
            }
          >
            {radiantTeam}
            {winner === "Radiant" && " ✓"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Dire</span>
          <span
            className={winner === "Dire" ? "font-semibold text-rose-500" : "text-foreground"}
          >
            {direTeam}
            {winner === "Dire" && " ✓"}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-2">
          <span>Winner</span>
          <span className="font-semibold text-foreground">{winner}</span>
        </div>
        <p className="pt-1 text-xs">Match ID: {matchId}</p>
      </CardContent>
    </Card>
  );
}

interface ChampionSpotlightProps {
  champion: LeagueChampion;
  championTeam: Team;
  runnerUpTeam: Team | null;
  seriesScoreLabel: string;
  heroLookup: Map<string, string>;
  playerLookup: Map<string, string>;
  buildHeroImageUrl: (heroId: string | null | undefined) => string | null;
  shareTitle: string;
  shareText: string;
  shareUrl: string;
}

function ChampionSpotlight({
  champion,
  championTeam,
  runnerUpTeam,
  seriesScoreLabel,
  heroLookup,
  playerLookup,
  buildHeroImageUrl,
  shareTitle,
  shareText,
  shareUrl,
}: ChampionSpotlightProps) {
  return (
    <section
      aria-labelledby="champion-heading"
      className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-background p-6 md:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl"
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-400/40 bg-background/70">
            {championTeam.logoUrl ? (
              <Image
                src={championTeam.logoUrl}
                alt={`${championTeam.name} logo`}
                width={72}
                height={72}
                unoptimized
                className="h-full w-full object-contain p-1.5"
              />
            ) : (
              <Crown className="h-9 w-9 text-amber-300" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-300" />
              <p
                id="champion-heading"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300"
              >
                Champion
              </p>
            </div>
            <h2 className="font-display text-3xl font-semibold text-foreground md:text-4xl">
              <Link
                href={`/teams/${championTeam.slug}`}
                className="transition-colors hover:text-primary"
              >
                {championTeam.name}
              </Link>
            </h2>
            {runnerUpTeam && (
              <p className="text-sm text-muted-foreground">
                Defeated{" "}
                <Link
                  href={`/teams/${runnerUpTeam.slug}`}
                  className="font-semibold text-foreground transition-colors hover:text-primary"
                >
                  {runnerUpTeam.name}
                </Link>{" "}
                in the grand final
                {seriesScoreLabel && (
                  <>
                    {" "}
                    <span className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                      {seriesScoreLabel}
                    </span>
                  </>
                )}
              </p>
            )}
            {champion.finalMatchStartTime && (
              <p className="text-xs text-muted-foreground">
                Final played {formatDate(champion.finalMatchStartTime)}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <ShareButton
            title={shareTitle}
            text={shareText}
            url={shareUrl}
            variant="compact"
          />
          <Link
            href={`/teams/${championTeam.slug}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View team page
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {champion.roster.length > 0 && (
        <div className="relative mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Final-game roster
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {champion.roster.map((player, index) => {
              const heroName = player.heroId
                ? heroLookup.get(player.heroId) ?? player.heroId
                : "Unknown";
              const heroImage = buildHeroImageUrl(player.heroId);
              const playerName = player.accountId
                ? playerLookup.get(player.accountId) ?? `Player ${player.accountId}`
                : "Unknown";
              return (
                <li
                  key={`${player.accountId ?? "anon"}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                    {heroImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={heroImage}
                        alt={heroName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                        N/A
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {playerName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{heroName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {player.kills}/{player.deaths}/{player.assists}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
