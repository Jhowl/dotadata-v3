import Script from "next/script";
import { setRequestLocale, getTranslations } from "next-intl/server";

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
  getLeaguePickBanStats,
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
  const t = await getTranslations({ locale, namespace: "international" });
  const path = locale === routing.defaultLocale ? "/the-international" : `/${locale}/the-international`;
  return {
    title: t("title"),
    description: t("metaDescription"),
    openGraph: { title: t("title"), description: t("metaDescription"), type: "website" as const, url: path },
    twitter: { card: "summary_large_image" as const, title: t("title"), description: t("metaDescription") },
    alternates: { canonical: path, languages: { en: "/the-international", ru: "/ru/the-international" } },
  };
}

export const revalidate = 3600;

const formatMinutes = (seconds: number) => `${(seconds / 60).toFixed(1)} min`;

export default async function InternationalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("international");
  const [leagues, teams, heroes] = await Promise.all([getLeagues(), getTeams(), getHeroes()]);

  const internationalLeagues = leagues.filter((league) =>
    league.name.toLowerCase().includes("international")
  );
  const leagueIds = new Set(internationalLeagues.map((league) => league.id));
  const internationalMatches = await getMatchesByLeagueIds([...leagueIds]);
  const summary = summarizeMatches(internationalMatches);

  const teamLookup = new Map(teams.map((team) => [team.id, team.name]));
  const heroLookup = new Map(heroes.map((hero) => [hero.id, hero.localizedName]));
  const buildHeroImageUrl = createHeroImageResolver(heroes);

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
        }
      )
    : { picked: {}, banned: {}, contested: {} };

  const toTopHeroes = (bucket: Record<string, number>, limit = 5) =>
    Object.entries(bucket)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([heroId, total]) => ({ heroId, total }));

  return (
    <>
      <Script id="ti-ld-json" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "EventSeries",
          name: "The International",
          sport: "Dota 2",
          url: "https://dotadata.org/the-international",
          organizer: {
            "@type": "Organization",
            name: "DotaData",
            url: "https://dotadata.org",
          },
        })}
      </Script>
      <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Badge className="w-fit bg-primary/10 text-primary">{t("heroBadge")}</Badge>
          <ShareButton
            title={t("title")}
            text={t("shareText", {
              editions: formatNumber(internationalLeagues.length),
              matches: formatNumber(summary.totalMatches),
            })}
            url="/the-international"
          />
        </div>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{t("heroHeading")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("heroLead")}</p>
        <div className="rounded-2xl border-l-4 border-primary bg-primary/10 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">{t("about.title")}</strong> {t("about.body")}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Editions</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(internationalLeagues.length)}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Matches</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(summary.totalMatches)}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avg Duration</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatMinutes(summary.avgDuration)}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-foreground">All The International Editions</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Jump into each year&apos;s tournament page to see match timelines, team performance, and patch-specific
          shifts that shaped the meta.
        </p>
        {internationalLeagues.length ? (
          <div className="mt-5 columns-1 gap-3 text-sm text-muted-foreground sm:columns-2 lg:columns-3">
            {internationalLeagues.map((league) => (
              <div key={league.id} className="mb-3 break-inside-avoid rounded-lg border border-border/60 bg-background/40 px-3 py-2">
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
          <p className="mt-4 text-sm text-muted-foreground">No International events found.</p>
        )}
      </section>

      {!summary.totalMatches ? (
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-semibold text-foreground">No Match Data Available</h3>
            <p className="mt-2 text-sm text-muted-foreground">No matches for The International yet.</p>
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
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Radiant</p>
                  <p className="text-2xl font-semibold text-foreground">{formatPercent(summary.radiantWinRate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dire</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {formatPercent(100 - summary.radiantWinRate)}
                  </p>
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
                    const teamName = performer.teamId ? teamLookup.get(performer.teamId) ?? performer.teamId : "Unknown";
                    const playerName = performer.accountId
                      ? playerLookup.get(performer.accountId) ?? `Player ${performer.accountId}`
                      : "Unknown";
                    const heroImage = buildHeroImageUrl(performer.heroId);

                    const shareText = `${entry.title} at The International: ${formatNumber(performer.statValue)} — ${playerName} on ${heroName} for ${teamName} (KDA ${performer.kills}/${performer.deaths}/${performer.assists}) via DotaData`;

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
                                url="/the-international"
                                variant="compact"
                                className="shrink-0"
                              />
                            </div>
                            <p className="mt-1 text-2xl font-semibold text-primary">
                              {formatNumber(performer.statValue)}
                            </p>
                            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                              <p>Player: <span className="text-foreground">{playerName}</span></p>
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
        </>
      )}

      <section className="rounded-2xl border border-border/60 bg-card/80 p-6">
        <h2 className="font-display text-xl font-semibold">Event Overview</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {internationalLeagues.map((league) => (
            <div key={league.id} className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{league.name}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(league.startDate)}</p>
                </div>
                <Badge variant="outline">League ID {league.id}</Badge>
              </div>
              <Link href={`/leagues/${league.slug}`} className="mt-3 inline-flex text-sm font-semibold text-primary">
                View league stats
              </Link>
            </div>
          ))}
        </div>
      </section>
      </div>
    </>
  );
}
