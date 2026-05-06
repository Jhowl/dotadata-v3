import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

const links = [
  { href: "/leagues", labelKey: "leagues" },
  { href: "/teams", labelKey: "teams" },
  { href: "/seasons", labelKey: "seasons" },
  { href: "/the-international", labelKey: "international" },
  { href: "/patches", labelKey: "patches" },
  { href: "/contact", labelKey: "contact" },
] as const;

export async function SiteFooter() {
  const t = await getTranslations("nav");
  const tf = await getTranslations("footer");
  const tc = await getTranslations("common");

  return (
    <footer className="border-t border-border/60 bg-background/80">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.2fr_1fr] md:px-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-display text-lg font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              DD
            </span>
            {tc("siteName")}
          </div>
          <p className="text-sm text-muted-foreground">{tf("description")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground"
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        {new Date().getFullYear()} {tf("rightsReserved")}
      </div>
    </footer>
  );
}
