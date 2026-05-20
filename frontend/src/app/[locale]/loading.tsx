// Default loading UI for all routes under [locale]. Next renders this while
// the page's Server Components are streaming, so users see structured shimmer
// instead of a blank screen on slow first paints (most relevant for the
// league/team slug pages, which fan out 7+ DB queries).
//
// Per-route loading.tsx files can replace this with a more specific skeleton
// (e.g. blog list vs. league detail). This generic one is intentionally vague
// — it sketches the hero header, a 4-up KPI grid, and a content card.

const Pulse = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-muted/70 ${className}`} aria-hidden="true" />
);

export default function LocaleLoading() {
  return (
    <div className="space-y-10" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* Breadcrumb row */}
      <div className="flex items-center gap-2">
        <Pulse className="h-3 w-16" />
        <Pulse className="h-3 w-3 rounded-full" />
        <Pulse className="h-3 w-24" />
      </div>

      {/* Hero header */}
      <div className="space-y-4 rounded-2xl border border-border/60 bg-card/80 p-6 md:p-8">
        <Pulse className="h-5 w-24" />
        <Pulse className="h-9 w-2/3" />
        <Pulse className="h-4 w-full max-w-xl" />
        <div className="flex flex-wrap gap-3 pt-1">
          <Pulse className="h-4 w-24" />
          <Pulse className="h-4 w-32" />
          <Pulse className="h-4 w-28" />
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-xl border border-border/60 bg-card/80 p-6"
          >
            <Pulse className="h-3 w-20" />
            <Pulse className="h-8 w-24" />
            <Pulse className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Content card */}
      <div className="rounded-2xl border border-border/60 bg-card/80 p-6">
        <Pulse className="mb-4 h-5 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Pulse className="h-8 w-8 rounded-md" />
              <Pulse className="h-3 flex-1" />
              <Pulse className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
