"use client";

import { memo } from "react";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ClientChartFrame } from "@/components/charts/client-chart-frame";

interface YearlyMetricsPoint {
  month: string;
  avgDuration: number;
  avgScore: number;
}

interface YearlyMetricsProps {
  data: YearlyMetricsPoint[];
}

const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const LEGEND_STYLE = { fontSize: 12, color: "var(--muted-foreground)" } as const;
const tooltipContentStyle = {
  borderRadius: 12,
  borderColor: "rgba(15, 23, 42, 0.8)",
  backgroundColor: "rgba(15, 23, 42, 0.95)",
};
const tooltipItemStyle = { color: "#e2e8f0" };
const tooltipLabelStyle = { color: "#f8fafc", fontWeight: 600 };

function YearlyMetricsChart({ data }: YearlyMetricsProps) {
  const showDots = data.length <= 24;

  return (
    <ClientChartFrame className="h-[320px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="4 4" opacity={0.2} />
          <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis
            yAxisId="left"
            tick={AXIS_TICK}
            allowDecimals={false}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_TICK}
            allowDecimals={false}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="avgDuration"
            name="Avg duration (min)"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={showDots ? { r: 3 } : false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgScore"
            name="Avg kills"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={showDots ? { r: 3 } : false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ClientChartFrame>
  );
}

export const YearlyMetrics = memo(YearlyMetricsChart);
export default YearlyMetrics;
