import Image from "next/image";
import Script from "next/script";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { getCounts, getTeamSummaries, getTeams } from "@/lib/supabase/queries";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "teams" });
  const path = locale === routing.defaultLocale ? "/teams" : `/${locale}/teams`;
  return {
    title: t("title"),
    description: t("metaDescription"),
    openGraph: { title: t("title"), description: t("metaDescription"), type: "website" as const, url: path },
    twitter: { card: "summary_large_image" as const, title: t("title"), description: t("metaDescription") },
    alternates: { canonical: path, languages: { en: "/teams", ru: "/ru/teams" } },
  };
}

export const revalidate = 86400;

interface TeamsPageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ search?: string }>;
}

const formatMinutes = (seconds: number) => `${(seconds / 60).toFixed(1)}m`;

export default async function TeamsPage({ params, searchParams }: TeamsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("teams");
  const tc = await getTranslations("common");
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.search?.toLowerCase().trim() ?? "";

  const [counts, teams, teamSummaries] = await Promise.all([
    getCounts(),
    getTeams(),
    getTeamSummaries(),
  ]);

  const filteredTeams = query
    ? teams.filter((team) => team.name.toLowerCase().includes(query))
    : teams;

  const summaryByTeam = new Map(teamSummaries.map((summary) => [summary.teamId, summary]));

  return (
    <>
      <Script id="teams-ld-json" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Dota 2 Teams",
          url: "https://dotadata.org/teams",
          about: {
            "@type": "Thing",
            name: "Dota 2 esports teams",
          },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: filteredTeams.slice(0, 50).map((team, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: team.name,
              url: `https://dotadata.org/teams/${team.slug}`,
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
              teams: formatNumber(counts.teams),
              matches: formatNumber(counts.matches),
            })}
            url="/teams"
          />
        </div>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{t("heroHeading")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("heroLead")}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kpi.teamsTracked")}</p>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(counts.teams)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kpi.matchesAnalyzed")}</p>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(counts.matches)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kpi.latestTeam")}</p>
            <p className="mt-2 text-2xl font-semibold">{teams[0]?.name ?? "—"}</p>
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
            {t("table.totalsLine", { teams: formatNumber(filteredTeams.length) })}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border border-border/60 text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">{t("table.logo")}</th>
                <th className="px-4 py-3">{t("table.name")}</th>
                <th className="px-4 py-3">{t("table.totalMatches")}</th>
                <th className="px-4 py-3">{t("table.avgDuration")}</th>
                <th className="px-4 py-3">{t("table.radiantWinrate")}</th>
                <th className="px-4 py-3">{t("table.direWinrate")}</th>
                <th className="px-4 py-3">{t("table.lastMatch")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.length ? (
                filteredTeams.map((team) => {
                  const summary = summaryByTeam.get(team.id);
                  const totalMatches = summary?.totalMatches ?? 0;
                  const avgDuration = summary?.avgDuration ?? 0;
                  const radiantRate = summary?.radiantWinrate ?? null;
                  const direRate = summary?.direWinrate ?? null;

                  return (
                    <tr key={team.id} className="border-t border-border/60">
                      <td className="px-4 py-3">
                        {team.logoUrl ? (
                          <Image
                            src={team.logoUrl}
                            alt={`${team.name} logo`}
                            width={40}
                            height={40}
                            unoptimized
                            className="h-10 w-10 rounded-full object-contain"
                          />
                        ) : (
                          <span className="inline-block h-10 w-10 rounded-full bg-muted" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-primary">
                        <Link href={`/teams/${team.slug}`}>{team.name}</Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatNumber(totalMatches)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {totalMatches ? formatMinutes(avgDuration) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {radiantRate !== null ? formatPercent(radiantRate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {direRate !== null ? formatPercent(direRate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {summary?.lastMatchTime ? formatDate(summary.lastMatchTime) : "—"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    {t("table.noTeams")}
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
