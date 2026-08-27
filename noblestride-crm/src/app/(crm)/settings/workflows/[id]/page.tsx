// settings/workflows/[id]/page.tsx — edit one workflow template's step list.
// Admin-only (REAL role), same gate as the list page.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAuth } from "@/server/auth/current";
import { getWorkflowTemplate } from "@/server/services/workflow-templates";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui";
import { WorkflowTemplateEditor, type EditorStep } from "../workflow-template-editor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowTemplatePage({ params }: PageProps) {
  const auth = await getCurrentAuth();
  if (!auth || auth.account.kind !== "INTERNAL" || auth.user?.role !== "Admin" || !auth.user?.isActive) {
    redirect("/dashboard");
  }
  const { id } = await params;
  const template = await getWorkflowTemplate(id);
  if (!template) notFound();

  const steps: EditorStep[] = template.steps.map((s) => ({
    key: s.key,
    title: s.title,
    phase: s.phase,
    description: s.description ?? "",
    appliesTo: s.appliesTo,
    saved: true,
  }));

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href="/settings/workflows" className="transition-colors hover:text-[var(--text-secondary)]">
          Workflow templates
        </Link>
        <span>/</span>
        <span className="font-medium text-[var(--text-primary)]">{template.name}</span>
      </nav>

      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
          {template.name}
          {template.isDefault && <Badge tone="neutral">Default</Badge>}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Reorder with ▲/▼, edit titles and descriptions, choose which deal types each step applies to
          (leave &ldquo;Applies to&rdquo; empty for all), and add or remove steps. Saving replaces this
          template&rsquo;s step list; deals already using it pick the change up immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Steps</h2>
        </CardHeader>
        <CardBody>
          <WorkflowTemplateEditor templateId={template.id} initialName={template.name} initialSteps={steps} />
        </CardBody>
      </Card>
    </div>
  );
}
