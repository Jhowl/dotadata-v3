"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { formatNumber, formatPercent } from "@/lib/format";

type HandicapBuckets = Record<string, number>;

type HandicapRow = {
  team: {
    id: string;
    slug: string;
    name: string;
  };
  stats: {
    totalMatches: number;
    victories: number;
    losses: number;
    percentages: {
      victories: HandicapBuckets;
      losses: HandicapBuckets;
      general: HandicapBuckets;
    };
  };
};

type SortDirection = "asc" | "desc";
type SortKey =
  | { kind: "matches" }
  | { kind: "winrate" }
  | { kind: "handicap"; handicap: string };

type HandicapGeneralTableProps = {
  rows: HandicapRow[];
  handicapRange: string[];
  type: "victories" | "losses" | "general";
};

const formatHandicapLabel = (handicap: string) => {
  const value = Number(handicap);
  if (Number.isFinite(value) && value > 0) {
    return `+${handicap}`;
  }
  return handicap;
};

const sortIndicator = (active: boolean, direction: SortDirection) => {
  if (!active) {
    return "";
  }
  return direction === "asc" ? " ^" : " v";
};

export function HandicapGeneralTable({ rows, handicapRange, type }: HandicapGeneralTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>({ kind: "matches" });
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aWinrate = a.stats.totalMatches ? (a.stats.victories / a.stats.totalMatches) * 100 : 0;
      const bWinrate = b.stats.totalMatches ? (b.stats.victories / b.stats.totalMatches) * 100 : 0;

      let diff = 0;

      if (sortKey.kind === "matches") {
        diff = a.stats.totalMatches - b.stats.totalMatches;
      } else if (sortKey.kind === "winrate") {
        diff = aWinrate - bWinrate;
      } else {
        const aValue = a.stats.percentages[type][sortKey.handicap] ?? 0;
        const bValue = b.stats.percentages[type][sortKey.handicap] ?? 0;
        diff = aValue - bValue;
      }

      if (diff === 0) {
        diff = a.stats.totalMatches - b.stats.totalMatches;
      }

      return sortDirection === "asc" ? diff : -diff;
    });

    return sorted;
  }, [rows, sortDirection, sortKey, type]);

  const handleSort = (nextKey: SortKey) => {
    const isSame =
      sortKey.kind === nextKey.kind &&
      (sortKey.kind !== "handicap" || (nextKey.kind === "handicap" && sortKey.handicap === nextKey.handicap));

    if (isSame) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("desc");
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-border/60 text-sm">
        <thead className="bg-muted/60">
          <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
            <th className="sticky left-0 z-10 min-w-[240px] bg-muted/60 px-4 py-3">
              Team
            </th>
            <th className="sticky left-[240px] z-10 min-w-[80px] bg-muted/60 px-4 py-3">
              <button type="button" className="font-semibold" onClick={() => handleSort({ kind: "matches" })}>
                Matches{sortIndicator(sortKey.kind === "matches", sortDirection)}
              </button>
            </th>
            <th className="sticky left-[320px] z-10 min-w-[90px] bg-muted/60 px-4 py-3">
              <button type="button" className="font-semibold" onClick={() => handleSort({ kind: "winrate" })}>
                Winrate{sortIndicator(sortKey.kind === "winrate", sortDirection)}
              </button>
            </th>
            {handicapRange.map((handicap) => {
              const isActive = sortKey.kind === "handicap" && sortKey.handicap === handicap;
              return (
                <th key={handicap} className="px-3 py-3 text-center">
                  <button
                    type="button"
                    className="font-semibold"
                    onClick={() => handleSort({ kind: "handicap", handicap })}
                  >
                    {formatHandicapLabel(handicap)}
                    {sortIndicator(isActive, sortDirection)}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(({ team, stats }) => {
            const winrate = stats.totalMatches ? (stats.victories / stats.totalMatches) * 100 : 0;
            return (
              <tr key={team.id} className="border-t border-border/60">
                <td className="sticky left-0 z-10 min-w-[240px] bg-card/80 px-4 py-3 font-semibold text-primary">
                  <Link href={`/teams/${team.slug || team.id}`}>{team.name}</Link>
                </td>
                <td className="sticky left-[240px] z-10 min-w-[80px] bg-card/80 px-4 py-3 text-muted-foreground">
                  {formatNumber(stats.totalMatches)}
                </td>
                <td className="sticky left-[320px] z-10 min-w-[90px] bg-card/80 px-4 py-3 text-muted-foreground">
                  {formatPercent(winrate)}
                </td>
                {handicapRange.map((handicap) => (
                  <td key={handicap} className="px-3 py-3 text-center text-muted-foreground">
                    {stats.percentages[type][handicap] ?? 0}%
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
