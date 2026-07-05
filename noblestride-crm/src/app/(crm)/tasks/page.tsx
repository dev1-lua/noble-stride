// tasks/page.tsx — team task tracker (RSC). Source: the client's WhatsApp
// tasks tracker; rows link to the client/investor/mandate they mention.
import { prisma } from "@/lib/db";
import { label } from "@/lib/vocab";
import { formatDate } from "@/lib/format";
import { flagOverdueTasks } from "@/server/services/tasks";
import { relationOptions } from "@/server/services/relation-options";
import { TaskFormDrawer } from "@/components/crm/task-form-drawer";
import { TasksTable, type TaskRowData } from "@/components/crm/tasks-table";

const STATUS_ORDER = ["Ongoing", "Pending", "NotStarted", "Done"] as const;

const toDateInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function TasksPage() {
  // Auto-escalation (spec §3.8/§12.2): flip overdue open tasks before reading.
  await flagOverdueTasks();

  const [tasks, rel] = await Promise.all([
    prisma.task.findMany({
      orderBy: [{ dueAt: "desc" }],
      include: {
        assignee: { select: { name: true } },
        client: { select: { id: true, name: true } },
        investor: { select: { id: true, name: true } },
        mandate: { select: { id: true, name: true } },
        transaction: { select: { id: true, name: true } },
      },
    }),
    relationOptions(),
  ]);

  const counts = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, tasks.filter((t) => t.status === s).length]),
  );
  const overdueCount = tasks.filter((t) => t.escalated).length;

  const rows: TaskRowData[] = tasks.map((t) => {
    const related = t.client
      ? { href: `/clients/${t.client.id}`, name: t.client.name }
      : t.investor
        ? { href: `/investors/${t.investor.id}`, name: t.investor.name }
        : t.mandate
          ? { href: `/mandates/${t.mandate.id}`, name: t.mandate.name }
          : t.transaction
            ? { href: `/transactions/${t.transaction.id}`, name: t.transaction.name }
            : null;

    return {
      id: t.id,
      title: t.title,
      status: t.status,
      source: t.source,
      escalated: t.escalated,
      dueAtDisplay: formatDate(t.dueAt),
      dueAtInput: toDateInput(t.dueAt),
      body: t.body,
      assigneeName: t.assignee?.name ?? null,
      assigneeId: t.assigneeId,
      assistantId: t.assistantId,
      mandateId: t.mandateId,
      transactionId: t.transactionId,
      investorId: t.investorId,
      clientId: t.clientId,
      related,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tasks</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {tasks.length} action points across the team
          </p>
        </div>
        <TaskFormDrawer
          mode="create"
          mandates={rel.mandates}
          transactions={rel.transactions}
          investors={rel.investors}
          clients={rel.clients}
          users={rel.users}
        />
      </div>

      <div className="grid grid-cols-5 gap-4">
        {STATUS_ORDER.map((s) => (
          <div key={s} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-2xl font-bold text-zinc-900">{counts[s]}</div>
            <div className="text-xs text-zinc-500">{label("TaskStatus", s)}</div>
          </div>
        ))}
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-2xl font-bold text-rose-700">{overdueCount}</div>
          <div className="text-xs text-rose-600">Overdue</div>
        </div>
      </div>

      <TasksTable
        tasks={rows}
        mandates={rel.mandates}
        transactions={rel.transactions}
        investors={rel.investors}
        clients={rel.clients}
        users={rel.users}
      />
    </div>
  );
}
