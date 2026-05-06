"use client";

import { useMemo, useState } from "react";

import { formatNumber } from "@/lib/format";
import type { Team } from "@/lib/types";

type HandicapBuckets = Record<string, number>;

type TeamHandicapData = {
  team: Team;
  totalMatches: number;
  victories: number;
  losses: number;
  avgKillDifference: number;
  avgDurationMinutes: number;
  handicap: {
    counts: {
      victories: HandicapBuckets;
      losses: HandicapBuckets;
      general: HandicapBuckets;
    };
    percentages: {
      victories: HandicapBuckets;
      losses: HandicapBuckets;
      general: HandicapBuckets;
    };
  };
};

type SortKey = "handicap" | "count" | "percent";
type SortDirection = "asc" | "desc";

type HandicapTableProps = {
  handicapRange: string[];
  data: TeamHandicapData;
  type: "victories" | "losses" | "general";
  accent: string;
};

const formatHandicapLabel = (handicap: string) => {
  const value = Number(handicap);
  if (Number.isFinite(value) && value > 0) {
    return `+${handicap}`;
  }
  return handicap;
};

const toggleDirection = (current: SortDirection) => (current === "asc" ? "desc" : "asc");

export function HandicapTable({ handicapRange, data, type, accent }: HandicapTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("handicap");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const rows = useMemo(() => {
    const baseRows = handicapRange.map((handicap) => ({
      handicap,
      handicapValue: Number(handicap),
      count: data.handicap.counts[type][handicap] ?? 0,
      percent: data.handicap.percentages[type][handicap] ?? 0,
    }));

    const sorted = [...baseRows].sort((a, b) => {
      let diff = 0;
      if (sortKey === "handicap") {
        diff = a.handicapValue - b.handicapValue;
      } else if (sortKey === "count") {
        diff = a.count - b.count;
      } else {
        diff = a.percent - b.percent;
      }

      if (diff === 0) {
        diff = a.handicapValue - b.handicapValue;
      }

      return sortDirection === "asc" ? diff : -diff;
    });

    return sorted;
  }, [data.handicap.counts, data.handicap.percentages, handicapRange, sortDirection, sortKey, type]);

  const handleSort = (nextKey: SortKey) => {
    if (nextKey === sortKey) {
      setSortDirection(toggleDirection);
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  };

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) {
      return "";
    }
    return sortDirection === "asc" ? " ^" : " v";
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-border/60 text-sm">
        <thead className="bg-muted/60">
          <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
            <th className="px-3 py-2">
              <button type="button" className="font-semibold" onClick={() => handleSort("handicap")}>
                Handicap{sortIndicator("handicap")}
              </button>
            </th>
            <th className="px-3 py-2">
              <button type="button" className="font-semibold" onClick={() => handleSort("count")}>
                Count{sortIndicator("count")}
              </button>
            </th>
            <th className="px-3 py-2">
              <button type="button" className="font-semibold" onClick={() => handleSort("percent")}>
                %{sortIndicator("percent")}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.handicap} className="border-t border-border/60">
              <td className="px-3 py-2 font-semibold text-foreground">{formatHandicapLabel(row.handicap)}</td>
              <td className="px-3 py-2 text-muted-foreground">{formatNumber(row.count)}</td>
              <td className={`px-3 py-2 ${accent}`}>{row.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
