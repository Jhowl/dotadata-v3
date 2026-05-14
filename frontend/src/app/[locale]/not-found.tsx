import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <Mascot variant="notFound" className="h-64 w-auto opacity-95 md:h-80" priority />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">404</p>
      <h1 className="font-display text-4xl font-semibold md:text-5xl">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground md:text-base">
        The page you&apos;re looking for has rotated out of the meta. Try the home page or one of the
        sections below.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/">Home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/leagues">Leagues</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/teams">Teams</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/blog">Blog</Link>
        </Button>
      </div>
    </div>
  );
}
