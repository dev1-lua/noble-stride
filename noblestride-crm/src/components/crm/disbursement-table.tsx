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
      <div className="rounded-xl bg-white border border-zinc-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)] px-5 py-10 text-center text-sm text-zinc-400">
        No invested engagements yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white border border-zinc-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden">
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
                  className="font-medium text-zinc-900 hover:text-accent transition-colors"
                >
                  {r.investorName}
                </Link>
              </Td>
              <Td>
                <Link
                  href={`/transactions/${r.transactionId}`}
                  className="text-zinc-600 hover:text-accent transition-colors"
                >
                  {r.transactionName}
                </Link>
              </Td>
              <Td className="text-zinc-700">{r.totalAmount != null ? formatMoney(r.totalAmount) : "—"}</Td>
              <Td className="text-zinc-700">{r.amountDisbursed != null ? formatMoney(r.amountDisbursed) : "—"}</Td>
              <Td className="text-zinc-700">{r.amountPending != null ? formatMoney(r.amountPending) : "—"}</Td>
              <Td>
                {r.disbursementStatus ? (
                  <Chip value={r.disbursementStatus} group="DisbursementStatus" />
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </Td>
              <Td className="text-zinc-600">{formatDate(r.dateReceived) || "—"}</Td>
              <Td>
                <EngagementFormDrawer initial={r.editInitial} triggerLabel="Edit" />
              </Td>
            </Tr>
          ))}
          {/* Column totals */}
          <Tr className="hover:bg-transparent bg-zinc-50/80">
            <Td className="font-semibold text-zinc-900">Total</Td>
            <Td />
            <Td className="font-semibold text-zinc-900">{formatMoney(sum(rows, "totalAmount"))}</Td>
            <Td className="font-semibold text-zinc-900">{formatMoney(sum(rows, "amountDisbursed"))}</Td>
            <Td className="font-semibold text-zinc-900">{formatMoney(sum(rows, "amountPending"))}</Td>
            <Td />
            <Td />
            <Td />
          </Tr>
        </TBody>
      </Table>
    </div>
  );
}
