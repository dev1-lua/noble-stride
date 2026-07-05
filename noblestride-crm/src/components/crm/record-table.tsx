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
  onboardingStatus: string;
};

interface RecordTableProps {
  investors: InvestorRow[];
}

/**
 * RecordTable — renders the investor list as a styled table.
 * Columns: Investor (avatar+name link), Type, Ticket Size, Sectors, Geography, Status, Onboarding.
 * (No Contact column on the list page — listInvestors omits contacts to avoid an N+1.)
 */
export function RecordTable({ investors }: RecordTableProps) {
  if (investors.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)] px-5 py-12 text-center text-zinc-500">
        No investors match the current filters.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white border border-zinc-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden">
      <Table className="table-fixed">
        {/* Fixed column proportions so the table always fits its card (no
            horizontal scroll); the Investor name truncates to absorb the slack. */}
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
        </colgroup>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Investor</Th>
            <Th>Type</Th>
            <Th>Ticket Size</Th>
            <Th>Sectors</Th>
            <Th>Geography</Th>
            <Th>Status</Th>
            <Th>Onboarding</Th>
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
                    className="flex items-center gap-3 group min-w-0"
                    title={inv.name}
                  >
                    <Avatar name={inv.name} size="sm" />
                    <span className="min-w-0 truncate font-medium text-zinc-900 group-hover:text-accent transition-colors">
                      {inv.name}
                    </span>
                  </Link>
                </Td>

                {/* Type chip */}
                <Td>
                  <Chip value={inv.investorType} group="InvestorType" />
                </Td>

                {/* Ticket size range — wraps in its fixed-width column */}
                <Td className="text-zinc-700">{ticketRange}</Td>

                {/* Sector chips — primary sector + count, rest summarised */}
                <Td>
                  <div className="flex flex-nowrap items-center gap-1">
                    {inv.sectorFocus.slice(0, 1).map((s) => (
                      <Chip key={s} value={s} group="Sector" className="min-w-0 max-w-full" />
                    ))}
                    {inv.sectorFocus.length > 1 && (
                      <span className="inline-flex flex-shrink-0 items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-500">
                        +{inv.sectorFocus.length - 1}
                      </span>
                    )}
                  </div>
                </Td>

                {/* Geography chips — max 1 displayed, rest summarised */}
                <Td>
                  <div className="flex flex-nowrap items-center gap-1">
                    {inv.geographicFocus.slice(0, 1).map((g) => (
                      <Chip key={g} value={g} group="Geography" />
                    ))}
                    {inv.geographicFocus.length > 1 && (
                      <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-500">
                        +{inv.geographicFocus.length - 1}
                      </span>
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

                {/* Onboarding dot + label */}
                <Td>
                  <Chip value={inv.onboardingStatus} group="OnboardingStatus" />
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
