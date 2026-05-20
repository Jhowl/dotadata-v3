import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HomeDashboardTable } from "@/components/home-dashboard-table";
import { HomeTrends } from "@/components/home-trends";
import { Mascot } from "@/components/mascot";
import { ShareButton } from "@/components/share-button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { apiClient } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/format";
import { createHeroImageResolver } from "@/lib/hero";
import { summarizeMatches } from "@/lib/stats";
import type { League, Match, Team } from "@shared/types/index";

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

export const revalidate = 300;

const fmtMin = (seconds: number) => `${(seconds / 60).toFixed(1)} min`;

const parseTime = (value: string | null | undefined) => {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
};

const isLeagueLive = (startDate: string | null, endDate: string | null) => {
  const start = parseTime(startDate);
  const end = parseTime(endDate);
  const ts = Date.now();
  if (!start || start > ts) return false;
  if (end && end < ts) return false;
  return true;
};

// A league's endDate is often stale or wrong, which hides leagues that are
// still playing (e.g. 19696). Recent match activity is the reliable signal:
// a game within the last 2 days means the tournament is effectively live.
const RECENT_MATCH_MS = 2 * 24 * 60 * 60 * 1000;
const hasRecentMatches = (lastMatchTime: string | null | undefined) => {
  const t = parseTime(lastMatchTime);
  return t != null && Date.now() - t < RECENT_MATCH_MS;
};

const isLeagueFinishedInYear = (endDate: string | null, year: number) => {
  const end = parseTime(endDate);
  if (!end || end >= Date.now()) return false;
  return new Date(end).getFullYear() === year;
};

