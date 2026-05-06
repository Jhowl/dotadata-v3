import Script from "next/script";
import {
  ArrowLeft,
  Award,
  Ban,
  ChevronRight,
  Flame,
  Layers,
  Swords,
  Target,
  TrendingUp,
} from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { LeaguePickBanTable, type PickBanTableRow } from "@/components/league-pickban-table";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatNumber, formatPercent } from "@/lib/format";
import { createHeroImageResolver } from "@/lib/hero";
import { getLeagueStaticParams } from "@/lib/static-params";
import {
  getHeroes,
  getLeagueBySlug,
  getLeaguePickBanAnalysis,
  getTeams,
} from "@/lib/supabase/queries";

interface PickBanPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

const MIN_PICKS_FOR_WINRATE = 5;

export async function generateStaticParams() {
  const slugs = await getLeagueStaticParams();
  return routing.locales.flatMap((locale) =>
    slugs.map((entry) => ({ locale, slug: entry.slug })),
  );
}

export async function generateMetadata({ params }: PickBanPageProps) {
  const { locale, slug } = await params;
  const league = await getLeagueBySlug(slug);
  const tLeague = await getTranslations({ locale, namespace: "league" });
  const t = await getTranslations({ locale, namespace: "leaguePickBan" });
  const localePath = locale === routing.defaultLocale ? "" : `/${locale}`;

  if (!league) {
    return { title: tLeague("notFound") };
  }

  const analysis = await getLeaguePickBanAnalysis(league.id);
  const drafts = analysis?.matchesWithDraft ?? 0;
  const heroes = analysis?.uniqueHeroesSeen ?? 0;

  const title = t("metaTitle", { name: league.name });
  const description = t("metaDescription", {
    name: league.name,
    drafts: formatNumber(drafts),
    heroes: formatNumber(heroes),
  });
  const path = `${localePath}/leagues/${league.slug}/pick-ban`;

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
      languages: {
        en: `/leagues/${league.slug}/pick-ban`,
        ru: `/ru/leagues/${league.slug}/pick-ban`,
      },
    },
  };
}

export const revalidate = 86400;

