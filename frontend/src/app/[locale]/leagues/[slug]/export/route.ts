import { buildCsvResponse, buildMatchCsv } from "@/lib/exports/match-csv";
import { getAllMatchesByLeague, getLeagueBySlug, getPatches, getTeams } from "@/lib/supabase/queries";

export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);

  if (!league) {
    return new Response("League not found.", { status: 404 });
  }

  const [matches, teams, patches] = await Promise.all([
    getAllMatchesByLeague(league.id),
    getTeams(),
    getPatches(),
  ]);
  const csv = buildMatchCsv({
    matches,
    teams,
    patches,
    tournamentResolver: () => league.name,
    seriesKeyResolver: (match) => match.seriesId ?? null,
  });
  const filename = `league-${league.slug}-matches.csv`;

  return buildCsvResponse(csv, filename);
}
