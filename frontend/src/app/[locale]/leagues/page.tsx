import Image from "next/image";
import Script from "next/script";
import { Crown } from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import {
  getCounts,
  getLeagueLastWinners,
  getLeagueSummaries,
  getLeagues,
  getTeams,
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
  const t = await getTranslations({ locale, namespace: "leagues" });
  const path = locale === routing.defaultLocale ? "/leagues" : `/${locale}/leagues`;
  return {
    title: t("title"),
    description: t("metaDescription"),
    openGraph: { title: t("title"), description: t("metaDescription"), type: "website" as const, url: path },
    twitter: { card: "summary_large_image" as const, title: t("title"), description: t("metaDescription") },
    alternates: { canonical: path, languages: { en: "/leagues", ru: "/ru/leagues" } },
  };
}

export const revalidate = 86400;

interface LeaguesPageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ search?: string }>;
}

const isLeagueOver = (endDate: string | null) => {
  if (!endDate) return false;
  const parsed = Date.parse(endDate);
  if (Number.isNaN(parsed)) return false;
  return parsed <= Date.now();
};

export default async function LeaguesPage({ params, searchParams }: LeaguesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("leagues");
  const tc = await getTranslations("common");
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.search?.toLowerCase().trim() ?? "";

  const [counts, leagues, leagueSummaries, teams, lastWinners] = await Promise.all([
    getCounts(),
    getLeagues(),
    getLeagueSummaries(),
    getTeams(),
    getLeagueLastWinners(),
  ]);

  const filteredLeagues = query
    ? leagues.filter((league) => league.name.toLowerCase().includes(query))
    : leagues;

  const summaryByLeague = new Map(leagueSummaries.map((summary) => [summary.leagueId, summary]));
  const teamLookup = new Map(teams.map((team) => [team.id, team]));

  return (
    <>
      <Script id="leagues-ld-json" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Dota 2 Leagues",
          url: "https://dotadata.org/leagues",
          about: {
            "@type": "Thing",
            name: "Dota 2 leagues and tournaments",
          },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: filteredLeagues.slice(0, 50).map((league, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: league.name,
              url: `https://dotadata.org/leagues/${league.slug}`,
            })),
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
              leagues: formatNumber(counts.leagues),
              matches: formatNumber(counts.matches),
            })}
            url="/leagues"
          />
        </div>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{t("heroHeading")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("heroLead")}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kpi.totalLeagues")}</p>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(counts.leagues)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kpi.totalMatches")}</p>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(counts.matches)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kpi.latestLeague")}</p>
            <p className="mt-2 text-2xl font-semibold">{formatDate(leagues[0]?.startDate)}</p>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/80 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <form className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <Input
              name="search"
              defaultValue={resolvedSearchParams?.search ?? ""}
              placeholder={t("search")}
              className="w-full md:w-64"
            />
            <Button type="submit">{tc("search")}</Button>
          </form>
          <div className="text-sm text-muted-foreground">
            {t("table.totalsLine", {
              leagues: formatNumber(filteredLeagues.length),
              matches: formatNumber(counts.matches),
            })}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border border-border/60 text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">{t("table.name")}</th>
                <th className="px-4 py-3">{t("table.champion")}</th>
                <th className="px-4 py-3">{t("table.startDate")}</th>
                <th className="px-4 py-3">{t("table.endDate")}</th>
                <th className="px-4 py-3">{t("table.totalMatches")}</th>
                <th className="px-4 py-3">{t("table.totalTeams")}</th>
                <th className="px-4 py-3">{t("table.radiantWinrate")}</th>
                <th className="px-4 py-3">{t("table.direWinrate")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeagues.length ? (
                filteredLeagues.map((league) => {
                  const summary = summaryByLeague.get(league.id);
                  const matchesCount = summary?.totalMatches ?? 0;
                  const teamCount = summary?.totalTeams ?? 0;
                  const radiantRate = summary?.radiantWinrate ?? null;
                  const lastWinner = lastWinners[league.id];
                  const championTeam = lastWinner ? teamLookup.get(lastWinner.teamId) : null;
                  const showChampion = championTeam && isLeagueOver(league.endDate);
                  return (
                    <tr key={league.id} className="border-t border-border/60">
                      <td className="px-4 py-3 font-semibold text-primary">
                        <Link href={`/leagues/${league.slug}`}>{league.name}</Link>
                      </td>
                      <td className="px-4 py-3">
                        {showChampion && championTeam ? (
                          <Link
                            href={`/teams/${championTeam.slug}`}
                            className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"
                          >
                            {championTeam.logoUrl ? (
                              <Image
                                src={championTeam.logoUrl}
                                alt=""
                                width={20}
                                height={20}
                                unoptimized
                                className="h-5 w-5 rounded-sm object-contain"
                              />
                            ) : (
                              <Crown className="h-3.5 w-3.5 text-amber-300" />
                            )}
                            <span>{championTeam.name}</span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(league.startDate)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(league.endDate)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatNumber(matchesCount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatNumber(teamCount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {radiantRate !== null ? formatPercent(radiantRate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {radiantRate !== null ? formatPercent(100 - radiantRate) : "—"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                    {t("table.noLeagues")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </>
  );
}
