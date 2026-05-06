import type { Match, Patch, Team } from "@/lib/types";

type TournamentResolver = (match: Match) => string;
type SeriesKeyResolver = (match: Match) => string | null;

const csvEscape = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
};

const parseStartTime = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const matchCsvHeader = [
  "tournament",
  "Radiant (team)",
  "Dire (team)",
  "kill team 1",
  "kill team 2",
  "Mapa (1, 2, 3)",
  "series id",
  "vencedor",
  "data",
  "patch",
];

export const buildCsvResponse = (csv: string, filename: string, cacheSeconds = 3600) =>
  new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": `public, s-maxage=${cacheSeconds}, max-age=0, stale-while-revalidate=86400`,
    },
  });

export function buildMatchCsv({
  matches,
  teams,
  patches,
  tournamentResolver,
  seriesKeyResolver,
}: {
  matches: Match[];
  teams: Team[];
  patches: Patch[];
  tournamentResolver: TournamentResolver;
  seriesKeyResolver: SeriesKeyResolver;
}) {
  const teamLookup = new Map(teams.map((team) => [team.id, team.name]));
  const patchLookup = new Map(patches.map((patch) => [patch.id, patch.patch]));
  const mapNumberByMatchId = new Map<string, number>();
  const seriesMapCounter = new Map<string, number>();

  const matchesByTime = [...matches].sort((a, b) => {
    const timeDiff = parseStartTime(a.startTime) - parseStartTime(b.startTime);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.id.localeCompare(b.id);
  });

  matchesByTime.forEach((match) => {
    const seriesKey = seriesKeyResolver(match);
    if (!seriesKey) {
      return;
    }

    const next = (seriesMapCounter.get(seriesKey) ?? 0) + 1;
    seriesMapCounter.set(seriesKey, next);
    mapNumberByMatchId.set(match.id, next);
  });

  const rows = matchesByTime.map((match) => {
    const tournament = tournamentResolver(match);
    const radiantTeam = match.radiantTeamId ? teamLookup.get(match.radiantTeamId) ?? `Team ${match.radiantTeamId}` : "";
    const direTeam = match.direTeamId ? teamLookup.get(match.direTeamId) ?? `Team ${match.direTeamId}` : "";
    const winner = match.radiantWin ? radiantTeam || "Radiant" : direTeam || "Dire";
    const mapNumber = mapNumberByMatchId.get(match.id) ?? match.seriesType ?? "";
    const patchName = patchLookup.get(match.patchId) ?? "";

    return [
      tournament,
      radiantTeam,
      direTeam,
      match.radiantScore,
      match.direScore,
      mapNumber,
      match.seriesId ?? "",
      winner,
      match.startTime,
      patchName,
    ];
  });

  return [matchCsvHeader, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}
