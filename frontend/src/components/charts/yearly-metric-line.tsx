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

interface YearlyMetricPoint {
  month: string;
  value: number;
}

interface YearlyMetricLineProps {
  data: YearlyMetricPoint[];
  color: string;
}

const tooltipContentStyle = {
  borderRadius: 12,
  borderColor: "rgba(15, 23, 42, 0.8)",
  backgroundColor: "rgba(15, 23, 42, 0.95)",
};
const tooltipItemStyle = { color: "#e2e8f0" };
const tooltipLabelStyle = { color: "#f8fafc", fontWeight: 600 };

function YearlyMetricLineChart({ data, color }: YearlyMetricLineProps) {
  const showDots = data.length <= 24;

  return (
    <ClientChartFrame className="h-[260px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
            isAnimationActive={false}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={showDots ? { r: 3 } : false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ClientChartFrame>
  );
}

export const YearlyMetricLine = memo(YearlyMetricLineChart);
export default YearlyMetricLine;
