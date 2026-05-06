import { Match } from "@/lib/types";

export type MatchSummary = {
  totalMatches: number;
  avgDuration: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  minScoreMatch: Match | null;
  maxScoreMatch: Match | null;
  avgFirstTowerTime: number | null;
  radiantWinRate: number;
  fastestMatch: Match | null;
  longestMatch: Match | null;
};

export function summarizeMatches(matches: Match[]): MatchSummary {
  if (!matches.length) {
    return {
      totalMatches: 0,
      avgDuration: 0,
      avgScore: 0,
      minScore: 0,
      maxScore: 0,
      minScoreMatch: null,
      maxScoreMatch: null,
      avgFirstTowerTime: null,
      radiantWinRate: 0,
      fastestMatch: null,
      longestMatch: null,
    };
  }

  let durationSum = 0;
  let scoreSum = 0;
  let minScore = Number.POSITIVE_INFINITY;
  let maxScore = 0;
  let radiantWins = 0;
  let firstTowerSum = 0;
  let firstTowerCount = 0;
  let fastestMatch: Match | null = null;
  let longestMatch: Match | null = null;
  let minScoreMatch: Match | null = null;
  let maxScoreMatch: Match | null = null;

  matches.forEach((match) => {
    durationSum += match.duration;
    const score = match.radiantScore + match.direScore;
    scoreSum += score;
    if (score < minScore) {
      minScore = score;
      minScoreMatch = match;
    }
    if (score > maxScore) {
      maxScore = score;
      maxScoreMatch = match;
    }
    if (match.radiantWin) {
      radiantWins += 1;
    }
    if (typeof match.firstTowerTime === "number") {
      firstTowerSum += match.firstTowerTime;
      firstTowerCount += 1;
    }

    if (!fastestMatch || match.duration < fastestMatch.duration) {
      fastestMatch = match;
    }
    if (!longestMatch || match.duration > longestMatch.duration) {
      longestMatch = match;
    }
  });

  return {
    totalMatches: matches.length,
    avgDuration: durationSum / matches.length,
    avgScore: scoreSum / matches.length,
    minScore: minScore === Number.POSITIVE_INFINITY ? 0 : minScore,
    maxScore,
    minScoreMatch,
    maxScoreMatch,
    avgFirstTowerTime: firstTowerCount ? firstTowerSum / firstTowerCount : null,
    radiantWinRate: (radiantWins / matches.length) * 100,
    fastestMatch,
    longestMatch,
  };
}
