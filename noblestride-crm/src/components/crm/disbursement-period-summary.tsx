// disbursement-period-summary.tsx — Disbursement totals grouped by year and
// quarter (spec §13), rendered beside the existing per-engagement
// DisbursementTable. Presentational; server-compatible (no "use client").

import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import type { PeriodDisbursement } from "@/server/services/dashboard";

export function DisbursementPeriodSummary({ rows }: { rows: PeriodDisbursement[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-5 py-6 text-center text-sm text-[var(--text-tertiary)]">
        No dated disbursements yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] overflow-hidden">
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
              <Td className="font-medium text-[var(--text-primary)]">
                {r.year} · Q{r.quarter}
              </Td>
              <Td className="text-[var(--text-secondary)]">{formatMoney(r.total)}</Td>
              <Td className="text-[var(--text-secondary)]">{formatMoney(r.disbursed)}</Td>
              <Td className="text-[var(--text-secondary)]">{formatMoney(r.pending)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
