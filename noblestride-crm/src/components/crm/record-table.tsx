// record-table.tsx — Investor list table.
// Presentational; server-compatible (no "use client").

import Link from "next/link";
import { Avatar, Chip, Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import type { Prisma } from "@prisma/client";

// The shape returned by listInvestors (no contacts on list page).
// Using Prisma's generated type for Investor.
type InvestorRow = {
  id: string;
  name: string;
  investorType: string;
  status: string | null;
  sectorFocus: string[];
  geographicFocus: string[];
  ticketMin: Prisma.Decimal | null;
  ticketMax: Prisma.Decimal | null;
};

interface RecordTableProps {
  investors: InvestorRow[];
}

/**
 * RecordTable — renders the investor list as a styled table.
 * Columns: Investor (avatar+name link), Type, Ticket Size, Sectors, Geography, Status, Contact.
 * Contact is always "—" on the list page (listInvestors does not include contacts; no N+1).
 */
export function RecordTable({ investors }: RecordTableProps) {
  if (investors.length === 0) {
    return (
      <div className="rounded-lg bg-white border border-zinc-200 shadow-sm px-5 py-12 text-center text-zinc-500">
        No investors match the current filters.
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white border border-zinc-200 shadow-sm overflow-hidden">
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Investor</Th>
            <Th>Type</Th>
            <Th>Ticket Size</Th>
            <Th>Sectors</Th>
            <Th>Geography</Th>
            <Th>Status</Th>
            <Th>Contact</Th>
          </Tr>
        </THead>
        <TBody>
          {investors.map((inv) => {
            // Decimal → number conversions
            const min = inv.ticketMin == null ? null : Number(inv.ticketMin);
            const max = inv.ticketMax == null ? null : Number(inv.ticketMax);
            const ticketRange =
              min != null && max != null
                ? `${formatMoney(min)} – ${formatMoney(max)}`
                : min != null
                ? formatMoney(min)
                : max != null
                ? formatMoney(max)
                : "—";

            return (
              <Tr key={inv.id}>
                {/* Investor name + avatar, linked to detail */}
                <Td>
                  <Link
                    href={`/investors/${inv.id}`}
                    className="flex items-center gap-3 group"
                  >
                    <Avatar name={inv.name} size="sm" />
                    <span className="font-medium text-zinc-900 group-hover:text-accent transition-colors">
                      {inv.name}
                    </span>
                  </Link>
                </Td>

                {/* Type chip */}
                <Td>
                  <Chip value={inv.investorType} group="InvestorType" />
                </Td>

                {/* Ticket size range */}
                <Td className="whitespace-nowrap text-zinc-700">{ticketRange}</Td>

                {/* Sector chips — max 3 displayed */}
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {inv.sectorFocus.slice(0, 3).map((s) => (
                      <Chip key={s} value={s} group="Sector" />
                    ))}
                    {inv.sectorFocus.length > 3 && (
                      <span className="text-xs text-zinc-400">+{inv.sectorFocus.length - 3}</span>
                    )}
                  </div>
                </Td>

                {/* Geography chips — max 2 displayed */}
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {inv.geographicFocus.slice(0, 2).map((g) => (
                      <Chip key={g} value={g} group="Geography" />
                    ))}
                    {inv.geographicFocus.length > 2 && (
                      <span className="text-xs text-zinc-400">+{inv.geographicFocus.length - 2}</span>
                    )}
                  </div>
                </Td>

                {/* Status dot + label */}
                <Td>
                  {inv.status ? (
                    <Chip value={inv.status} group="InvestorStatus" />
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </Td>

                {/* Contact — not available on list page (no N+1) */}
                <Td className="text-zinc-400">—</Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
