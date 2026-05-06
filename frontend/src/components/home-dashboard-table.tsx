"use client";

import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { formatNumber, formatPercent } from "@/lib/format";

export type LeagueBreakdownRow = {
  leagueId: string;
  leagueName: string;
  leagueSlug: string;
  matches: number;
  avgDuration: number;
  avgScore: number;
  radiantWinRate: number;
};

interface HomeDashboardTableProps {
  rows: LeagueBreakdownRow[];
}

const formatMinutes = (seconds: number) => `${(seconds / 60).toFixed(1)}m`;

export function HomeDashboardTable({ rows }: HomeDashboardTableProps) {
  const columns: ColumnDef<LeagueBreakdownRow>[] = [
    {
      accessorKey: "leagueName",
      header: "League",
      cell: ({ row }) => (
        <Link
          href={`/leagues/${row.original.leagueSlug}`}
          className="font-semibold text-foreground hover:underline"
        >
          {row.original.leagueName}
        </Link>
      ),
    },
    {
      accessorKey: "matches",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={column.getToggleSortingHandler()}>
          Matches
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="text-muted-foreground">{formatNumber(row.original.matches)}</span>,
    },
    {
      accessorKey: "avgDuration",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={column.getToggleSortingHandler()}>
          Avg duration
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="text-muted-foreground">{formatMinutes(row.original.avgDuration)}</span>,
    },
    {
      accessorKey: "avgScore",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={column.getToggleSortingHandler()}>
          Avg kills
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.avgScore.toFixed(1)}</span>,
    },
    {
      accessorKey: "radiantWinRate",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={column.getToggleSortingHandler()}>
          Radiant win
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatPercent(row.original.radiantWinRate)}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="leagueName"
      searchPlaceholder="Search leagues"
    />
  );
}
