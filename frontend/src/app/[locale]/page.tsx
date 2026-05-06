import { setRequestLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HomeDashboardTable } from "@/components/home-dashboard-table";
import { HomeTrends } from "@/components/home-trends";
import { ShareButton } from "@/components/share-button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { summarizeMatches } from "@/lib/stats";
import { apiClient } from "@/lib/api";
import type { Team } from "@shared/types/index";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const path = locale === routing.defaultLocale ? "/" : `/${locale}`;

  return {
    title: t("title"),
    description: t("metaDescription", { matches: "—", leagues: "—", teams: "—" }),
    openGraph: {
      title: t("title"),
      type: "website",
      url: path,
    },
    twitter: {
      card: "summary_large_image" as const,
      title: t("title"),
    },
    alternates: {
      canonical: path,
      languages: { en: "/", ru: "/ru" },
    },
  };
}

export const revalidate = 86400;

const fmt = (seconds: number) => `${(seconds / 60).toFixed(1)} min`;

const isLeagueOver = (endDate: string | null) => {
  if (!endDate) return false;
  const parsed = Date.parse(endDate);
  if (Number.isNaN(parsed)) return false;
  return parsed <= Date.now();
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const currentYear = new Date().getFullYear();
  const [counts, leagues, patches, matches, teams, lastWinners] = await Promise.all([
    apiClient.counts(),
    apiClient.leagues.list(),
    apiClient.patches.list(),
    apiClient.seasons.matches(currentYear),
    apiClient.teams.list(),
    apiClient.leagues.lastWinners(),
  ]);

  const leagueLookup = new Map(leagues.map((l) => [l.id, l]));
  const patchLookup = new Map(patches.map((p) => [p.id, p]));
  const teamLookup = new Map(teams.map((team) => [team.id, team]));

  const yearSummary = summarizeMatches(matches);

  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  const monthlyBuckets = Array.from({ length: 12 }, (_, index) => ({
    month: monthFormatter.format(new Date(currentYear, index, 1)),
    matchCount: 0,
    durationSum: 0,
    scoreSum: 0,
    count: 0,
  }));

  matches.forEach((match) => {
    const parsed = new Date(match.startTime);
    if (Number.isNaN(parsed.getTime())) return;
    const bucket = monthlyBuckets[parsed.getMonth()];
    bucket.matchCount += 1;
    bucket.durationSum += match.duration;
    bucket.scoreSum += match.radiantScore + match.direScore;
    bucket.count += 1;
  });

  const matchVolume = monthlyBuckets.map((b) => ({ month: b.month, value: b.matchCount }));
  const yearlyMetrics = monthlyBuckets.map((b) => ({
    month: b.month,
    avgDuration: b.count ? Number(((b.durationSum / b.count) / 60).toFixed(1)) : 0,
    avgScore: b.count ? Number((b.scoreSum / b.count).toFixed(1)) : 0,
  }));

  const patchTotals = matches.reduce<Record<string, { matches: number; durationSum: number }>>(
    (acc, match) => {
      const key = match.patchId;
      const entry = acc[key] ?? { matches: 0, durationSum: 0 };
      entry.matches += 1;
      entry.durationSum += match.duration;
      acc[key] = entry;
      return acc;
    },
    {},
  );

  const patchTrendStats = Object.entries(patchTotals).map(([patchId, entry]) => ({
    patchId,
    matches: entry.matches,
    avgDuration: entry.matches ? entry.durationSum / entry.matches / 60 : 0,
  }));

  const leagueStats = matches.reduce<
    Record<string, { matches: number; durationSum: number; scoreSum: number; radiantWins: number }>
  >((acc, match) => {
    const entry = acc[match.leagueId] ?? {
      matches: 0,
      durationSum: 0,
      scoreSum: 0,
      radiantWins: 0,
    };
    entry.matches += 1;
    entry.durationSum += match.duration;
    entry.scoreSum += match.radiantScore + match.direScore;
    entry.radiantWins += match.radiantWin ? 1 : 0;
    acc[match.leagueId] = entry;
    return acc;
  }, {});

  const leagueRows = Object.entries(leagueStats)
    .map(([leagueId, stats]) => {
      const league = leagueLookup.get(leagueId);
      if (!league) return null;
      return {
        leagueId,
        leagueName: league.name,
        leagueSlug: league.slug,
        matches: stats.matches,
        avgDuration: stats.matches ? stats.durationSum / stats.matches : 0,
        avgScore: stats.matches ? stats.scoreSum / stats.matches : 0,
        radiantWinRate: stats.matches ? (stats.radiantWins / stats.matches) * 100 : 0,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 12);

  const parseMatchTime = (v: string) => {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  };

  const latestMatch = matches.reduce<(typeof matches)[number] | null>((acc, m) => {
    if (!acc) return m;
    return parseMatchTime(m.startTime) > parseMatchTime(acc.startTime) ? m : acc;
  }, null);

  const latestPatch = latestMatch ? patchLookup.get(latestMatch.patchId) ?? null : null;

  // Curiosity card data
  const fastestLeague = yearSummary.fastestMatch
    ? leagueLookup.get(yearSummary.fastestMatch.leagueId) ?? null
    : null;
  const longestLeague = yearSummary.longestMatch
    ? leagueLookup.get(yearSummary.longestMatch.leagueId) ?? null
    : null;
  const maxScoreLeague = yearSummary.maxScoreMatch
    ? leagueLookup.get(yearSummary.maxScoreMatch.leagueId) ?? null
    : null;
  const spotlightLeagues = leagueRows.slice(0, 4);

  return (
    <div className="space-y-10">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border/60 bg-card/80 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">Live · {currentYear}</Badge>
              {latestPatch && (
                <Badge variant="outline" className="text-muted-foreground">
                  Patch {latestPatch.patch}
                </Badge>
              )}
            </div>
            <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
              Competitive Dota&nbsp;2<br />analytics, match by match
            </h1>
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">
                {formatNumber(counts.matches)}
              </span>{" "}
              matches indexed across{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(counts.leagues)}
              </span>{" "}
              leagues and{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(counts.teams)}
              </span>{" "}
              teams.
              {latestMatch?.startTime && (
                <>
                  {" "}Last updated{" "}
                  <span className="text-foreground">{formatDate(latestMatch.startTime)}</span>.
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="sm">
                <Link href="/leagues">{tc("exploreLeagues")}</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href="/teams">{tc("browseTeams")}</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/patches">{tc("patchAnalysis")}</Link>
              </Button>
              <ShareButton
                title={`${tc("siteName")} — ${tc("siteTagline")}`}
                text={t("shareText", {
                  matches: formatNumber(counts.matches),
                  leagues: formatNumber(counts.leagues),
                  teams: formatNumber(counts.teams),
                })}
                url="/"
              />
            </div>
          </div>

          {/* Season at-a-glance numbers */}
          <div className="grid grid-cols-2 gap-3 md:min-w-[240px]">
            {[
              {
                label: `${currentYear} matches`,
                value: formatNumber(yearSummary.totalMatches),
              },
              {
                label: "Radiant winrate",
                value: yearSummary.totalMatches
                  ? formatPercent(yearSummary.radiantWinRate)
                  : "—",
              },
              {
                label: "Avg duration",
                value: yearSummary.totalMatches ? fmt(yearSummary.avgDuration) : "—",
              },
              {
                label: "Avg kills",
                value: yearSummary.totalMatches
                  ? yearSummary.avgScore.toFixed(1)
                  : "—",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border/60 bg-background/50 p-4 text-center"
              >
                <p className="text-xl font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Season curiosities ───────────────────────────────────────────── */}
      {yearSummary.totalMatches > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Season curiosities</h2>
            <p className="text-sm text-muted-foreground">
              Standout facts from {currentYear} competitive play — shareable in one click.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {yearSummary.fastestMatch && (
              <CuriosityCard
                icon="⚡"
                label="Fastest match"
                value={fmt(yearSummary.fastestMatch.duration)}
                context={fastestLeague?.name ?? "—"}
                exploreUrl={fastestLeague ? `/leagues/${fastestLeague.slug}` : "/leagues"}
              />
            )}

            {yearSummary.longestMatch && (
              <CuriosityCard
                icon="⏱️"
                label="Longest match"
                value={fmt(yearSummary.longestMatch.duration)}
                context={longestLeague?.name ?? "—"}
                exploreUrl={longestLeague ? `/leagues/${longestLeague.slug}` : "/leagues"}
              />
            )}

            {yearSummary.maxScoreMatch && (
              <CuriosityCard
                icon="💥"
                label="Highest kill game"
                value={`${yearSummary.maxScore} kills`}
                context={maxScoreLeague?.name ?? "—"}
                exploreUrl={maxScoreLeague ? `/leagues/${maxScoreLeague.slug}` : "/leagues"}
              />
            )}

            {leagueRows[0] && (
              <CuriosityCard
                icon="🏆"
                label="Most active league"
                value={`${formatNumber(leagueRows[0].matches)} matches`}
                context={leagueRows[0].leagueName}
                exploreUrl={`/leagues/${leagueRows[0].leagueSlug}`}
              />
            )}
          </div>
        </section>
      )}

      {/* ── Tournament spotlight ─────────────────────────────────────────── */}
      {spotlightLeagues.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">Tournament spotlight</h2>
              <p className="text-sm text-muted-foreground">
                Most active leagues in {currentYear}, sorted by match volume.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/leagues">All leagues</Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {spotlightLeagues.map((league) => {
              const leagueRecord = leagueLookup.get(league.leagueId);
              const winner = lastWinners[league.leagueId];
              const champion =
                winner && leagueRecord && isLeagueOver(leagueRecord.endDate)
                  ? teamLookup.get(winner.teamId) ?? null
                  : null;
              const isOngoing = Boolean(
                leagueRecord && !isLeagueOver(leagueRecord.endDate),
              );
              return (
                <LeagueSpotlightCard
                  key={league.leagueId}
                  league={league}
                  champion={champion}
                  isOngoing={isOngoing}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Trends ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <HomeTrends
          matchVolume={matchVolume}
          yearlyMetrics={yearlyMetrics}
          patches={patches}
          patchTrendStats={patchTrendStats}
          leagues={leagues}
          matches={matches}
          labels={{
            title: "Trends",
            subtitle: "Monthly season patterns and patch-level signals.",
            matchVolume: `${currentYear} match volume`,
            matchVolumeDesc: "Monthly match count (current year).",
            durationKills: "Duration & kills",
            durationKillsDesc: "Average duration (minutes) and kills by month.",
            patchTrend: "Patch trend",
            patchTrendDesc: "Matches and average duration (min) by patch.",
            leagueActivity: "League activity",
            leagueActivityDesc: "Match volume across active leagues.",
          }}
        />
      </section>

      {/* ── League breakdown table ───────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">League breakdown</h2>
          <p className="text-sm text-muted-foreground">
            Top leagues by match volume — sortable by any column.
          </p>
        </div>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="pt-6">
            <HomeDashboardTable rows={leagueRows} />
          </CardContent>
        </Card>
      </section>

    </div>
  );
}

// ─── Curiosity card ───────────────────────────────────────────────────────────

interface CuriosityCardProps {
  icon: string;
  label: string;
  value: string;
  context: string;
  exploreUrl: string;
}

function CuriosityCard({ icon, label, value, context, exploreUrl }: CuriosityCardProps) {
  return (
    <Link
      href={exploreUrl}
      className="group flex flex-col justify-between rounded-2xl border border-border/60 bg-card/80 p-5 transition-colors hover:border-primary/40 hover:bg-card"
    >
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{icon}</span>
          {label}
        </p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <p className="truncate text-sm text-muted-foreground">{context}</p>
      </div>
      <p className="mt-4 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
        View league →
      </p>
    </Link>
  );
}

// ─── League spotlight card ────────────────────────────────────────────────────

interface LeagueSpotlightCardProps {
  league: {
    leagueId: string;
    leagueName: string;
    leagueSlug: string;
    matches: number;
    avgDuration: number;
    avgScore: number;
    radiantWinRate: number;
  };
  champion: Team | null;
  isOngoing: boolean;
}

function LeagueSpotlightCard({ league, champion, isOngoing }: LeagueSpotlightCardProps) {
  return (
    <Link
      href={`/leagues/${league.leagueSlug}`}
      className="group flex flex-col rounded-2xl border border-border/60 bg-card/80 p-5 transition-colors hover:border-primary/40 hover:bg-card"
      aria-label={`View ${league.leagueName} statistics`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 font-display text-base font-semibold text-foreground group-hover:text-primary">
          {league.leagueName}
        </p>
        {isOngoing ? (
          <Badge className="shrink-0 bg-primary/10 text-primary">Live</Badge>
        ) : null}
      </div>

      {champion ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5">
          {champion.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={champion.logoUrl}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 rounded object-contain"
            />
          ) : (
            <span className="text-amber-400">🏆</span>
          )}
          <span className="truncate text-xs font-medium text-foreground">
            {champion.name}
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { label: "Matches", value: formatNumber(league.matches) },
          { label: "Avg duration", value: fmt(league.avgDuration) },
          { label: "Avg kills", value: league.avgScore.toFixed(1) },
          { label: "Radiant win", value: formatPercent(league.radiantWinRate) },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
        Explore full stats →
      </p>
    </Link>
  );
}