export default async function LeaguePickBanPage({ params }: PickBanPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tLeague = await getTranslations("league");
  const league = await getLeagueBySlug(slug);

  if (!league) {
    return <div className="py-20 text-center text-muted-foreground">{tLeague("notFound")}</div>;
  }

  const [analysis, heroes, teams] = await Promise.all([
    getLeaguePickBanAnalysis(league.id),
    getHeroes(),
    getTeams(),
  ]);

  const heroLookup = new Map(heroes.map((hero) => [hero.id, hero.localizedName]));
  const teamLookup = new Map(teams.map((team) => [team.id, team]));
  const buildHeroImageUrl = createHeroImageResolver(heroes);

  if (!analysis || analysis.matchesWithDraft === 0) {
    return (
      <div className="space-y-8">
        <Breadcrumbs
          items={[
            { title: "Leagues", url: "/leagues" },
            { title: league.name, url: `/leagues/${league.slug}` },
            { title: "Pick & Ban" },
          ]}
        />
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-10 text-center">
            <h1 className="font-display text-2xl font-semibold">
              {league.name} — Pick &amp; Ban Analysis
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              No draft data is available for this league yet.
            </p>
            <Link
              href={`/leagues/${league.slug}`}
              className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {league.name}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tableRows: PickBanTableRow[] = analysis.heroes.map((hero) => ({
    heroId: hero.heroId,
    heroName: heroLookup.get(hero.heroId) ?? `Hero ${hero.heroId}`,
    heroImage: buildHeroImageUrl(hero.heroId),
    picks: hero.picks,
    bans: hero.bans,
    contested: hero.contested,
    pickRate: hero.pickRate,
    banRate: hero.banRate,
    contestRate: hero.contestRate,
    winRate: hero.winRate,
    radiantPicks: hero.radiantPicks,
    direPicks: hero.direPicks,
    avgPickOrder: hero.avgPickOrder,
    avgBanOrder: hero.avgBanOrder,
  }));

  const topPicked = [...analysis.heroes]
    .filter((h) => h.picks > 0)
    .sort((a, b) => b.picks - a.picks)
    .slice(0, 10);
  const topBanned = [...analysis.heroes]
    .filter((h) => h.bans > 0)
    .sort((a, b) => b.bans - a.bans)
    .slice(0, 10);
  const topContested = [...analysis.heroes].slice(0, 10);

  const priorityPicks = [...analysis.heroes]
    .filter((h) => h.picks >= 3 && h.avgPickOrder !== null)
    .sort((a, b) => (a.avgPickOrder ?? 999) - (b.avgPickOrder ?? 999))
    .slice(0, 8);
  const priorityBans = [...analysis.heroes]
    .filter((h) => h.bans >= 3 && h.avgBanOrder !== null)
    .sort((a, b) => (a.avgBanOrder ?? 999) - (b.avgBanOrder ?? 999))
    .slice(0, 8);

  const highestWinrate = [...analysis.heroes]
    .filter((h) => h.picks >= MIN_PICKS_FOR_WINRATE && h.winRate !== null)
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    .slice(0, 8);
  const lowestWinrate = [...analysis.heroes]
    .filter((h) => h.picks >= MIN_PICKS_FOR_WINRATE && h.winRate !== null)
    .sort((a, b) => (a.winRate ?? 0) - (b.winRate ?? 0))
    .slice(0, 6);

  const radiantHeroes = [...analysis.heroes]
    .filter((h) => h.radiantPicks > 0)
    .sort((a, b) => b.radiantPicks - a.radiantPicks)
    .slice(0, 6);
  const direHeroes = [...analysis.heroes]
    .filter((h) => h.direPicks > 0)
    .sort((a, b) => b.direPicks - a.direPicks)
    .slice(0, 6);

  const picksPerMatch = analysis.matchesWithDraft
    ? analysis.totalPicks / analysis.matchesWithDraft
    : 0;
  const bansPerMatch = analysis.matchesWithDraft
    ? analysis.totalBans / analysis.matchesWithDraft
    : 0;

  const shareUrl = `/leagues/${league.slug}/pick-ban`;
  const shareText = `🧠 ${league.name} pick & ban analysis: ${formatNumber(analysis.matchesWithDraft)} drafts, ${formatNumber(analysis.uniqueHeroesSeen)} heroes — full breakdown on DotaData`;

  const topContestedName = topContested[0]
    ? heroLookup.get(topContested[0].heroId) ?? "Hero"
    : null;
  const topBannedName = topBanned[0] ? heroLookup.get(topBanned[0].heroId) ?? "Hero" : null;
  const topPickedName = topPicked[0] ? heroLookup.get(topPicked[0].heroId) ?? "Hero" : null;
  const topWinrateHero = highestWinrate[0];
  const topWinrateName = topWinrateHero
    ? heroLookup.get(topWinrateHero.heroId) ?? "Hero"
    : null;

  const faqEntries = [
    topContestedName && {
      question: `Which hero is most contested in ${league.name}?`,
      answer: `${topContestedName} is the most contested hero in ${league.name} with a contest rate of ${formatPercent(topContested[0].contestRate)} across ${formatNumber(analysis.matchesWithDraft)} drafts.`,
    },
    topBannedName && {
      question: `Which hero is banned the most in ${league.name}?`,
      answer: `${topBannedName} leads the ban list with ${formatNumber(topBanned[0].bans)} bans (${formatPercent(topBanned[0].banRate)} ban rate).`,
    },
    topPickedName && {
      question: `Which hero is picked the most in ${league.name}?`,
      answer: `${topPickedName} is the most picked hero with ${formatNumber(topPicked[0].picks)} picks across ${formatNumber(analysis.matchesWithDraft)} drafts.`,
    },
    topWinrateName && topWinrateHero && {
      question: `Which hero has the highest winrate in ${league.name}?`,
      answer: `${topWinrateName} posts the highest winrate at ${formatPercent(topWinrateHero.winRate ?? 0)} (minimum ${MIN_PICKS_FOR_WINRATE} picks) across ${formatNumber(topWinrateHero.picks)} games.`,
    },
    {
      question: `How many heroes have been seen in the ${league.name} draft?`,
      answer: `${formatNumber(analysis.uniqueHeroesSeen)} unique heroes have appeared in ${league.name} drafts: ${formatNumber(analysis.uniqueHeroesPicked)} have been picked and ${formatNumber(analysis.uniqueHeroesBanned)} have been banned.`,
    },
  ].filter((entry): entry is { question: string; answer: string } => Boolean(entry));

  return (
    <>
      <Script id="pickban-breadcrumb-ld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://dotadata.org/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "Leagues",
              item: "https://dotadata.org/leagues",
            },
            {
              "@type": "ListItem",
              position: 3,
              name: league.name,
              item: `https://dotadata.org/leagues/${league.slug}`,
            },
            {
              "@type": "ListItem",
              position: 4,
              name: "Pick & Ban Analysis",
              item: `https://dotadata.org/leagues/${league.slug}/pick-ban`,
            },
          ],
        })}
      </Script>

      {faqEntries.length > 0 && (
        <Script id="pickban-faq-ld" type="application/ld+json" strategy="afterInteractive">
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
            { title: league.name, url: `/leagues/${league.slug}` },
            { title: "Pick & Ban" },
          ]}
        />

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <header className="rounded-2xl border border-border/60 bg-card/80 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl space-y-4">
              <Badge className="bg-primary/10 text-primary">Pick &amp; Ban Analysis</Badge>
              <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
                {league.name} — Draft Breakdown
              </h1>
              <p className="text-muted-foreground">
                Comprehensive pick &amp; ban analysis for{" "}
                <span className="font-semibold text-foreground">{league.name}</span>:{" "}
                <span className="font-semibold text-foreground">
                  {formatNumber(analysis.matchesWithDraft)}
                </span>{" "}
                drafts analysed,{" "}
                <span className="font-semibold text-foreground">
                  {formatNumber(analysis.uniqueHeroesSeen)}
                </span>{" "}
                unique heroes, hero contest rates, winrates, draft priority, side splits and
                per-team breakdowns.
              </p>
              <Link
                href={`/leagues/${league.slug}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {league.name} overview
              </Link>
            </div>
            <ShareButton title={`${league.name} pick & ban`} text={shareText} url={shareUrl} />
          </div>
        </header>

        {/* ── KPI strip ────────────────────────────────────────────── */}
        <section aria-labelledby="kpi-heading" className="space-y-4">
          <h2 id="kpi-heading" className="sr-only">
            Draft summary
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<Layers className="h-4 w-4 text-primary" />}
              label="Drafts analysed"
              value={formatNumber(analysis.matchesWithDraft)}
              hint={`${formatNumber(analysis.totalMatches)} matches scanned`}
            />
            <KpiCard
              icon={<Swords className="h-4 w-4 text-primary" />}
              label="Total picks"
              value={formatNumber(analysis.totalPicks)}
              hint={`${picksPerMatch.toFixed(1)} per match`}
            />
            <KpiCard
              icon={<Ban className="h-4 w-4 text-primary" />}
              label="Total bans"
              value={formatNumber(analysis.totalBans)}
              hint={`${bansPerMatch.toFixed(1)} per match`}
            />
            <KpiCard
              icon={<Flame className="h-4 w-4 text-primary" />}
              label="Hero pool"
              value={formatNumber(analysis.uniqueHeroesSeen)}
              hint={`${formatNumber(analysis.uniqueHeroesPicked)} picked · ${formatNumber(analysis.uniqueHeroesBanned)} banned`}
            />
          </div>
        </section>

        {/* ── Most picked / banned / contested ─────────────────────── */}
        <section aria-labelledby="leaders-heading" className="space-y-4">
          <div>
            <h2 id="leaders-heading" className="font-display text-2xl font-semibold">
              Draft leaders
            </h2>
            <p className="text-sm text-muted-foreground">
              The heroes shaping the meta of {league.name}.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <RankingCard
              icon={<Swords className="h-4 w-4 text-emerald-500" />}
              title="Most picked"
              hint="By total picks"
              entries={topPicked.map((hero) => ({
                heroId: hero.heroId,
                heroName: heroLookup.get(hero.heroId) ?? hero.heroId,
                heroImage: buildHeroImageUrl(hero.heroId),
                primary: formatNumber(hero.picks),
                secondary: `${formatPercent(hero.pickRate)} pick rate`,
              }))}
            />
            <RankingCard
              icon={<Ban className="h-4 w-4 text-rose-500" />}
              title="Most banned"
              hint="By total bans"
              entries={topBanned.map((hero) => ({
                heroId: hero.heroId,
                heroName: heroLookup.get(hero.heroId) ?? hero.heroId,
                heroImage: buildHeroImageUrl(hero.heroId),
                primary: formatNumber(hero.bans),
                secondary: `${formatPercent(hero.banRate)} ban rate`,
              }))}
            />
            <RankingCard
              icon={<Flame className="h-4 w-4 text-primary" />}
              title="Most contested"
              hint="Picks + bans"
              entries={topContested.map((hero) => ({
                heroId: hero.heroId,
                heroName: heroLookup.get(hero.heroId) ?? hero.heroId,
                heroImage: buildHeroImageUrl(hero.heroId),
                primary: formatNumber(hero.contested),
                secondary: `${formatPercent(hero.contestRate)} contest rate`,
              }))}
            />
          </div>
        </section>

        {/* ── Draft priority ──────────────────────────────────────── */}
        {(priorityPicks.length > 0 || priorityBans.length > 0) && (
          <section aria-labelledby="priority-heading" className="space-y-4">
            <div>
              <h2 id="priority-heading" className="font-display text-2xl font-semibold">
                Draft priority
              </h2>
              <p className="text-sm text-muted-foreground">
                Which heroes captains scramble for first — based on average draft order.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <RankingCard
                icon={<Target className="h-4 w-4 text-emerald-500" />}
                title="Priority picks"
                hint="Lowest average pick order (min 3 picks)"
                entries={priorityPicks.map((hero) => ({
                  heroId: hero.heroId,
                  heroName: heroLookup.get(hero.heroId) ?? hero.heroId,
                  heroImage: buildHeroImageUrl(hero.heroId),
                  primary: hero.avgPickOrder !== null ? hero.avgPickOrder.toFixed(1) : "—",
                  secondary: `${formatNumber(hero.picks)} picks`,
                }))}
              />
              <RankingCard
                icon={<Target className="h-4 w-4 text-rose-500" />}
                title="Priority bans"
                hint="Lowest average ban order (min 3 bans)"
                entries={priorityBans.map((hero) => ({
                  heroId: hero.heroId,
                  heroName: heroLookup.get(hero.heroId) ?? hero.heroId,
                  heroImage: buildHeroImageUrl(hero.heroId),
                  primary: hero.avgBanOrder !== null ? hero.avgBanOrder.toFixed(1) : "—",
                  secondary: `${formatNumber(hero.bans)} bans`,
                }))}
              />
            </div>
          </section>
        )}

        {/* ── Winrate kings/villains ──────────────────────────────── */}
        {highestWinrate.length > 0 && (
          <section aria-labelledby="winrate-heading" className="space-y-4">
            <div>
              <h2 id="winrate-heading" className="font-display text-2xl font-semibold">
                Winrate leaders
              </h2>
              <p className="text-sm text-muted-foreground">
                Win % when picked (minimum {MIN_PICKS_FOR_WINRATE} picks).
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <RankingCard
                icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
                title="Highest winrate"
                hint={`Min ${MIN_PICKS_FOR_WINRATE} picks`}
                entries={highestWinrate.map((hero) => ({
                  heroId: hero.heroId,
                  heroName: heroLookup.get(hero.heroId) ?? hero.heroId,
                  heroImage: buildHeroImageUrl(hero.heroId),
                  primary: formatPercent(hero.winRate ?? 0),
                  secondary: `${formatNumber(hero.picks)} picks · ${formatNumber(hero.winsWhenPicked)} wins`,
                  tone: "positive" as const,
                }))}
              />
              {lowestWinrate.length > 0 && (
                <RankingCard
                  icon={<TrendingUp className="h-4 w-4 -scale-y-100 text-rose-500" />}
                  title="Lowest winrate"
                  hint={`Min ${MIN_PICKS_FOR_WINRATE} picks`}
                  entries={lowestWinrate.map((hero) => ({
                    heroId: hero.heroId,
                    heroName: heroLookup.get(hero.heroId) ?? hero.heroId,
                    heroImage: buildHeroImageUrl(hero.heroId),
                    primary: formatPercent(hero.winRate ?? 0),
                    secondary: `${formatNumber(hero.picks)} picks · ${formatNumber(hero.winsWhenPicked)} wins`,
                    tone: "negative" as const,
                  }))}
                />
              )}
            </div>
          </section>
        )}

        {/* ── Side splits ─────────────────────────────────────────── */}
        {(radiantHeroes.length > 0 || direHeroes.length > 0) && (
          <section aria-labelledby="side-heading" className="space-y-4">
            <div>
              <h2 id="side-heading" className="font-display text-2xl font-semibold">
                Side preferences
              </h2>
              <p className="text-sm text-muted-foreground">
                Which heroes captains prefer when drafting from each side of the map.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <RankingCard
                icon={<Award className="h-4 w-4 text-emerald-500" />}
                title="Radiant favourites"
                hint="Most picked when on Radiant"
                entries={radiantHeroes.map((hero) => ({
                  heroId: hero.heroId,
                  heroName: heroLookup.get(hero.heroId) ?? hero.heroId,
                  heroImage: buildHeroImageUrl(hero.heroId),
                  primary: formatNumber(hero.radiantPicks),
                  secondary: `${formatNumber(hero.direPicks)} on Dire`,
                }))}
              />
              <RankingCard
                icon={<Award className="h-4 w-4 text-rose-500" />}
                title="Dire favourites"
                hint="Most picked when on Dire"
                entries={direHeroes.map((hero) => ({
                  heroId: hero.heroId,
                  heroName: heroLookup.get(hero.heroId) ?? hero.heroId,
                  heroImage: buildHeroImageUrl(hero.heroId),
                  primary: formatNumber(hero.direPicks),
                  secondary: `${formatNumber(hero.radiantPicks)} on Radiant`,
                }))}
              />
            </div>
          </section>
        )}

        {/* ── Per-team breakdown ──────────────────────────────────── */}
        {analysis.teams.length > 0 && (
          <section aria-labelledby="teams-heading" className="space-y-4">
            <div>
              <h2 id="teams-heading" className="font-display text-2xl font-semibold">
                Team draft tendencies
              </h2>
              <p className="text-sm text-muted-foreground">
                Signature picks and bans for each team in {league.name}.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {analysis.teams.map((team) => {
                const teamData = teamLookup.get(team.teamId);
                return (
                  <Card key={team.teamId} className="border-border/60 bg-card/80">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">
                            {teamData ? (
                              <Link
                                href={`/teams/${teamData.slug}`}
                                className="hover:text-primary"
                              >
                                {teamData.name}
                              </Link>
                            ) : (
                              <span>{team.teamId}</span>
                            )}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {formatNumber(team.matches)} matches
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 pt-0">
                      <TeamHeroList
                        title="Top picks"
                        accent="text-emerald-500"
                        entries={team.topPicks}
                        heroLookup={heroLookup}
                        buildHeroImageUrl={buildHeroImageUrl}
                      />
                      <TeamHeroList
                        title="Top bans"
                        accent="text-rose-500"
                        entries={team.topBans}
                        heroLookup={heroLookup}
                        buildHeroImageUrl={buildHeroImageUrl}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Full sortable hero table ────────────────────────────── */}
        <section aria-labelledby="full-table-heading" className="space-y-4">
          <div>
            <h2 id="full-table-heading" className="font-display text-2xl font-semibold">
              All heroes — full breakdown
            </h2>
            <p className="text-sm text-muted-foreground">
              Sortable table of every hero appearing in {league.name} drafts. Click a column to
              re-sort.
            </p>
          </div>
          <Card className="border-border/60 bg-card/80">
            <CardContent className="pt-6">
              <LeaguePickBanTable rows={tableRows} />
            </CardContent>
          </Card>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        {faqEntries.length > 0 && (
          <section aria-labelledby="faq-heading" className="space-y-4">
            <div>
              <h2 id="faq-heading" className="font-display text-2xl font-semibold">
                Pick &amp; ban FAQ
              </h2>
              <p className="text-sm text-muted-foreground">
                Quick answers about the {league.name} draft meta.
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

        {/* ── Footer share + nav ──────────────────────────────────── */}
        <section className="rounded-2xl border border-border/60 bg-card/80 p-6 md:p-8">
          <div className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <h2 className="font-display text-xl font-semibold">
                Share this draft analysis
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pass these insights to your captain, draft coach, or community.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ShareButton title={`${league.name} pick & ban`} text={shareText} url={shareUrl} />
              <Link
                href={`/leagues/${league.slug}`}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                League overview
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}

// ─── Local components ──────────────────────────────────────────────────────────

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

interface RankingEntry {
  heroId: string;
  heroName: string;
  heroImage: string | null;
  primary: string;
  secondary: string;
  tone?: "positive" | "negative";
}

interface RankingCardProps {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  entries: RankingEntry[];
}

function RankingCard({ icon, title, hint, entries }: RankingCardProps) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          entries.map((entry, index) => {
            const tone =
              entry.tone === "positive"
                ? "text-emerald-500"
                : entry.tone === "negative"
                  ? "text-rose-500"
                  : "text-primary";
            return (
              <div
                key={`${entry.heroId}-${index}`}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-2.5"
              >
                <span className="w-5 text-xs font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                  {entry.heroImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.heroImage}
                      alt={entry.heroName}
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
                    {entry.heroName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{entry.secondary}</p>
                </div>
                <span className={`text-sm font-semibold ${tone}`}>{entry.primary}</span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

interface TeamHeroListProps {
  title: string;
  accent: string;
  entries: Array<{ heroId: string; total: number }>;
  heroLookup: Map<string, string>;
  buildHeroImageUrl: (heroId?: string | null) => string | null;
}

function TeamHeroList({
  title,
  accent,
  entries,
  heroLookup,
  buildHeroImageUrl,
}: TeamHeroListProps) {
  return (
    <div>
      <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${accent}`}>{title}</p>
      <ul className="space-y-1.5">
        {entries.length === 0 ? (
          <li className="text-xs text-muted-foreground">—</li>
        ) : (
          entries.map((entry) => {
            const heroName = heroLookup.get(entry.heroId) ?? entry.heroId;
            const image = buildHeroImageUrl(entry.heroId);
            return (
              <li key={entry.heroId} className="flex items-center gap-2 text-xs">
                <div className="h-5 w-5 overflow-hidden rounded-sm border border-border/60 bg-muted">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={heroName} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <span className="flex-1 truncate text-foreground">{heroName}</span>
                <span className="font-semibold text-muted-foreground">
                  {formatNumber(entry.total)}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
