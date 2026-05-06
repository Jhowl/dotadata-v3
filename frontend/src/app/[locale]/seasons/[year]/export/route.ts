import { buildCsvResponse, buildMatchCsv } from "@/lib/exports/match-csv";
import { getLeagues, getMatchesByYear, getPatches, getTeams } from "@/lib/supabase/queries";

export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const seasonYear = Number(year);

  if (!Number.isFinite(seasonYear)) {
    return new Response("Invalid season year.", { status: 400 });
  }

  const [matches, teams, patches, leagues] = await Promise.all([
    getMatchesByYear(seasonYear),
    getTeams(),
    getPatches(),
    getLeagues(),
  ]);

  const leagueLookup = new Map(leagues.map((league) => [league.id, league.name]));
  const csv = buildMatchCsv({
    matches,
    teams,
    patches,
    tournamentResolver: (match) => leagueLookup.get(match.leagueId) ?? `League ${match.leagueId}`,
    seriesKeyResolver: (match) => (match.seriesId ? `${match.leagueId}-${match.seriesId}` : null),
  });
  const filename = `season-${seasonYear}-matches.csv`;

  return buildCsvResponse(csv, filename);
}
