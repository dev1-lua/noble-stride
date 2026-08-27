// settings/workflows/page.tsx — Admin-only workflow template list (Aug-2026
// feedback F4.1.2/image14: stages customisable, new templates per deal).
// Guarded server-side against the REAL role, like settings/users.

import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAuth } from "@/server/auth/current";
import { listWorkflowTemplates } from "@/server/services/workflow-templates";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui";
import { TemplateRowActions, NewTemplateForm } from "./template-actions";

export const dynamic = "force-dynamic";

function usedByLabel(b: { mandates: number; transactions: number; advisory: number }): string {
  const parts = [
    b.mandates ? `${b.mandates} mandate${b.mandates === 1 ? "" : "s"}` : null,
    b.transactions ? `${b.transactions} transaction${b.transactions === 1 ? "" : "s"}` : null,
    b.advisory ? `${b.advisory} advisory` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export default async function WorkflowSettingsPage() {
  const auth = await getCurrentAuth();
  if (!auth || auth.account.kind !== "INTERNAL" || auth.user?.role !== "Admin" || !auth.user?.isActive) {
    redirect("/dashboard");
  }

  const templates = await listWorkflowTemplates();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Workflow templates</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          The step lists deal pages show as their Deal Workflow. Deals use the default template unless a
          template is picked on the deal itself. Evidence rules attach to step <em>keys</em>, so keeping the
          standard keys keeps steps completing themselves from real records.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Templates</h2>
          <NewTemplateForm />
        </CardHeader>
        <CardBody className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Steps</th>
                  <th className="px-4 py-3">Used by</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border-subtle)] last:border-0" data-testid="wf-template-row">
                    <td className="px-4 py-3">
                      <Link
                        href={`/settings/workflows/${t.id}`}
                        className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                      >
                        {t.name}
                      </Link>
                      {t.isDefault && (
                        <Badge tone="neutral" className="ml-2" data-testid="wf-default-badge">
                          Default
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{t.stepCount}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{usedByLabel(t.usedByBreakdown)}</td>
                    <td className="px-4 py-3">
                      <TemplateRowActions id={t.id} isDefault={t.isDefault} usedBy={t.usedBy} />
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-sm text-[var(--text-tertiary)]">
                      No templates yet. Run <code>npm run seed:workflow</code> to create the default, or add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
