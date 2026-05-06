import "server-only";

import { getLeagues, getPatches, getTeams } from "@/lib/supabase/queries";

export async function getLeagueStaticParams(): Promise<Array<{ slug: string }>> {
  const leagues = await getLeagues();
  return leagues.filter((league) => Boolean(league.slug)).map((league) => ({ slug: league.slug }));
}

export async function getPatchStaticParams(): Promise<Array<{ patch: string }>> {
  const patches = await getPatches();
  return patches.filter((patch) => Boolean(patch.patch)).map((patch) => ({ patch: patch.patch }));
}

export async function getTeamStaticParams(): Promise<Array<{ slug: string }>> {
  const teams = await getTeams();
  return teams.filter((team) => Boolean(team.slug)).map((team) => ({ slug: team.slug }));
}
