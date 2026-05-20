import "server-only";

import { getLeagues, getPatches, getTeams } from "@/lib/supabase/queries";

// Skip entities that have no match data — those pages render an empty state
// that Search Console flags as soft 404. Filtering them out of both the
// sitemap (see app/sitemap.ts) and `generateStaticParams` prevents Next from
// pre-building empty pages and keeps them out of crawler discovery.
export async function getLeagueStaticParams(): Promise<Array<{ slug: string }>> {
  const leagues = await getLeagues();
  return leagues
    .filter((league) => Boolean(league.slug && league.lastMatchTime))
    .map((league) => ({ slug: league.slug }));
}

export async function getPatchStaticParams(): Promise<Array<{ patch: string }>> {
  const patches = await getPatches();
  return patches.filter((patch) => Boolean(patch.patch)).map((patch) => ({ patch: patch.patch }));
}

export async function getTeamStaticParams(): Promise<Array<{ slug: string }>> {
  const teams = await getTeams();
  return teams
    .filter((team) => Boolean(team.slug && team.lastMatchTime))
    .map((team) => ({ slug: team.slug }));
}
