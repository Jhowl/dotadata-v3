import { setRequestLocale, getTranslations } from "next-intl/server";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  const t = await getTranslations({ locale, namespace: "privacy" });
  const path = locale === routing.defaultLocale ? "/privacy" : `/${locale}/privacy`;
  return {
    title: t("title"),
    description: t("metaDescription"),
    openGraph: { title: t("title"), description: t("metaDescription"), type: "website" as const, url: path },
    twitter: { card: "summary_large_image" as const, title: t("title"), description: t("metaDescription") },
    alternates: { canonical: path, languages: { en: "/privacy", ru: "/ru/privacy" } },
  };
}

export const revalidate = 86400;

type Section = {
  heading: string;
  body: string[];
};

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");

  const sections = t.raw("sections") as Section[];

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ title: t("heroBadge") }]} />

      <section className="space-y-4 text-center">
        <Badge className="mx-auto w-fit bg-primary/10 text-primary">{t("heroBadge")}</Badge>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{t("heroHeading")}</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">{t("heroLead")}</p>
        <p className="text-xs text-muted-foreground">{t("lastUpdatedLabel")}: {t("lastUpdated")}</p>
      </section>

      <Card className="mx-auto max-w-3xl border-border/60 bg-card/80">
        <CardContent className="space-y-8 p-8">
          {sections.map((section, index) => (
            <section key={index} className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">{section.heading}</h2>
              {section.body.map((paragraph, pIndex) => (
                <p key={pIndex} className="text-sm leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
