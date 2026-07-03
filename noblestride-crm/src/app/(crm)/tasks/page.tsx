// tasks/page.tsx — team task tracker (RSC). Source: the client's WhatsApp
// tasks tracker; rows link to the client/investor/mandate they mention.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { label } from "@/lib/vocab";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const STATUS_ORDER = ["Ongoing", "Pending", "NotStarted", "Done"] as const;

const STATUS_CHIP: Record<string, string> = {
  Ongoing: "bg-amber-50 text-amber-700",
  Pending: "bg-sky-50 text-sky-700",
  NotStarted: "bg-zinc-100 text-zinc-500",
  Done: "bg-emerald-50 text-emerald-700",
};

export default async function TasksPage() {
  const tasks = await prisma.task.findMany({
    orderBy: [{ dueAt: "desc" }],
    include: {
      assignee: { select: { name: true } },
      client: { select: { id: true, name: true } },
      investor: { select: { id: true, name: true } },
      mandate: { select: { id: true, name: true } },
      transaction: { select: { id: true, name: true } },
    },
  });

  const counts = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, tasks.filter((t) => t.status === s).length]),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Tasks</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {tasks.length} action points across the team
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {STATUS_ORDER.map((s) => (
          <div key={s} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-2xl font-bold text-zinc-900">{counts[s]}</div>
            <div className="text-xs text-zinc-500">{label("TaskStatus", s)}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3">Action point</th>
              <th className="px-4 py-3">Related to</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const rel = t.client
                ? { href: `/clients/${t.client.id}`, name: t.client.name }
                : t.investor
                  ? { href: `/investors/${t.investor.id}`, name: t.investor.name }
                  : t.mandate
                    ? { href: `/mandates/${t.mandate.id}`, name: t.mandate.name }
                    : t.transaction
                      ? { href: `/transactions/${t.transaction.id}`, name: t.transaction.name }
                      : null;
              return (
                <tr key={t.id} className="border-b border-zinc-100 last:border-0">
                  <td className="max-w-md px-4 py-2.5">
                    <div className="font-medium text-zinc-900">{t.title}</div>
                    {t.body && <div className="truncate text-xs text-zinc-500">{t.body}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    {rel ? (
                      <Link href={rel.href} className="text-emerald-700 hover:underline">
                        {rel.name}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_CHIP[t.status] ?? "bg-zinc-100 text-zinc-500",
                      )}
                    >
                      {label("TaskStatus", t.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">{t.assignee?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{formatDate(t.dueAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
