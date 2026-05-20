"use client";

// Route-segment error boundary for everything under [locale]. Triggers when a
// Server Component throws during render (most often: backend API unreachable).
// next-intl messages are wrapped around children by the layout, so
// useTranslations works here as long as the locale layout itself didn't fail
// — for root-layout failures see app/global-error.tsx.

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LocaleError({ error, reset }: ErrorProps) {
  const t = useTranslations("errors");

  useEffect(() => {
    // Surface to the browser console so it shows up in Sentry/GA if those are
    // ever wired up. The `digest` field is what Next surfaces in server logs
    // for cross-referencing.
    console.error("[locale]/error caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <Mascot variant="notFound" className="h-56 w-auto opacity-95 md:h-72" priority />
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">500</p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{t("title")}</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground md:text-base">{t("body")}</p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground/80">
            {t("digestLabel")}: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>{t("tryAgain")}</Button>
        <Button asChild variant="outline">
          <Link href="/">{t("goHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
