"use client";

import { memo } from "react";

import {
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
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="avgDuration"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={showDots ? { r: 3 } : false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgScore"
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
