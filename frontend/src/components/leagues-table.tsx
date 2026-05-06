"use client";

import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { League } from "@/lib/types";

interface LeaguesTableProps {
  leagues: League[];
}

export function LeaguesTable({ leagues }: LeaguesTableProps) {
  const columns: ColumnDef<League>[] = [
    {
      accessorKey: "name",
      header: "League",
      cell: ({ row }) => (
        <Link href={`/leagues/${row.original.slug}`} className="font-semibold text-foreground hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "startDate",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={column.getToggleSortingHandler()}>
          Start date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.startDate)}</span>,
    },
    {
      accessorKey: "endDate",
      header: "End date",
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.endDate)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={leagues}
      searchKey="name"
      searchPlaceholder="Search leagues"
    />
  );
}
