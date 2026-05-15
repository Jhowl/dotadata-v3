import Image from "next/image";
import Script from "next/script";
import { Crown, Trophy } from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { Mascot } from "@/components/mascot";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { createHeroImageResolver } from "@/lib/hero";
import { summarizeMatches } from "@/lib/stats";
import {
  getHeroes,
  getLeagueChampion,
  getLeaguePickBanStats,
  getLeagueTeamParticipation,
  getLeagues,
  getMatchesByLeagueIds,
  getPlayersByIds,
  getTeams,
  getTopPerformersByLeague,
} from "@/lib/supabase/queries";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dreamleague" });
  const path = locale === routing.defaultLocale ? "/dreamleague" : `/${locale}/dreamleague`;
  return {
    title: t("title"),
    description: t("metaDescription"),
    openGraph: { title: t("title"), description: t("metaDescription"), type: "website" as const, url: path },
    twitter: { card: "summary_large_image" as const, title: t("title"), description: t("metaDescription") },
    alternates: {
      canonical: path,
      languages: { en: "/dreamleague", ru: "/ru/dreamleague", "x-default": "/dreamleague" },
    },
  };
}

export const revalidate = 3600;

const formatMinutes = (seconds: number) => `${(seconds / 60).toFixed(1)} min`;

