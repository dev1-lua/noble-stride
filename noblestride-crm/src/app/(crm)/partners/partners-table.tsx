"use client";
// partners-table.tsx — Partner Directory table extracted from page.tsx so it
// can be wrapped in <TableSearch> (auth-enhancements Task 8, Point 2). Rows
// already join the referral stats server-side — see PartnerRowData below.

import Link from "next/link";
import { Chip, Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { options } from "@/lib/vocab";
import { TableSearch, type TableFilter } from "@/components/crm/table-search";

export interface PartnerRowData {
  id: string;
  name: string;
  partnerType: string | null;
  location: string | null;
  referred: number;
  active: number;
  closed: number;
  revenue: number | null;
}

const filters: TableFilter<PartnerRowData>[] = [
  { key: "partnerType", label: "Type", options: options("PartnerType"), get: (row) => row.partnerType ?? "" },
];

export function PartnersTable({ partners }: { partners: PartnerRowData[] }) {
  return (
    <TableSearch
      rows={partners}
      searchText={(row) => [row.name, row.location ?? ""]}
      filters={filters}
      searchPlaceholder="Search partners…"
      emptyLabel="No partners on record."
    >
      {(filtered) => (
        <Table>
          <THead>
            <Tr>
              <Th>Partner</Th>
              <Th>Type</Th>
              <Th>Location</Th>
              <Th>Referred</Th>
              <Th>Active</Th>
              <Th>Closed</Th>
              <Th>Revenue</Th>
            </Tr>
          </THead>
          <TBody>
            {filtered.map((partner) => (
              <Tr key={partner.id}>
                <Td>
                  <Link
                    href={`/partners/${partner.id}`}
                    className="font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
                  >
                    {partner.name}
                  </Link>
                </Td>
                <Td>
                  {partner.partnerType ? (
                    <Chip value={partner.partnerType} group="PartnerType" />
                  ) : (
                    <span className="text-[var(--text-tertiary)]">—</span>
                  )}
                </Td>
                <Td>
                  <span className="text-[var(--text-secondary)]">{partner.location ?? "—"}</span>
                </Td>
                <Td>{partner.referred}</Td>
                <Td>{partner.active}</Td>
                <Td>{partner.closed}</Td>
                <Td>{partner.revenue != null ? formatMoney(partner.revenue) : "—"}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </TableSearch>
  );
}
