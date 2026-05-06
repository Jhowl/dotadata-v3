"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeagueActivity } from "@/components/charts/league-activity";
import { PatchTrend } from "@/components/charts/patch-trend";
import { YearlyMetricLine } from "@/components/charts/yearly-metric-line";
import { YearlyMetrics } from "@/components/charts/yearly-metrics";
import type { League, Match, Patch } from "@/lib/types";

type Labels = {
  title: string;
  subtitle: string;
  matchVolume: string;
  matchVolumeDesc: string;
  durationKills: string;
  durationKillsDesc: string;
  patchTrend: string;
  patchTrendDesc: string;
  leagueActivity: string;
  leagueActivityDesc: string;
};

interface HomeTrendsProps {
  matchVolume: Array<{ month: string; value: number }>;
  yearlyMetrics: Array<{ month: string; avgDuration: number; avgScore: number }>;
  patches: Patch[];
  patchTrendStats: Array<{ patchId: string; matches: number; avgDuration: number }>;
  leagues: League[];
  matches: Match[];
  labels: Labels;
}

export function HomeTrends({
  matchVolume,
  yearlyMetrics,
  patches,
  patchTrendStats,
  leagues,
  matches,
  labels,
}: HomeTrendsProps) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{labels.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{labels.subtitle}</p>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="match-volume" className="gap-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:flex sm:w-fit">
            <TabsTrigger value="match-volume">{labels.matchVolume}</TabsTrigger>
            <TabsTrigger value="duration-kills">{labels.durationKills}</TabsTrigger>
            <TabsTrigger value="patch-trend">{labels.patchTrend}</TabsTrigger>
            <TabsTrigger value="league-activity">{labels.leagueActivity}</TabsTrigger>
          </TabsList>

          <TabsContent value="match-volume" className="space-y-3">
            <p className="text-xs text-muted-foreground">{labels.matchVolumeDesc}</p>
            <YearlyMetricLine data={matchVolume} color="var(--chart-1)" />
          </TabsContent>

          <TabsContent value="duration-kills" className="space-y-3">
            <p className="text-xs text-muted-foreground">{labels.durationKillsDesc}</p>
            <YearlyMetrics data={yearlyMetrics} />
          </TabsContent>

          <TabsContent value="patch-trend" className="space-y-3">
            <p className="text-xs text-muted-foreground">{labels.patchTrendDesc}</p>
            <PatchTrend patches={patches} stats={patchTrendStats} />
          </TabsContent>

          <TabsContent value="league-activity" className="space-y-3">
            <p className="text-xs text-muted-foreground">{labels.leagueActivityDesc}</p>
            <LeagueActivity leagues={leagues} matches={matches} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