export default async function DreamLeaguePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dreamleague");
  const [leagues, teams, heroes] = await Promise.all([getLeagues(), getTeams(), getHeroes()]);

  const dreamLeagueLeagues = leagues.filter((league) =>
    league.name.toLowerCase().includes("dreamleague"),
  );
  const leagueIds = new Set(dreamLeagueLeagues.map((league) => league.id));
  const dreamLeagueMatches = await getMatchesByLeagueIds([...leagueIds]);
  const summary = summarizeMatches(dreamLeagueMatches);

  const teamLookup = new Map(teams.map((team) => [team.id, team.name]));
  const teamRecordMap = new Map(teams.map((team) => [team.id, team]));
  const heroLookup = new Map(heroes.map((hero) => [hero.id, hero.localizedName]));
  const buildHeroImageUrl = createHeroImageResolver(heroes);

  const [teamParticipationPerLeague, championsPerLeague] = await Promise.all([
    Promise.all([...leagueIds].map((leagueId) => getLeagueTeamParticipation(leagueId))),
    Promise.all([...leagueIds].map((leagueId) => getLeagueChampion(leagueId))),
  ]);

  const championByLeagueId = new Map(
    [...leagueIds].map((leagueId, index) => [leagueId, championsPerLeague[index]]),
  );

  const championshipsByTeam = new Map<string, number>();
  championsPerLeague.forEach((champion) => {
    if (champion?.winnerTeamId) {
      championshipsByTeam.set(
        champion.winnerTeamId,
        (championshipsByTeam.get(champion.winnerTeamId) ?? 0) + 1,
      );
    }
  });

  type AggregatedTeam = {
    teamId: string;
    matches: number;
    wins: number;
    seasons: number;
    winrate: number;
    championships: number;
  };

  const teamAgg = new Map<string, AggregatedTeam>();
  teamParticipationPerLeague.forEach((rows) => {
    rows.forEach((row) => {
      const cur = teamAgg.get(row.teamId) ?? {
        teamId: row.teamId,
        matches: 0,
        wins: 0,
        seasons: 0,
        winrate: 0,
        championships: 0,
      };
      cur.matches += row.matchCount;
      cur.wins += row.wins;
      cur.seasons += 1;
      teamAgg.set(row.teamId, cur);
    });
  });

  const aggregatedTeams: AggregatedTeam[] = Array.from(teamAgg.values())
    .filter((entry) => teamRecordMap.has(entry.teamId))
    .map((entry) => ({
      ...entry,
      winrate: entry.matches ? (entry.wins / entry.matches) * 100 : 0,
      championships: championshipsByTeam.get(entry.teamId) ?? 0,
    }))
    .sort((a, b) => {
      if (b.championships !== a.championships) return b.championships - a.championships;
      if (b.matches !== a.matches) return b.matches - a.matches;
      return b.winrate - a.winrate;
    });

  const topTeams = aggregatedTeams.slice(0, 20);
  const radiantWins = Math.round((summary.radiantWinRate / 100) * summary.totalMatches);
  const direWins = summary.totalMatches - radiantWins;

  const topPerformersByStat = (
    await Promise.all([...leagueIds].map((leagueId) => getTopPerformersByLeague(leagueId)))
  )
    .flat()
    .reduce((acc, entry) => {
      if (!entry.performer) {
        return acc;
      }
      const current = acc.get(entry.key);
      if (!current || entry.performer.statValue > current.performer.statValue) {
        acc.set(entry.key, entry);
      }
      return acc;
    }, new Map());

  const aggregatedTopPerformers = Array.from(topPerformersByStat.values());

  const performerAccountIds = aggregatedTopPerformers
    .map((entry) => entry.performer?.accountId)
    .filter((value): value is string => Boolean(value));
  const playerLookup = await getPlayersByIds(performerAccountIds);

  const pickBanBuckets = [...leagueIds].length
    ? (
        await Promise.all([...leagueIds].map((leagueId) => getLeaguePickBanStats(leagueId, 50)))
      ).reduce(
        (acc, stat) => {
          stat.mostPicked.forEach((entry) => {
            acc.picked[entry.heroId] = (acc.picked[entry.heroId] ?? 0) + entry.total;
          });
          stat.mostBanned.forEach((entry) => {
            acc.banned[entry.heroId] = (acc.banned[entry.heroId] ?? 0) + entry.total;
          });
          stat.mostContested.forEach((entry) => {
            acc.contested[entry.heroId] = (acc.contested[entry.heroId] ?? 0) + entry.total;
          });
          return acc;
        },
        {
          picked: {} as Record<string, number>,
          banned: {} as Record<string, number>,
          contested: {} as Record<string, number>,
        },
      )
    : { picked: {}, banned: {}, contested: {} };

  const toTopHeroes = (bucket: Record<string, number>, limit = 5) =>
    Object.entries(bucket)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([heroId, total]) => ({ heroId, total }));

  return (
    <>
      <Script id="dreamleague-ld-json" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "EventSeries",
          name: "DreamLeague",
          sport: "Dota 2",
          url: "https://dotadata.org/dreamleague",
          organizer: {
            "@type": "Organization",
            name: "DotaData",
            url: "https://dotadata.org",
          },
        })}
      </Script>
      <div className="space-y-10">
        <section className="relative space-y-4">
          <Mascot
            variant="peekRight"
            className="pointer-events-none absolute -right-4 -top-8 hidden h-52 w-auto opacity-90 md:block lg:-right-8 lg:h-60"
          />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <Badge className="w-fit bg-primary/10 text-primary">{t("heroBadge")}</Badge>
            <ShareButton
              title={t("title")}
              text={t("shareText", {
                editions: formatNumber(dreamLeagueLeagues.length),
                matches: formatNumber(summary.totalMatches),
              })}
              url="/dreamleague"
            />
          </div>
          <h1 className="relative font-display text-3xl font-semibold md:text-4xl">{t("heroHeading")}</h1>
          <p className="relative max-w-3xl text-muted-foreground">{t("heroLead")}</p>
          <div className="rounded-2xl border-l-4 border-primary bg-primary/10 p-4 text-sm text-muted-foreground">
            <strong className="text-foreground">{t("about.title")}</strong> {t("about.body")}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total Seasons
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatNumber(dreamLeagueLeagues.length)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total Matches
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatNumber(summary.totalMatches)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Avg Duration
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatMinutes(summary.avgDuration)}
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-foreground">All DreamLeague Seasons</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Jump into each season&apos;s page to see match timelines, team performance, and patch-specific
            shifts across the DreamLeague run.
          </p>
          {dreamLeagueLeagues.length ? (
            <div className="mt-5 columns-1 gap-3 text-sm text-muted-foreground sm:columns-2 lg:columns-3">
              {dreamLeagueLeagues.map((league) => (
                <div
                  key={league.id}
                  className="mb-3 break-inside-avoid rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                >
                  <Link href={`/leagues/${league.slug}`} className="font-semibold text-primary">
                    {league.name}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({league.startDate ? new Date(league.startDate).getFullYear() : "N/A"})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No DreamLeague events found.</p>
          )}
        </section>

        {!summary.totalMatches ? (
          <Card className="border-border/60 bg-card/80">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <Mascot variant="empty" className="h-36 w-auto opacity-90" />
              <h3 className="text-xl font-semibold text-foreground">No Match Data Available</h3>
              <p className="mt-2 text-sm text-muted-foreground">No matches for DreamLeague yet.</p>
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
                <CardContent className="grid gap-4 md:grid-cols-2">
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
                  <div>
                    <p className="text-sm text-muted-foreground">Fastest Match</p>
                    <p className="text-2xl font-semibold text-foreground">
                      {summary.fastestMatch ? formatMinutes(summary.fastestMatch.duration) : "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">Match ID: {summary.fastestMatch?.id ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Longest Match</p>
                    <p className="text-2xl font-semibold text-foreground">
                      {summary.longestMatch ? formatMinutes(summary.longestMatch.duration) : "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">Match ID: {summary.longestMatch?.id ?? "N/A"}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>Side Winrate</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex h-3 w-full overflow-hidden rounded-full border border-border/60">
                    <div
                      className="bg-emerald-500/70"
                      style={{ width: `${summary.radiantWinRate}%` }}
                      aria-label={`Radiant ${formatPercent(summary.radiantWinRate)}`}
                    />
                    <div
                      className="bg-rose-500/70"
                      style={{ width: `${100 - summary.radiantWinRate}%` }}
                      aria-label={`Dire ${formatPercent(100 - summary.radiantWinRate)}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Radiant</p>
                      <p className="mt-1 text-2xl font-semibold text-emerald-200">
                        {formatPercent(summary.radiantWinRate)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatNumber(radiantWins)} wins</p>
                    </div>
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">Dire</p>
                      <p className="mt-1 text-2xl font-semibold text-rose-200">
                        {formatPercent(100 - summary.radiantWinRate)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatNumber(direWins)} wins</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Across {formatNumber(summary.totalMatches)} DreamLeague matches.
                  </p>
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
                      Radiant:{" "}
                      {summary.fastestMatch.radiantTeamId
                        ? teamLookup.get(summary.fastestMatch.radiantTeamId)
                        : "Unknown"}
                    </p>
                    <p>
                      Dire:{" "}
                      {summary.fastestMatch.direTeamId
                        ? teamLookup.get(summary.fastestMatch.direTeamId)
                        : "Unknown"}
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
                      Radiant:{" "}
                      {summary.longestMatch.radiantTeamId
                        ? teamLookup.get(summary.longestMatch.radiantTeamId)
                        : "Unknown"}
                    </p>
                    <p>
                      Dire:{" "}
                      {summary.longestMatch.direTeamId
                        ? teamLookup.get(summary.longestMatch.direTeamId)
                        : "Unknown"}
                    </p>
                    <p>Winner: {summary.longestMatch.radiantWin ? "Radiant" : "Dire"}</p>
                  </CardContent>
                </Card>
              ) : null}
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              {[
                { title: "Most Picked", entries: toTopHeroes(pickBanBuckets.picked) },
                { title: "Most Banned", entries: toTopHeroes(pickBanBuckets.banned) },
                { title: "Most Contested", entries: toTopHeroes(pickBanBuckets.contested) },
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
                {aggregatedTopPerformers.length ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {aggregatedTopPerformers.map((entry) => {
                      if (!entry.performer) {
                        return null;
                      }
                      const performer = entry.performer;
                      const heroName = performer.heroId
                        ? heroLookup.get(performer.heroId) ?? performer.heroId
                        : "Unknown";
                      const teamName = performer.teamId
                        ? teamLookup.get(performer.teamId) ?? performer.teamId
                        : "Unknown";
                      const playerName = performer.accountId
                        ? playerLookup.get(performer.accountId) ?? `Player ${performer.accountId}`
                        : "Unknown";
                      const heroImage = buildHeroImageUrl(performer.heroId);

                      const shareText = `${entry.title} at DreamLeague: ${formatNumber(performer.statValue)} — ${playerName} on ${heroName} for ${teamName} (KDA ${performer.kills}/${performer.deaths}/${performer.assists}) via DotaData`;

                      return (
                        <div key={entry.key} className="rounded-lg border border-border/60 bg-background/40 p-4">
                          <div className="flex items-start gap-4">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                              {heroImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={heroImage} alt={heroName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                                  N/A
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                                <ShareButton
                                  title={entry.title}
                                  text={shareText}
                                  url="/dreamleague"
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
          </>
        )}

        {topTeams.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">Team participation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Aggregated across every DreamLeague season — ranked by championships, then total matches.
              </p>
            </div>
            <Card className="border-border/60 bg-card/80">
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-border/60 text-sm">
                    <thead className="bg-muted/60">
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Team</th>
                        <th className="px-4 py-3">Seasons</th>
                        <th className="px-4 py-3">Matches</th>
                        <th className="px-4 py-3">Wins</th>
                        <th className="px-4 py-3">Winrate</th>
                        <th className="px-4 py-3">Titles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topTeams.map((entry, index) => {
                        const team = teamRecordMap.get(entry.teamId);
                        if (!team) return null;
                        return (
                          <tr key={entry.teamId} className="border-t border-border/60">
                            <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                            <td className="px-4 py-3 font-semibold text-primary">
                              <Link href={`/teams/${team.slug}`} className="inline-flex items-center gap-2">
                                {team.logoUrl ? (
                                  <Image
                                    src={team.logoUrl}
                                    alt=""
                                    width={24}
                                    height={24}
                                    unoptimized
                                    className="h-6 w-6 rounded-sm object-contain"
                                  />
                                ) : (
                                  <span className="inline-block h-6 w-6 rounded-sm bg-muted" />
                                )}
                                <span>{team.name}</span>
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{formatNumber(entry.seasons)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatNumber(entry.matches)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatNumber(entry.wins)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatPercent(entry.winrate)}</td>
                            <td className="px-4 py-3">
                              {entry.championships > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                                  <Trophy className="h-3 w-3" />
                                  {entry.championships}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {aggregatedTeams.length > topTeams.length && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Showing top {topTeams.length} of {formatNumber(aggregatedTeams.length)} teams.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        <section className="rounded-2xl border border-border/60 bg-card/80 p-6">
          <h2 className="font-display text-xl font-semibold">Season Overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Champion (where known) and start date for each DreamLeague season.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {dreamLeagueLeagues.map((league) => {
              const champion = championByLeagueId.get(league.id);
              const championTeam = champion ? teamRecordMap.get(champion.winnerTeamId) : null;
              return (
                <div key={league.id} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{league.name}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(league.startDate)}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      ID {league.id}
                    </Badge>
                  </div>
                  {championTeam && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5">
                      <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                      {championTeam.logoUrl ? (
                        <Image
                          src={championTeam.logoUrl}
                          alt=""
                          width={20}
                          height={20}
                          unoptimized
                          className="h-5 w-5 rounded-sm object-contain"
                        />
                      ) : null}
                      <Link
                        href={`/teams/${championTeam.slug}`}
                        className="truncate text-xs font-semibold text-foreground hover:text-primary"
                      >
                        {championTeam.name}
                      </Link>
                      {champion ? (
                        <span className="ml-auto shrink-0 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                          {champion.winnerWins}–{champion.runnerUpWins}
                        </span>
                      ) : null}
                    </div>
                  )}
                  <Link
                    href={`/leagues/${league.slug}`}
                    className="mt-3 inline-flex text-sm font-semibold text-primary"
                  >
                    View league stats
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
