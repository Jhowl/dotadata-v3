"use client";

import { memo, useMemo } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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

const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const BAR_LABEL = { fill: "var(--foreground)", fontSize: 11, fontWeight: 600 } as const;

const tooltipCursorStyle = { fill: "rgba(24, 185, 157, 0.12)" };
const tooltipContentStyle = {
  borderRadius: 12,
  borderColor: "rgba(15, 23, 42, 0.8)",
  backgroundColor: "rgba(15, 23, 42, 0.95)",
};
const tooltipItemStyle = { color: "#e2e8f0" };
const tooltipLabelStyle = { color: "#f8fafc", fontWeight: 600 };

const truncate = (value: string, max = 32) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

function LeagueActivityChart({ leagues, matches }: LeagueActivityProps) {
  const data = useMemo(() => {
    const matchesByLeague = matches.reduce<Record<string, number>>((acc, match) => {
      acc[match.leagueId] = (acc[match.leagueId] ?? 0) + 1;
      return acc;
    }, {});

    const rows = leagues
      .filter((league) => (matchesByLeague[league.id] ?? 0) > 0)
      .map((league) => ({
        id: league.id,
        name: league.name,
        matches: matchesByLeague[league.id] ?? 0,
      }))
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 12);

    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.name] = (acc[row.name] ?? 0) + 1;
      return acc;
    }, {});
    const seen: Record<string, number> = {};
    return rows.map((row) => {
      let label = truncate(row.name);
      if (counts[row.name] > 1) {
        seen[row.name] = (seen[row.name] ?? 0) + 1;
        label = `${truncate(row.name, 28)} (${seen[row.name]})`;
      }
      return { ...row, label };
    });
  }, [leagues, matches]);

  const chartHeight = Math.max(280, data.length * 36 + 48);

  return (
    <ClientChartFrame className="min-w-0" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 48, bottom: 8, left: 8 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="4 4" opacity={0.2} horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            allowDecimals={false}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={AXIS_TICK}
            width={180}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip
            cursor={tooltipCursorStyle}
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
            formatter={(value) => [Number(value ?? 0).toLocaleString(), "Matches"]}
          />
          <Bar dataKey="matches" fill="var(--primary)" radius={[0, 6, 6, 0]} minPointSize={2}>
            <LabelList dataKey="matches" position="right" style={BAR_LABEL} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ClientChartFrame>
  );
}

export const LeagueActivity = memo(LeagueActivityChart);
export default LeagueActivity;
