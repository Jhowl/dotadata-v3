"use client";

import { memo, useMemo } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ClientChartFrame } from "@/components/charts/client-chart-frame";
import { League, Match } from "@/lib/types";

interface LeagueActivityProps {
  leagues: League[];
  matches: Match[];
}

const tooltipCursorStyle = { fill: "rgba(24, 185, 157, 0.12)" };
const tooltipContentStyle = {
  borderRadius: 12,
  borderColor: "rgba(15, 23, 42, 0.8)",
  backgroundColor: "rgba(15, 23, 42, 0.95)",
};
const tooltipItemStyle = { color: "#e2e8f0" };
const tooltipLabelStyle = { color: "#f8fafc", fontWeight: 600 };

function LeagueActivityChart({ leagues, matches }: LeagueActivityProps) {
  const data = useMemo(() => {
    const matchesByLeague = matches.reduce<Record<string, number>>((acc, match) => {
      acc[match.leagueId] = (acc[match.leagueId] ?? 0) + 1;
      return acc;
    }, {});

    return leagues
      .filter((league) => (matchesByLeague[league.id] ?? 0) > 0)
      .map((league) => ({
        name: league.name,
        shortName: league.name.split(" ").slice(0, 3).join(" "),
        matches: matchesByLeague[league.id] ?? 0,
      }))
      .sort((a, b) => b.matches - a.matches);
  }, [leagues, matches]);

  return (
    <ClientChartFrame className="h-[280px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="4 4" opacity={0.3} />
          <XAxis
            dataKey="shortName"
            tick={{ fontSize: 12 }}
            interval={0}
            angle={-55}
            height={90}
            tickMargin={12}
            textAnchor="end"
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            cursor={tooltipCursorStyle}
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
          />
          <Bar dataKey="matches" fill="var(--primary)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ClientChartFrame>
  );
}

export const LeagueActivity = memo(LeagueActivityChart);
export default LeagueActivity;
