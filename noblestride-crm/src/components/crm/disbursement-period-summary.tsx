// disbursement-period-summary.tsx — Disbursement totals grouped by year and
// quarter (spec §13), rendered beside the existing per-engagement
// DisbursementTable. Presentational; server-compatible (no "use client").

import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import type { PeriodDisbursement } from "@/server/services/dashboard";

export function DisbursementPeriodSummary({ rows }: { rows: PeriodDisbursement[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)] px-5 py-6 text-center text-sm text-zinc-400">
        No dated disbursements yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white border border-zinc-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden">
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Period</Th>
            <Th>Total</Th>
            <Th>Disbursed</Th>
            <Th>Pending</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <Tr key={`${r.year}-${r.quarter}`}>
              <Td className="font-medium text-zinc-900">
                {r.year} · Q{r.quarter}
              </Td>
              <Td className="text-zinc-700">{formatMoney(r.total)}</Td>
              <Td className="text-zinc-700">{formatMoney(r.disbursed)}</Td>
              <Td className="text-zinc-700">{formatMoney(r.pending)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
