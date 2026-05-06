"use client";

import { ArrowUpDown } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { formatNumber, formatPercent } from "@/lib/format";

export interface PickBanTableRow {
  heroId: string;
  heroName: string;
  heroImage: string | null;
  picks: number;
  bans: number;
  contested: number;
  pickRate: number;
  banRate: number;
  contestRate: number;
  winRate: number | null;
  radiantPicks: number;
  direPicks: number;
  avgPickOrder: number | null;
  avgBanOrder: number | null;
}

interface LeaguePickBanTableProps {
  rows: PickBanTableRow[];
}

const sortHeader = (label: string) => function SortHeader({
  column,
}: {
  column: { getToggleSortingHandler: () => ((event: unknown) => void) | undefined };
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={column.getToggleSortingHandler()}
      className="-ml-2 h-7 px-2"
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );
};

export function LeaguePickBanTable({ rows }: LeaguePickBanTableProps) {
  const columns: ColumnDef<PickBanTableRow>[] = [
    {
      accessorKey: "heroName",
      header: "Hero",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 overflow-hidden rounded-md border border-border/60 bg-muted">
            {row.original.heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.original.heroImage}
                alt={row.original.heroName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                N/A
              </div>
            )}
          </div>
          <span className="font-semibold text-foreground">{row.original.heroName}</span>
        </div>
      ),
    },
    {
      accessorKey: "picks",
      header: sortHeader("Picks"),
      cell: ({ row }) => (
        <span className="text-foreground">{formatNumber(row.original.picks)}</span>
      ),
    },
    {
      accessorKey: "bans",
      header: sortHeader("Bans"),
      cell: ({ row }) => (
        <span className="text-foreground">{formatNumber(row.original.bans)}</span>
      ),
    },
    {
      accessorKey: "contested",
      header: sortHeader("Contested"),
      cell: ({ row }) => (
        <span className="font-semibold text-primary">
          {formatNumber(row.original.contested)}
        </span>
      ),
    },
    {
      accessorKey: "contestRate",
      header: sortHeader("Contest %"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatPercent(row.original.contestRate)}
        </span>
      ),
    },
    {
      accessorKey: "winRate",
      header: sortHeader("Win %"),
      cell: ({ row }) => {
        const value = row.original.winRate;
        if (value === null) {
          return <span className="text-muted-foreground">—</span>;
        }
        const tone =
          value >= 55 ? "text-emerald-500" : value <= 45 ? "text-rose-500" : "text-foreground";
        return <span className={tone}>{formatPercent(value)}</span>;
      },
      sortingFn: (a, b) => (a.original.winRate ?? -1) - (b.original.winRate ?? -1),
    },
    {
      id: "sideSplit",
      header: "Side split (R / D)",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          <span className="text-emerald-500">{formatNumber(row.original.radiantPicks)}</span>
          {" / "}
          <span className="text-rose-500">{formatNumber(row.original.direPicks)}</span>
        </span>
      ),
    },
    {
      accessorKey: "avgPickOrder",
      header: sortHeader("Avg pick order"),
      cell: ({ row }) => {
        const value = row.original.avgPickOrder;
        return (
          <span className="text-muted-foreground">
            {value === null ? "—" : value.toFixed(1)}
          </span>
        );
      },
      sortingFn: (a, b) => (a.original.avgPickOrder ?? 99) - (b.original.avgPickOrder ?? 99),
    },
    {
      accessorKey: "avgBanOrder",
      header: sortHeader("Avg ban order"),
      cell: ({ row }) => {
        const value = row.original.avgBanOrder;
        return (
          <span className="text-muted-foreground">
            {value === null ? "—" : value.toFixed(1)}
          </span>
        );
      },
      sortingFn: (a, b) => (a.original.avgBanOrder ?? 99) - (b.original.avgBanOrder ?? 99),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="heroName"
      searchPlaceholder="Search hero…"
    />
  );
}
