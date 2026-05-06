import { getLocale, getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/language-switcher";
import { SiteAuth } from "@/components/site-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";

const navItems = [
  { href: "/blog", labelKey: "blog" },
  { href: "/leagues", labelKey: "leagues" },
  { href: "/teams", labelKey: "teams" },
  { href: "/seasons", labelKey: "seasons" },
  { href: "/the-international", labelKey: "international" },
  { href: "/patches", labelKey: "patches" },
  { href: "/contact", labelKey: "contact" },
] as const;

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const locale = await getLocale();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            DD
          </span>
          {tc("siteName")}
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="whitespace-nowrap text-muted-foreground hover:text-foreground"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <SiteAuth />
          <LanguageSwitcher currentLocale={locale} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
