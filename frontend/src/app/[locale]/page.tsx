import { setRequestLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HomeDashboardTable } from "@/components/home-dashboard-table";
import { HomeTrends } from "@/components/home-trends";
import { ShareButton } from "@/components/share-button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { apiClient } from "@/lib/api";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { summarizeMatches } from "@/lib/stats";
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
    openGraph: { title: t("title"), type: "website", url: path },
    twitter: { card: "summary_large_image" as const, title: t("title") },
    alternates: { canonical: path, languages: { en: "/", ru: "/ru", "x-default": "/" } },
  };
}

export const revalidate = 86400;

const fmtMin = (seconds: number) => `${(seconds / 60).toFixed(1)} min`;

const isLeagueOver = (endDate: string | null) => {
  if (!endDate) return false;
  const parsed = Date.parse(endDate);
  return Number.isFinite(parsed) && parsed <= Date.now();
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
      const entry = acc[match.patchId] ?? { matches: 0, durationSum: 0 };
      entry.matches += 1;
      entry.durationSum += match.duration;
      acc[match.patchId] = entry;
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
    Record<
      string,
      { matches: number; durationSum: number; scoreSum: number; radiantWins: number }
    >
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
    const parsed = Date.parse(v);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const latestMatch = matches.reduce<(typeof matches)[number] | null>((acc, m) => {
    if (!acc) return m;
    return parseMatchTime(m.startTime) > parseMatchTime(acc.startTime) ? m : acc;
  }, null);

  const latestPatch = latestMatch ? patchLookup.get(latestMatch.patchId) ?? null : null;

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
    <div className="space-y-16">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="live">Live · {currentYear}</Badge>
              {latestPatch && (
                <Badge variant="outline">Patch {latestPatch.patch}</Badge>
              )}
              <span className="eyebrow">Competitive Dota 2</span>
            </div>

            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Every series.{" "}
              <span className="text-primary">Every patch.</span>
              <br />
              One place.
            </h1>

            <p className="max-w-xl text-base text-muted-foreground md:text-lg">
              <span className="text-foreground" data-num>{formatNumber(counts.matches)}</span>{" "}
              matches indexed across{" "}
              <span className="text-foreground" data-num>{formatNumber(counts.leagues)}</span>{" "}
              leagues and{" "}
              <span className="text-foreground" data-num>{formatNumber(counts.teams)}</span>{" "}
              professional teams.
              {latestMatch?.startTime && (
                <>
                  {" "}Updated{" "}
                  <span className="text-foreground">{formatDate(latestMatch.startTime)}</span>.
                </>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="default">
                <Link href="/leagues">{tc("exploreLeagues")}</Link>
              </Button>
              <Button asChild size="default" variant="outline">
                <Link href="/teams">{tc("browseTeams")}</Link>
              </Button>
              <Button asChild size="default" variant="ghost">
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

          {/* Season at-a-glance — vertical stat block, editorial feel */}
          <div className="card-elevated p-6">
            <p className="eyebrow mb-4">Season {currentYear} · at a glance</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <KpiTile
                label="Matches"
                value={formatNumber(yearSummary.totalMatches)}
              />
              <KpiTile
                label="Radiant winrate"
                value={
                  yearSummary.totalMatches
                    ? formatPercent(yearSummary.radiantWinRate)
                    : "—"
                }
              />
              <KpiTile
                label="Avg duration"
                value={
                  yearSummary.totalMatches ? fmtMin(yearSummary.avgDuration) : "—"
                }
              />
              <KpiTile
                label="Avg kills"
                value={
                  yearSummary.totalMatches ? yearSummary.avgScore.toFixed(1) : "—"
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Season curiosities ─────────────────────────────────────────────── */}
      {yearSummary.totalMatches > 0 && (
        <section className="space-y-6">
          <SectionHead
            kicker="Stats brief"
            title="Season curiosities"
            blurb={`Standout facts from ${currentYear} competitive play — shareable in one click.`}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {yearSummary.fastestMatch && (
              <CuriosityCard
                icon="⚡"
                label="Fastest match"
                value={fmtMin(yearSummary.fastestMatch.duration)}
                context={fastestLeague?.name ?? "—"}
                exploreUrl={fastestLeague ? `/leagues/${fastestLeague.slug}` : "/leagues"}
              />
            )}
            {yearSummary.longestMatch && (
              <CuriosityCard
                icon="⏱"
                label="Longest match"
                value={fmtMin(yearSummary.longestMatch.duration)}
                context={longestLeague?.name ?? "—"}
                exploreUrl={longestLeague ? `/leagues/${longestLeague.slug}` : "/leagues"}
              />
            )}
            {yearSummary.maxScoreMatch && (
              <CuriosityCard
                icon="✦"
                label="Highest kill game"
                value={`${yearSummary.maxScore} kills`}
                context={maxScoreLeague?.name ?? "—"}
                exploreUrl={maxScoreLeague ? `/leagues/${maxScoreLeague.slug}` : "/leagues"}
              />
            )}
            {leagueRows[0] && (
              <CuriosityCard
                icon="◆"
                label="Most active league"
                value={`${formatNumber(leagueRows[0].matches)} matches`}
                context={leagueRows[0].leagueName}
                exploreUrl={`/leagues/${leagueRows[0].leagueSlug}`}
              />
            )}
          </div>
        </section>
      )}

      {/* ── Tournament spotlight ───────────────────────────────────────────── */}
      {spotlightLeagues.length > 0 && (
        <section className="space-y-6">
          <SectionHead
            kicker="Tournaments"
            title="In the spotlight"
            blurb={`Most active leagues in ${currentYear}, sorted by match volume.`}
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/leagues">All leagues →</Link>
              </Button>
            }
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

      {/* ── Trends ─────────────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <SectionHead
          kicker="Signals"
          title="Trends"
          blurb="Monthly season patterns and patch-level signals."
        />
        <HomeTrends
          matchVolume={matchVolume}
          yearlyMetrics={yearlyMetrics}
          patches={patches}
          patchTrendStats={patchTrendStats}
          leagues={leagues}
          matches={matches}
          labels={{
            title: "",
            subtitle: "",
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

      {/* ── League breakdown table ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <SectionHead
          kicker="Breakdown"
          title="League depth chart"
          blurb="Top leagues by match volume — sortable by any column."
        />
        <div className="card-elevated overflow-hidden">
          <HomeDashboardTable rows={leagueRows} />
        </div>
      </section>
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="stat-display text-3xl text-foreground md:text-4xl">{value}</p>
      <p className="eyebrow mt-1.5">{label}</p>
    </div>
  );
}

// ─── Section head ─────────────────────────────────────────────────────────────

function SectionHead({
  kicker,
  title,
  blurb,
  action,
}: {
  kicker?: string;
  title: string;
  blurb?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border-strong/40 pt-6">
      <div className="max-w-2xl space-y-2">
        {kicker && <p className="eyebrow">{kicker}</p>}
        <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h2>
        {blurb && (
          <p className="text-sm text-muted-foreground md:text-base">{blurb}</p>
        )}
      </div>
      {action}
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
      className="card-elevated focus-ring group flex flex-col justify-between p-5 transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div className="space-y-2">
        <p className="eyebrow flex items-center gap-2">
          <span aria-hidden className="text-primary">
            {icon}
          </span>
          {label}
        </p>
        <p className="stat-display text-3xl text-foreground" data-num>
          {value}
        </p>
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
      className="card-elevated focus-ring group flex flex-col p-5 transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/40"
      aria-label={`View ${league.leagueName} statistics`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 font-display text-base font-semibold leading-tight tracking-tight text-foreground group-hover:text-primary">
          {league.leagueName}
        </p>
        {isOngoing ? <Badge variant="live">Live</Badge> : null}
      </div>

      {champion ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5">
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
            <span className="text-warning">★</span>
          )}
          <span className="truncate text-xs font-medium text-foreground">
            {champion.name}
          </span>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
        {[
          { label: "Matches", value: formatNumber(league.matches) },
          { label: "Avg duration", value: fmtMin(league.avgDuration) },
          { label: "Avg kills", value: league.avgScore.toFixed(1) },
          { label: "Radiant win", value: formatPercent(league.radiantWinRate) },
        ].map((item) => (
          <div key={item.label}>
            <p className="font-display text-base font-semibold tracking-tight text-foreground" data-num>
              {item.value}
            </p>
            <p className="eyebrow mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
        Explore full stats →
      </p>
    </Link>
  );
}
