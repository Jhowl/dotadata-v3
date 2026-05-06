import { setRequestLocale, getTranslations } from "next-intl/server";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ContactForm } from "@/components/contact-form";
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
  const t = await getTranslations({ locale, namespace: "contact" });
  const path = locale === routing.defaultLocale ? "/contact" : `/${locale}/contact`;
  return {
    title: t("title"),
    description: t("metaDescription"),
    openGraph: { title: t("title"), description: t("metaDescription"), type: "website" as const, url: path },
    twitter: { card: "summary_large_image" as const, title: t("title"), description: t("metaDescription") },
    alternates: { canonical: path, languages: { en: "/contact", ru: "/ru/contact" } },
  };
}

export const revalidate = 86400;

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ title: t("heroBadge") }]} />

      <section className="space-y-4 text-center">
        <Badge className="mx-auto w-fit bg-primary/10 text-primary">{t("heroBadge")}</Badge>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{t("heroHeading")}</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">{t("heroLead")}</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="space-y-6 p-8">
            <h2 className="text-2xl font-semibold text-foreground">Send us a Message</h2>
            <ContactForm />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/60 bg-card/80">
            <CardContent className="space-y-6 p-8">
              <h2 className="text-2xl font-semibold text-foreground">Get in Touch</h2>
              <div>
                <h3 className="text-lg font-medium text-foreground">Quick Response</h3>
                <p className="text-sm text-muted-foreground">We typically respond within 24 hours.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground">Data Questions</h3>
                <p className="text-sm text-muted-foreground">Ask about our statistics, methodology, or sources.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground">Feature Requests</h3>
                <p className="text-sm text-muted-foreground">Suggest new features or improvements.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
