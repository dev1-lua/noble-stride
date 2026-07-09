// disbursement-table.tsx — Invested engagements with disbursement tracking.
// Presentational; server-compatible (no "use client").

import Link from "next/link";
import { Chip, Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { EngagementFormDrawer } from "@/components/crm/engagement-form-drawer";

export interface DisbursementRow {
  id: string;
  investorId: string;
  investorName: string;
  transactionId: string;
  transactionName: string;
  totalAmount: number | null;
  amountDisbursed: number | null;
  amountPending: number | null;
  disbursementStatus: string | null;
  dateReceived: Date | null;
  /** Prebuilt EngagementFormDrawer initial (plain serializable values). */
  editInitial: Record<string, unknown> & { id: string; transactionId: string; investorId: string };
}

const sum = (rows: DisbursementRow[], key: "totalAmount" | "amountDisbursed" | "amountPending") =>
  rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);

/**
 * DisbursementTable — Invested engagements with totalAmount / amountDisbursed /
 * amountPending / disbursementStatus / dateReceived plus column totals.
 */
export function DisbursementTable({ rows }: { rows: DisbursementRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-5 py-10 text-center text-sm text-[var(--text-tertiary)]">
        No invested deals yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] overflow-hidden">
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Investor</Th>
            <Th>Transaction</Th>
            <Th>Total</Th>
            <Th>Disbursed</Th>
            <Th>Pending</Th>
            <Th>Status</Th>
            <Th>Received</Th>
            <Th>{null}</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td>
                <Link
                  href={`/investors/${r.investorId}`}
                  className="font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
                >
                  {r.investorName}
                </Link>
              </Td>
              <Td>
                <Link
                  href={`/transactions/${r.transactionId}`}
                  className="text-[var(--text-secondary)] hover:text-accent transition-colors"
                >
                  {r.transactionName}
                </Link>
              </Td>
              <Td className="text-[var(--text-secondary)]">{r.totalAmount != null ? formatMoney(r.totalAmount) : "—"}</Td>
              <Td className="text-[var(--text-secondary)]">{r.amountDisbursed != null ? formatMoney(r.amountDisbursed) : "—"}</Td>
              <Td className="text-[var(--text-secondary)]">{r.amountPending != null ? formatMoney(r.amountPending) : "—"}</Td>
              <Td>
                {r.disbursementStatus ? (
                  <Chip value={r.disbursementStatus} group="DisbursementStatus" />
                ) : (
                  <span className="text-[var(--text-tertiary)]">—</span>
                )}
              </Td>
              <Td className="text-[var(--text-secondary)]">{formatDate(r.dateReceived) || "—"}</Td>
              <Td>
                <EngagementFormDrawer initial={r.editInitial} triggerLabel="Edit" />
              </Td>
            </Tr>
          ))}
          {/* Column totals */}
          <Tr className="hover:bg-transparent bg-[var(--bg-secondary)]">
            <Td className="font-semibold text-[var(--text-primary)]">Total</Td>
            <Td />
            <Td className="font-semibold text-[var(--text-primary)]">{formatMoney(sum(rows, "totalAmount"))}</Td>
            <Td className="font-semibold text-[var(--text-primary)]">{formatMoney(sum(rows, "amountDisbursed"))}</Td>
            <Td className="font-semibold text-[var(--text-primary)]">{formatMoney(sum(rows, "amountPending"))}</Td>
            <Td />
            <Td />
            <Td />
          </Tr>
        </TBody>
      </Table>
    </div>
  );
}
