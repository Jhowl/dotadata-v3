import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  const title = `${t("siteName")} | ${t("siteTagline")}`;
  const description = t("siteDescription");
  const isDefaultLocale = locale === routing.defaultLocale;
  const localePath = isDefaultLocale ? "" : `/${locale}`;
  const canonical = `${localePath}/`;

  return {
    title: {
      default: title,
      template: `%s | ${t("siteName")}`,
    },
    description,
    // Non-default locales (currently /ru/*) render essentially identical
    // English content because page bodies aren't translated yet. Google was
    // consolidating /ru/<x> against /<x> and dropping the Russian URL from
    // the index anyway; noindex makes that explicit and frees crawl budget.
    // The /ru/* routes keep working for users — only search visibility is
    // suppressed. Page-level metadata merges with this, so individual pages
    // don't need to repeat this setting.
    robots: isDefaultLocale ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      locale: locale === "ru" ? "ru_RU" : "en_US",
      siteName: t("siteName"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical,
      languages: {
        en: "/",
        ru: "/ru",
        "x-default": "/",
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "common" });

  const siteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: t("siteName"),
    url: "https://dotadata.org",
    description: t("siteDescription"),
    inLanguage: locale === "ru" ? "ru-RU" : "en-US",
    publisher: {
      "@type": "Organization",
      name: t("siteName"),
      url: "https://dotadata.org",
    },
  };

  return (
    <NextIntlClientProvider locale={locale}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,_rgba(24,185,157,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(235,189,80,0.18),_transparent_45%)] dark:bg-[radial-gradient(circle_at_top,_rgba(80,220,200,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(220,180,90,0.12),_transparent_45%)]">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),transparent_30%)] dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.3),transparent_35%)]" />
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-12 md:px-6">
            {children}
          </main>
          <SiteFooter />
        </div>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
