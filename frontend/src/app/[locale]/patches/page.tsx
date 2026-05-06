import { setRequestLocale, getTranslations } from "next-intl/server";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { getPatchesWithCounts } from "@/lib/supabase/queries";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "patches" });
  const path = locale === routing.defaultLocale ? "/patches" : `/${locale}/patches`;
  return {
    title: t("title"),
    description: t("metaDescription"),
    openGraph: { title: t("title"), description: t("metaDescription"), type: "website" as const, url: path },
    twitter: { card: "summary_large_image" as const, title: t("title"), description: t("metaDescription") },
    alternates: { canonical: path, languages: { en: "/patches", ru: "/ru/patches" } },
  };
}

export const revalidate = 86400;

export default async function PatchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("patches");
  const tNav = await getTranslations("nav");
  const patches = await getPatchesWithCounts();
  const totalMatches = patches.reduce((sum, patch) => sum + patch.matchCount, 0);

  const parsePatchVersion = (value: string) => {
    const match = /^(\d+)\.(\d+)([a-z])?$/i.exec(value.trim());
    if (!match) {
      return { major: 0, minor: 0, suffix: "" };
    }
    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      suffix: match[3] ?? "",
    };
  };

  const sortedPatches = [...patches].sort((a, b) => {
    const left = parsePatchVersion(a.patch);
    const right = parsePatchVersion(b.patch);
    if (left.major !== right.major) {
      return right.major - left.major;
    }
    if (left.minor !== right.minor) {
      return right.minor - left.minor;
    }
    return right.suffix.localeCompare(left.suffix);
  });
  const latestPatch = sortedPatches[0];

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ title: tNav("patches") }]} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Badge className="w-fit bg-primary/10 text-primary">{t("heroBadge")}</Badge>
          <ShareButton
            title={t("title")}
            text={t("shareText", {
              patches: formatNumber(patches.length),
              matches: formatNumber(totalMatches),
            })}
            url="/patches"
          />
        </div>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{t("heroHeading")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("heroLead")}</p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{t("kpi.totalPatches")}</p>
            <p className="text-2xl font-semibold text-foreground">{formatNumber(patches.length)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{t("kpi.totalMatches")}</p>
            <p className="text-2xl font-semibold text-foreground">{formatNumber(totalMatches)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{t("kpi.latestPatch")}</p>
            <p className="text-2xl font-semibold text-foreground">{latestPatch?.patch ?? "N/A"}</p>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>{t("table.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("table.lead")}</p>
        </CardHeader>
        <CardContent>
          {patches.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-border/60 text-sm">
                <thead className="bg-muted/60">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">{t("table.patch")}</th>
                    <th className="px-4 py-3">{t("table.matches")}</th>
                    <th className="px-4 py-3">{t("table.releaseDate")}</th>
                    <th className="px-4 py-3">{t("table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPatches.map((patch) => {
                    const matchCount = patch.matchCount ?? 0;
                    return (
                      <tr key={patch.id} className="border-t border-border/60">
                        <td className="px-4 py-3 font-semibold text-foreground">{patch.patch}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatNumber(matchCount)}</td>
                        <td className="px-4 py-3 text-muted-foreground">N/A</td>
                        <td className="px-4 py-3">
                          {matchCount > 0 ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/patches/${encodeURIComponent(patch.patch)}`}>{t("table.viewPatch")}</Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("table.noMatches")}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noData")}</p>
          )}
        </CardContent>
      </Card>

      <section className="rounded-2xl border border-border/60 bg-card/80 p-6">
        <h2 className="font-display text-xl font-semibold">{t("guide.title")}</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            { step: "1", title: t("guide.step1Title"), description: t("guide.step1Body") },
            { step: "2", title: t("guide.step2Title"), description: t("guide.step2Body") },
            { step: "3", title: t("guide.step3Title"), description: t("guide.step3Body") },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {item.step}
              </div>
              <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
