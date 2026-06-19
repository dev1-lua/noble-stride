// transactions/page.tsx — Active Transactions Kanban board.
// Server Component: fetches data, shapes plain DTOs, renders StatRow + KanbanBoard (client).
// RSC → client serialization boundary: NO Prisma types or Decimal instances cross to client.

import { transactionsByStage } from "@/server/services/transactions";
import { dashboardStats } from "@/server/services/dashboard";
import { daysInStage, avgTimeToCloseMonths } from "@/server/domain/metrics";
import { label } from "@/lib/vocab";
import { formatMoney } from "@/lib/money";
import { StatRow } from "@/components/crm/stat-row";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { Button } from "@/components/ui";
import type { KanbanColumnDTO } from "@/components/crm/kanban-board";
import type { TransactionCardDTO } from "@/components/crm/kanban-card";
import { relationOptions } from "@/server/services/relation-options";
import { TransactionFormDrawer } from "@/components/crm/transaction-form-drawer";

export default async function TransactionsPage() {
  const rel = await relationOptions();
  // Parallel fetch: board data + dashboard KPI stats
  const [rawColumns, stats] = await Promise.all([
    transactionsByStage(),
    dashboardStats(),
  ]);

  const now = new Date();

  // ── Avg time to close: computed over all transactions ─────────────────────
  const allTxns = rawColumns.flatMap((col) =>
    col.items.map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txn = t as any;
      return {
        dateOpened: txn.dateOpened instanceof Date ? txn.dateOpened : null,
        closedAt: txn.closedAt instanceof Date ? txn.closedAt : null,
      };
    })
  );

  const avgClose = avgTimeToCloseMonths(allTxns);
  const avgCloseLabel = avgClose != null ? `${avgClose.toFixed(1)}mo` : "—";

  // ── Map Prisma rows → plain client-safe DTOs ──────────────────────────────
  const columns: KanbanColumnDTO<TransactionCardDTO>[] = rawColumns.map((col) => ({
    stage: col.stage,
    label: col.label,
    items: col.items.map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txn = t as any;
      const clientName: string = txn.client?.name ?? txn.name;
      const dealTypeName: string | null = txn.dealType ? label("DealType", txn.dealType) : null;
      const sectors: string[] = txn.sector ?? [];
      const instruments: string[] = txn.instrument ?? [];
      // Decimal → number → pre-formatted string
      const targetRaiseNum = txn.targetRaise != null ? Number(txn.targetRaise) : null;
      const targetRaise = targetRaiseNum != null ? formatMoney(targetRaiseNum) : null;
      const stageEnteredAt: Date = txn.stageEnteredAt ?? now;
      const ownerName: string | null = txn.owner?.name ?? null;
      const ownerColor: string | null = txn.owner?.avatarColor ?? null;

      return {
        id: txn.id,
        clientName,
        dealTypeName,
        sectors,
        instruments,
        targetRaise,
        investorsContacted: txn.investorsContacted ?? 0,
        activeConversations: txn.activeConversations ?? 0,
        daysInStage: daysInStage(stageEnteredAt, now),
        ownerName,
        ownerColor,
      } satisfies TransactionCardDTO;
    }),
  }));

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Active Transactions</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track fundraising execution for signed mandates
          </p>
        </div>
        {/* Action buttons — seams for Task 16 AI panels */}
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" disabled>
            Match Investors
          </Button>
          <Button variant="secondary" size="sm" disabled>
            Export
          </Button>
          <TransactionFormDrawer mode="create" clients={rel.clients} users={rel.users} mandates={rel.mandates} />
        </div>
      </div>

      {/* Stat tiles */}
      <StatRow
        tiles={[
          {
            label: "Active Transactions",
            value: String(stats.activeTransactions.value),
            sub: "Across all stages",
          },
          {
            label: "Investors Contacted",
            value: String(stats.investorsEngagedQtr.value),
            sub: "This quarter",
          },
          {
            label: "Capital Raising",
            value: formatMoney(stats.capitalRaisedYtd.value) || "—",
            sub: "Total target",
          },
          {
            label: "Avg. Time to Close",
            value: avgCloseLabel,
            sub: "Closed transactions",
          },
        ]}
      />

      {/* Filter bar — presentational */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <select className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 focus:outline-none">
            <option>All Sectors</option>
          </select>
          <select className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 focus:outline-none">
            <option>All Stages</option>
          </select>
          <select className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 focus:outline-none">
            <option>All Types</option>
          </select>
          <button
            type="button"
            className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            More Filters
          </button>
        </div>
      </div>

      {/* Kanban board (client component — handles DnD + mutation) */}
      <KanbanBoard kind="transaction" columns={columns} />
    </div>
  );
}
