"use client";
// clients-table-search.tsx — search/filter wrapper for the Clients list.
// Aug-2026 feedback F6.1/image26 adds Country, Sector and Revenue filters
// alongside Status; F2.2/image3 adds the Created column (page.tsx orders
// newest-first). Rows are already primitives from page.tsx; filtering stays
// client-side because every client row is loaded unpaginated (the list-page
// convention here — investors are server-filtered only because paginated).

import { ClientsTable } from "@/components/crm/clients-table";
import { TableSearch, type TableFilter } from "@/components/crm/table-search";
import { options } from "@/lib/vocab";
import { revenueBandOptions } from "@/server/domain/revenue-bands";

export interface ClientRow {
  id: string;
  name: string;
  hqCity: string | null;
  sector: string[];
  revenueLastYear: number | null;
  status: string;
  mandateCount: number;
  createdAt: string;
  hqCountry: string | null;
  countries: string[];
  countryLabels: string[];
  revenueBand: string;
  codename: string | null;
}

// Country options come from both sources a client's country can live in:
// the free-text HQ country and the Geography enum list.
function countryOptions(rows: ClientRow[]): { value: string; label: string }[] {
  const values = new Set<string>();
  for (const r of rows) {
    if (r.hqCountry) values.add(r.hqCountry);
    for (const g of r.countryLabels) values.add(g);
  }
  return [...values].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
}

export function ClientsTableSearch({ clients }: { clients: ClientRow[] }) {
  const filters: TableFilter<ClientRow>[] = [
    { key: "status", label: "Status", options: options("ClientStatus"), get: (row) => row.status },
    {
      key: "country",
      label: "Country",
      options: countryOptions(clients),
      get: (row) => row.hqCountry ?? "",
      // OR across HQ country and the Geography labels.
      getAll: (row) => [row.hqCountry, ...row.countryLabels].filter((v): v is string => Boolean(v)),
    },
    {
      key: "sector",
      label: "Sector",
      options: options("Sector"),
      get: (row) => row.sector[0] ?? "",
      getAll: (row) => row.sector,
    },
    { key: "revenue", label: "Revenue", options: revenueBandOptions(), get: (row) => row.revenueBand },
  ];

  return (
    <TableSearch
      rows={clients}
      searchText={(row) => [row.name, row.hqCity ?? "", row.hqCountry ?? "", row.codename ?? ""]}
      filters={filters}
      searchPlaceholder="Search clients…"
      emptyLabel={'No clients yet. Use "+ New Client" to add one.'}
    >
      {(filtered) => <ClientsTable clients={filtered} />}
    </TableSearch>
  );
}
