"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { Team } from "@/lib/types";

interface TeamsTableProps {
  teams: Team[];
}

export function TeamsTable({ teams }: TeamsTableProps) {
  const columns: ColumnDef<Team>[] = [
    {
      accessorKey: "name",
      header: "Team",
      cell: ({ row }) => (
        <Link href={`/teams/${row.original.slug}`} className="font-semibold text-foreground hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "logoUrl",
      header: "Logo",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.logoUrl ? "Available" : "—"}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={teams}
      searchKey="name"
      searchPlaceholder="Search teams"
    />
  );
}