const formatRelative = (value: string | null | undefined) => {
  const t = parseTime(value);
  if (!t) return "—";
  const diff = Date.now() - t;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.round(day / 30);
  return `${mo}mo ago`;
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

  const [counts, leagues, leagueSummaries, patches, matches, teams, lastWinners, heroes] =
    await Promise.all([
      apiClient.counts(),
      apiClient.leagues.list(),
      apiClient.leagues.summaries(),
      apiClient.patches.list(),
      apiClient.seasons.matches(currentYear),
      apiClient.teams.list(),
      apiClient.leagues.lastWinners(),
      apiClient.heroes(),
    ]);

  const leagueLookup = new Map(leagues.map((l) => [l.id, l]));
  const teamLookup = new Map(teams.map((tm) => [tm.id, tm]));
  const summaryByLeague = new Map(leagueSummaries.map((s) => [s.leagueId, s]));
  const heroLookup = new Map(heroes.map((h) => [h.id, h]));
  const resolveHeroImage = createHeroImageResolver(heroes);

  const yearSummary = summarizeMatches(matches);
  const fastestLeague: League | null = yearSummary.fastestMatch
    ? leagueLookup.get(yearSummary.fastestMatch.leagueId) ?? null
    : null;
  const longestLeague: League | null = yearSummary.longestMatch
    ? leagueLookup.get(yearSummary.longestMatch.leagueId) ?? null
    : null;
  const maxScoreLeague: League | null = yearSummary.maxScoreMatch
    ? leagueLookup.get(yearSummary.maxScoreMatch.leagueId) ?? null
    : null;

  const lastMatchTimeOf = (leagueId: string) =>
    summaryByLeague.get(leagueId)?.lastMatchTime ?? null;

  const liveLeagues = leagues
    .filter(
      (l) =>
        isLeagueLive(l.startDate, l.endDate) ||
        hasRecentMatches(lastMatchTimeOf(l.id)),
    )
    .sort(
      (a, b) =>
        (parseTime(lastMatchTimeOf(b.id)) ?? parseTime(b.startDate) ?? 0) -
        (parseTime(lastMatchTimeOf(a.id)) ?? parseTime(a.startDate) ?? 0),
    )
    .slice(0, 4);

  const latestMatches = matches
    .slice()
    .sort((a, b) => (parseTime(b.startTime) ?? 0) - (parseTime(a.startTime) ?? 0))
    .slice(0, 8);

  const latestMatch = latestMatches[0] ?? null;
  const latestPatch = latestMatch
    ? patches.find((p) => p.id === latestMatch.patchId) ?? null
    : null;

  const heroPickCounts = new Map<string, number>();
  matches.forEach((match) => {
    if (!match.picksBans) return;
    match.picksBans.forEach((entry) => {
      if (!entry.is_pick) return;
      const id = String(entry.hero_id);
      heroPickCounts.set(id, (heroPickCounts.get(id) ?? 0) + 1);
    });
  });
  const topMetaHeroes = Array.from(heroPickCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([heroId, count]) => {
      const hero = heroLookup.get(heroId);
      if (!hero) return null;
      return { hero, count, image: resolveHeroImage(heroId) };
    })
    .filter((entry): entry is { hero: { id: string; localizedName: string; name: string }; count: number; image: string | null } => Boolean(entry));

  const championCounts = new Map<string, number>();
  Object.entries(lastWinners).forEach(([leagueId, winner]) => {
    if (!winner) return;
    const league = leagueLookup.get(leagueId);
    if (!league || !isLeagueFinishedInYear(league.endDate, currentYear)) return;
    championCounts.set(winner.teamId, (championCounts.get(winner.teamId) ?? 0) + 1);
  });
  const topChampions = Array.from(championCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([teamId, trophies]) => ({ team: teamLookup.get(teamId) ?? null, trophies }))
    .filter((entry): entry is { team: Team; trophies: number } => Boolean(entry.team));

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

  return (
    <div className="space-y-12">
      {/* ── Hero — tight SEO band ──────────────────────────────────────────── */}
      <section className="relative">
        <Mascot
          variant="hero"
          priority
          className="pointer-events-none absolute -top-4 right-0 z-0 hidden h-32 w-auto opacity-90 md:block lg:h-40 xl:h-48"
        />
        <div className="relative z-10 max-w-3xl space-y-3 pr-0 md:pr-40 lg:pr-48">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="live">{t("liveBadge", { year: currentYear })}</Badge>
            {latestPatch && (
              <Badge variant="outline">{t("patchLabel", { patch: latestPatch.patch })}</Badge>
            )}
          </div>

          <h1 className="font-display text-xl font-semibold leading-tight tracking-tight md:text-3xl">
            {t("heroTitle")}
          </h1>

          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            {t.rich("heroLead", {
              matches: formatNumber(counts.matches),
              leagues: formatNumber(counts.leagues),
              teams: formatNumber(counts.teams),
              n: (chunks) => (
                <span className="text-foreground" data-num>
                  {chunks}
                </span>
              ),
            })}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button asChild size="sm">
              <Link href="/leagues">{tc("exploreLeagues")}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/teams">{tc("browseTeams")}</Link>
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
      </section>

      {/* ── Season {year} dashboard — KPI strip + curiosities ──────────────── */}
      {yearSummary.totalMatches > 0 && (
        <section className="space-y-4">
          <SectionHead
            title={t("season.title", { year: currentYear })}
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href={`/seasons/${currentYear}`}>
                  {t("season.viewSeason")} →
                </Link>
              </Button>
            }
          />
          <div className="card-elevated grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-4">
            <KpiTile
              label={t("season.matches")}
              value={formatNumber(yearSummary.totalMatches)}
            />
            <KpiTile
              label={t("season.avgDuration")}
              value={fmtMin(yearSummary.avgDuration)}
            />
            <KpiTile
              label={t("season.avgKills")}
              value={yearSummary.avgScore.toFixed(1)}
            />
            <KpiTile
              label={t("season.radiantWin")}
              value={formatPercent(yearSummary.radiantWinRate)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {yearSummary.fastestMatch && (
              <CuriosityCard
                icon="⚡"
                label={t("season.fastest")}
                value={fmtMin(yearSummary.fastestMatch.duration)}
                context={fastestLeague?.name ?? "—"}
                href={fastestLeague ? `/leagues/${fastestLeague.slug}` : "/leagues"}
              />
            )}
            {yearSummary.longestMatch && (
              <CuriosityCard
                icon="⏱"
                label={t("season.longest")}
                value={fmtMin(yearSummary.longestMatch.duration)}
                context={longestLeague?.name ?? "—"}
                href={longestLeague ? `/leagues/${longestLeague.slug}` : "/leagues"}
              />
            )}
            {yearSummary.maxScoreMatch && (
              <CuriosityCard
                icon="✦"
                label={t("season.highestKills")}
                value={formatNumber(yearSummary.maxScore)}
                context={maxScoreLeague?.name ?? "—"}
                href={maxScoreLeague ? `/leagues/${maxScoreLeague.slug}` : "/leagues"}
              />
            )}
            {leagueRows[0] && (
              <CuriosityCard
                icon="◆"
                label={t("season.mostActive")}
                value={formatNumber(leagueRows[0].matches)}
                context={leagueRows[0].leagueName}
                href={`/leagues/${leagueRows[0].leagueSlug}`}
              />
            )}
          </div>
        </section>
      )}

      {/* ── Live now ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHead
          title={t("liveNow.title")}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/leagues">{t("liveNow.viewAll")} →</Link>
            </Button>
          }
        />
        {liveLeagues.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {liveLeagues.map((league) => {
              const summary = summaryByLeague.get(league.id);
              const winner = lastWinners[league.id];
              const leader = winner ? teamLookup.get(winner.teamId) ?? null : null;
              return (
                <LiveLeagueCard
                  key={league.id}
                  league={league}
                  matches={summary?.totalMatches ?? null}
                  lastMatchTime={summary?.lastMatchTime ?? null}
                  leader={leader}
                  leaderLabel={t("liveNow.lastWinner")}
                  matchesLabel={t("liveNow.matchesLabel")}
                />
              );
            })}
          </div>
        ) : (
          <div className="card-elevated p-6 text-sm text-muted-foreground">
            {t("liveNow.empty")}
          </div>
        )}
      </section>

      {/* ── Latest results ─────────────────────────────────────────────────── */}
      {latestMatches.length > 0 && (
        <section className="space-y-4">
          <SectionHead title={t("latestResults.title")} />
          <div className="grid gap-2 md:grid-cols-2">
            {latestMatches.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                radiant={match.radiantTeamId ? teamLookup.get(match.radiantTeamId) ?? null : null}
                dire={match.direTeamId ? teamLookup.get(match.direTeamId) ?? null : null}
                league={leagueLookup.get(match.leagueId) ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Current meta ───────────────────────────────────────────────────── */}
      {topMetaHeroes.length > 0 && (
        <section className="space-y-4">
          <SectionHead title={t("meta.title")} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {topMetaHeroes.map(({ hero, count, image }) => (
              <MetaHeroTile
                key={hero.id}
                name={hero.localizedName}
                image={image}
                label={t("meta.picksLabel", { count })}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Year champions ─────────────────────────────────────────────────── */}
      {topChampions.length > 0 && (
        <section className="space-y-4">
          <SectionHead title={t("champions.title", { year: currentYear })} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topChampions.map(({ team, trophies }) => (
              <ChampionTeamCard
                key={team.id}
                team={team}
                trophies={trophies}
                label={t("champions.trophies", { count: trophies })}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Trends ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHead title={t("trends.title")} />
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

      {/* ── League depth chart ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHead title={t("leagueTable.title")} />
        <div className="card-elevated overflow-hidden">
          <HomeDashboardTable rows={leagueRows} />
        </div>
      </section>
    </div>
  );
}

// ─── Section head ─────────────────────────────────────────────────────────────

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border-strong/40 pt-5">
      <h2 className="font-display text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
      {action}
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="stat-display text-2xl text-foreground md:text-3xl" data-num>
        {value}
      </p>
      <p className="eyebrow mt-1">{label}</p>
    </div>
  );
}

// ─── Curiosity card ───────────────────────────────────────────────────────────

function CuriosityCard({
  icon,
  label,
  value,
  context,
  href,
}: {
  icon: string;
  label: string;
  value: string;
  context: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="card-elevated focus-ring group flex flex-col gap-1.5 p-4 transition-[transform,border-color] hover:-translate-y-0.5 hover:border-primary/40"
    >
      <p className="eyebrow flex items-center gap-2">
        <span aria-hidden className="text-primary">
          {icon}
        </span>
        {label}
      </p>
      <p className="font-display text-2xl font-semibold tracking-tight text-foreground" data-num>
        {value}
      </p>
      <p className="truncate text-xs text-muted-foreground">{context}</p>
    </Link>
  );
}

// ─── Live league card ─────────────────────────────────────────────────────────

function LiveLeagueCard({
  league,
  matches,
  lastMatchTime,
  leader,
  leaderLabel,
  matchesLabel,
}: {
  league: { id: string; slug: string; name: string };
  matches: number | null;
  lastMatchTime: string | null;
  leader: Team | null;
  leaderLabel: string;
  matchesLabel: string;
}) {
  return (
    <Link
      href={`/leagues/${league.slug}`}
      className="card-elevated focus-ring group flex flex-col gap-3 p-5 transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/40"
      aria-label={league.name}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 font-display text-base font-semibold leading-tight tracking-tight text-foreground group-hover:text-primary">
          {league.name}
        </p>
        <Badge variant="live">Live</Badge>
      </div>
      {leader ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5">
          {leader.logoUrl ? (
            <Image
              src={leader.logoUrl}
              alt=""
              width={20}
              height={20}
              unoptimized
              className="h-5 w-5 rounded object-contain"
            />
          ) : (
            <span className="text-warning">★</span>
          )}
          <span className="truncate text-xs font-medium text-foreground">
            <span className="eyebrow mr-1.5">{leaderLabel}</span>
            {leader.name}
          </span>
        </div>
      ) : null}
      <div className="mt-auto flex items-baseline justify-between text-xs">
        <span className="font-display text-base font-semibold text-foreground" data-num>
          {matches != null ? `${formatNumber(matches)} ${matchesLabel}` : "—"}
        </span>
        <span className="text-muted-foreground">{formatRelative(lastMatchTime)}</span>
      </div>
    </Link>
  );
}

// ─── Match row ────────────────────────────────────────────────────────────────

function MatchRow({
  match,
  radiant,
  dire,
  league,
}: {
  match: Match;
  radiant: Team | null;
  dire: Team | null;
  league: { slug: string; name: string } | null;
}) {
  const radiantWon = match.radiantWin;
  return (
    <Link
      href={league ? `/leagues/${league.slug}` : "/leagues"}
      className="card-elevated focus-ring grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 text-xs transition-colors hover:border-primary/40"
    >
      <div
        className={`flex items-center justify-end gap-1.5 truncate ${
          radiantWon ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        <span className="truncate font-medium">{radiant?.name ?? "Radiant"}</span>
        {radiant?.logoUrl ? (
          <Image
            src={radiant.logoUrl}
            alt=""
            width={16}
            height={16}
            unoptimized
            className="h-4 w-4 shrink-0 rounded object-contain"
          />
        ) : null}
      </div>
      <div className="font-display text-sm font-semibold tracking-tight" data-num>
        <span className={radiantWon ? "text-foreground" : "text-muted-foreground"}>
          {match.radiantScore}
        </span>
        <span className="px-0.5 text-muted-foreground">–</span>
        <span className={!radiantWon ? "text-foreground" : "text-muted-foreground"}>
          {match.direScore}
        </span>
      </div>
      <div
        className={`flex items-center gap-1.5 truncate ${
          !radiantWon ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {dire?.logoUrl ? (
          <Image
            src={dire.logoUrl}
            alt=""
            width={16}
            height={16}
            unoptimized
            className="h-4 w-4 shrink-0 rounded object-contain"
          />
        ) : null}
        <span className="truncate font-medium">{dire?.name ?? "Dire"}</span>
      </div>
      <div className="col-span-3 flex items-baseline justify-between gap-2 truncate text-[10px] text-muted-foreground">
        <span className="truncate">{league?.name ?? ""}</span>
        <span className="shrink-0">
          {formatRelative(match.startTime)} · {fmtMin(match.duration)}
        </span>
      </div>
    </Link>
  );
}

// ─── Meta hero tile ───────────────────────────────────────────────────────────

function MetaHeroTile({
  name,
  image,
  label,
}: {
  name: string;
  image: string | null;
  label: string;
}) {
  return (
    <div className="card-elevated flex flex-col items-center gap-2 p-3 text-center">
      <div className="relative aspect-[256/144] w-full overflow-hidden rounded-lg bg-surface-2">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(min-width: 1024px) 8rem, (min-width: 640px) 25vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">
            ★
          </div>
        )}
      </div>
      <p className="truncate text-xs font-medium text-foreground">{name}</p>
      <p className="eyebrow" data-num>
        {label}
      </p>
    </div>
  );
}

// ─── Champion team card ───────────────────────────────────────────────────────

function ChampionTeamCard({
  team,
  trophies,
  label,
}: {
  team: Team;
  trophies: number;
  label: string;
}) {
  return (
    <Link
      href={`/teams/${team.slug}`}
      className="card-elevated focus-ring flex items-center gap-3 p-4 transition-[transform,border-color] hover:-translate-y-0.5 hover:border-primary/40"
    >
      {team.logoUrl ? (
        <Image
          src={team.logoUrl}
          alt=""
          width={40}
          height={40}
          unoptimized
          className="h-10 w-10 shrink-0 rounded object-contain"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-2 text-warning">
          ★
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold tracking-tight text-foreground">
          {team.name}
        </p>
        <p className="text-xs text-muted-foreground" data-num>
          {label}
        </p>
      </div>
      <span className="font-display text-2xl font-semibold text-primary" data-num>
        {trophies}
      </span>
    </Link>
  );
}
