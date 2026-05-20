import type { MetadataRoute } from "next";

import { getLeagues, getPatches, getTeams } from "@/lib/supabase/queries";
import { getBlogPosts } from "@/lib/blog-posts";

const baseUrl = "https://dotadata.org";

// Sitemap emits the default-locale URL only. Non-default locales (currently
// /ru/*) carry `<meta name="robots" content="noindex,follow">` (set in
// [locale]/layout.tsx) because their page bodies aren't translated yet —
// advertising them in the sitemap would just waste crawl budget.
const localizedEntry = (
  path: string,
  options: { changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number; lastModified: Date },
): MetadataRoute.Sitemap => [
  {
    url: `${baseUrl}${path}`,
    lastModified: options.lastModified,
    changeFrequency: options.changeFrequency,
    priority: options.priority,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [leagues, teams, patches, blogPosts] = await Promise.all([
    getLeagues(),
    getTeams(),
    getPatches(),
    getBlogPosts(),
  ]);
  const now = new Date();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: Math.max(0, currentYear - 2022) }, (_, index) => 2023 + index);

  const entries: MetadataRoute.Sitemap = [];

  entries.push(...localizedEntry("/", { changeFrequency: "daily", priority: 1, lastModified: now }));
  entries.push(...localizedEntry("/leagues", { changeFrequency: "daily", priority: 0.9, lastModified: now }));
  entries.push(...localizedEntry("/teams", { changeFrequency: "daily", priority: 0.9, lastModified: now }));
  entries.push(...localizedEntry("/seasons", { changeFrequency: "weekly", priority: 0.8, lastModified: now }));
  entries.push(...localizedEntry("/the-international", { changeFrequency: "weekly", priority: 0.8, lastModified: now }));
  entries.push(...localizedEntry("/dreamleague", { changeFrequency: "weekly", priority: 0.8, lastModified: now }));
  entries.push(...localizedEntry("/patches", { changeFrequency: "weekly", priority: 0.7, lastModified: now }));
  entries.push(...localizedEntry("/contact", { changeFrequency: "monthly", priority: 0.5, lastModified: now }));
  entries.push(...localizedEntry("/privacy", { changeFrequency: "yearly", priority: 0.3, lastModified: now }));
  entries.push(...localizedEntry("/blog", { changeFrequency: "weekly", priority: 0.8, lastModified: now }));

  blogPosts.forEach((post) => {
    entries.push(
      ...localizedEntry(`/blog/${post.slug}`, {
        changeFrequency: "monthly",
        priority: 0.7,
        lastModified: new Date(post.publishedAt),
      }),
    );
  });

  years.forEach((year) => {
    entries.push(
      ...localizedEntry(`/seasons/${year}`, {
        changeFrequency: "weekly",
        priority: 0.7,
        lastModified: now,
      }),
    );
  });

  // Only sitemap entities that actually have match data. Empty teams/leagues
  // render a "No data" state and get classified as soft 404s by Search Console,
  // which then suppresses indexing of the rest of the site.
  leagues
    .filter((league) => Boolean(league.slug && league.lastMatchTime))
    .forEach((league) => {
      const leagueLastModified = league.lastMatchTime ? new Date(league.lastMatchTime) : now;
      entries.push(
        ...localizedEntry(`/leagues/${league.slug}`, {
          changeFrequency: "weekly",
          priority: 0.7,
          lastModified: leagueLastModified,
        }),
      );
      entries.push(
        ...localizedEntry(`/leagues/${league.slug}/pick-ban`, {
          changeFrequency: "weekly",
          priority: 0.6,
          lastModified: leagueLastModified,
        }),
      );
    });

  teams
    .filter((team) => Boolean(team.slug && team.lastMatchTime))
    .forEach((team) => {
      entries.push(
        ...localizedEntry(`/teams/${team.slug}`, {
          changeFrequency: "weekly",
          priority: 0.7,
          lastModified: team.lastMatchTime ? new Date(team.lastMatchTime) : now,
        }),
      );
    });

  patches.forEach((patch) => {
    entries.push(
      ...localizedEntry(`/patches/${encodeURIComponent(patch.patch)}`, {
        changeFrequency: "weekly",
        priority: 0.6,
        lastModified: now,
      }),
    );
  });

  return entries;
}
