"use client";
// clients-table-search.tsx — search/filter wrapper for the Clients list
// (auth-enhancements Task 8, Point 2). Wraps the existing presentational
// <ClientsTable> in <TableSearch>; rows are already primitives from page.tsx.

import { ClientsTable } from "@/components/crm/clients-table";
import { TableSearch, type TableFilter } from "@/components/crm/table-search";
import { options } from "@/lib/vocab";

interface ClientRow {
  id: string;
  name: string;
  hqCity: string | null;
  sector: string[];
  revenueLastYear: number | null;
  status: string;
  mandateCount: number;
}

const filters: TableFilter<ClientRow>[] = [
  { key: "status", label: "Status", options: options("ClientStatus"), get: (row) => row.status },
];

export function ClientsTableSearch({ clients }: { clients: ClientRow[] }) {
  return (
    <TableSearch
      rows={clients}
      searchText={(row) => [row.name, row.hqCity ?? ""]}
      filters={filters}
      searchPlaceholder="Search clients…"
      emptyLabel={'No clients yet. Use "+ New Client" to add one.'}
    >
      {(filtered) => <ClientsTable clients={filtered} />}
    </TableSearch>
  );
}
