import { setRequestLocale, getTranslations } from "next-intl/server";

import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seasons" });
  const path = locale === routing.defaultLocale ? "/seasons" : `/${locale}/seasons`;
  return {
    title: t("title"),
    description: t("metaDescription"),
    openGraph: { title: t("title"), description: t("metaDescription"), type: "website" as const, url: path },
    twitter: { card: "summary_large_image" as const, title: t("title"), description: t("metaDescription") },
    alternates: { canonical: path, languages: { en: "/seasons", ru: "/ru/seasons" } },
  };
}

export const revalidate = 86400;

export default async function SeasonsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("seasons");
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: Math.max(0, currentYear - 2022) }, (_, index) => 2023 + index);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Badge className="w-fit bg-primary/10 text-primary">{t("heroBadge")}</Badge>
          <ShareButton title={t("heroHeading")} text={t("shareText")} url="/seasons" />
        </div>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{t("heroHeading")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("heroLead")}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {years.map((year) => (
          <Card key={year} className="border-border/60 bg-card/80">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("season")}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{year}</p>
              <Link href={`/seasons/${year}`} className="mt-3 inline-flex text-sm font-semibold text-primary">
                {t("viewSeason")}
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
