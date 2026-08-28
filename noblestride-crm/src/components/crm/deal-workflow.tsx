"use client";

// deal-workflow.tsx — the Deal Workflow card (Aug-2026 feedback F4.1.1–4.1.3,
// G2, image13/15). Renders a resolved `DealWorkflow` (template steps grouped
// Qualify → Prepare → Execute, each with an evidence- or manually-derived
// status) and, when `canEdit`, lets the deal team mark steps done / reopen
// them / "move the deal here". Every step card links to the record that
// evidences it (VDR, documents, engagement, …) so the section is interactive.
// Replaces deal-journey.tsx (the fixed 17-step spine).

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { DealWorkflow, StepState, StepStatus } from "@/server/domain/workflow";

const SET_DEAL_STAGE_STATE = `
  mutation SetDealStageState($dealKind: DealKind!, $dealId: ID!, $stepKey: String!, $done: Boolean!, $note: String) {
    setDealStageState(dealKind: $dealKind, dealId: $dealId, stepKey: $stepKey, done: $done, note: $note) { done total }
  }
`;
const MOVE_DEAL_TO_STEP = `
  mutation MoveDealToWorkflowStep($dealKind: DealKind!, $dealId: ID!, $stepKey: String!) {
    moveDealToWorkflowStep(dealKind: $dealKind, dealId: $dealId, stepKey: $stepKey) { done total }
  }
`;

const CELL_BASE = "flex h-full flex-col gap-1.5 rounded-lg border px-2.5 py-2 transition-colors";

function cellClasses(status: StepStatus): string {
  switch (status) {
    case "done":
      return cn(CELL_BASE, "border-emerald-500/40 bg-emerald-500/[0.06]");
    case "current":
      return cn(CELL_BASE, "border-accent bg-[var(--bg-primary)] ring-1 ring-accent");
    case "manual":
      return cn(CELL_BASE, "border-dashed border-[var(--border-subtle)] bg-transparent");
    default:
      return cn(CELL_BASE, "border-[var(--border-subtle)] bg-[var(--bg-secondary)]");
  }
}

const BADGE_BASE = "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums";

function badgeClasses(status: StepStatus): string {
  switch (status) {
    case "done":
      return cn(BADGE_BASE, "bg-emerald-500 text-white");
    case "current":
      return cn(BADGE_BASE, "bg-accent text-white");
    case "manual":
      return cn(BADGE_BASE, "border border-dashed border-[var(--border-subtle)] text-[var(--text-tertiary)]");
    default:
      return cn(BADGE_BASE, "border border-[var(--border-subtle)] text-[var(--text-tertiary)]");
  }
}

function titleClasses(status: StepStatus): string {
  return cn(
    "text-[11px] leading-tight",
    status === "current"
      ? "font-semibold text-[var(--text-primary)]"
      : status === "done"
        ? "text-[var(--text-secondary)]"
        : "text-[var(--text-tertiary)]",
  );
}

const STATUS_SR: Record<StepStatus, string> = {
  done: " (done)",
  current: " (current step)",
  upcoming: " (upcoming)",
  manual: " (manual — mark done yourself)",
};

function fmt(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function subLine(step: StepState): string | null {
  if (step.source === "manual" && step.manualStatus === "complete") {
    const who = step.completedByName ? `Marked done by ${step.completedByName}` : "Marked done";
    return `${who}${step.completedAt ? ` · ${fmt(step.completedAt)}` : ""}${step.note ? ` — ${step.note}` : ""}`;
  }
  if (step.source === "manual" && step.manualStatus === "incomplete") {
    const who = step.completedByName ? `Reopened by ${step.completedByName}` : "Reopened";
    return `${who}${step.note ? ` — ${step.note}` : ""}`;
  }
  return step.evidenceLabel;
}

const ACTION_BTN =
  "rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50";

export interface DealWorkflowCardProps {
  workflow: DealWorkflow;
  /** Same permission the page uses to edit the record; false renders read-only. */
  canEdit: boolean;
}

export function DealWorkflowCard({ workflow, canEdit }: DealWorkflowCardProps) {
  const router = useRouter();
  const [, setState] = useMutation(SET_DEAL_STAGE_STATE);
  const [, moveTo] = useMutation(MOVE_DEAL_TO_STEP);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pct = workflow.total > 0 ? Math.round((workflow.done / workflow.total) * 100) : 0;
  const stepNumber = new Map(workflow.steps.map((s, i) => [s.key, i + 1]));

  async function run(key: string, fn: () => Promise<{ error?: { message: string } }>) {
    setError(null);
    setBusyKey(key);
    const result = await fn();
    setBusyKey(null);
    if (result.error) {
      setError(result.error.message.replace(/^\[GraphQL\]\s*/, ""));
      return;
    }
    router.refresh();
  }

  function markDone(step: StepState) {
    const note = window.prompt(`Mark "${step.title}" as done. Add a note (optional):`, "");
    if (note === null) return; // cancelled
    void run(step.key, () =>
      setState({ dealKind: workflow.dealKind, dealId: workflow.dealId, stepKey: step.key, done: true, note: note || null }),
    );
  }

  function reopen(step: StepState) {
    const note = window.prompt(`Reopen "${step.title}". Why? (optional):`, "");
    if (note === null) return;
    void run(step.key, () =>
      setState({ dealKind: workflow.dealKind, dealId: workflow.dealId, stepKey: step.key, done: false, note: note || null }),
    );
  }

  function moveHere(step: StepState) {
    const earlier = workflow.steps.filter((s) => s.order < step.order && s.status !== "done");
    const msg =
      earlier.length === 0
        ? `"${step.title}" is already the next open step.`
        : `Move this deal to "${step.title}"? ${earlier.length} earlier step(s) will be marked done: ${earlier.map((s) => s.title).join(", ")}.`;
    if (earlier.length === 0) {
      window.alert(msg);
      return;
    }
    if (!window.confirm(msg)) return;
    void run(step.key, () => moveTo({ dealKind: workflow.dealKind, dealId: workflow.dealId, stepKey: step.key }));
  }

  return (
    <div className="flex flex-col gap-3" data-testid="deal-workflow">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Deal workflow · <span data-testid="workflow-template-name">{workflow.templateName}</span>
          {workflow.isDefaultTemplate && (
            <span className="ml-2 rounded-full bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              default
            </span>
          )}
        </h2>
        <span className="truncate text-xs text-[var(--text-tertiary)]">
          {workflow.current ? `Currently: ${workflow.current.title}` : "All steps complete"}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
        The steps this deal moves through, in three phases (Qualify → Prepare → Execute). Most steps complete
        themselves from real records — click a step to open what it is based on. Steps marked <em>manual</em>{" "}
        have no record behind them: mark them done yourself. Admins edit the step list under Settings → Workflows.
      </p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--text-primary)]" data-testid="workflow-progress">
            {workflow.done} of {workflow.total} steps complete
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-tertiary)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" /> Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-accent bg-accent" aria-hidden="true" /> Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-[var(--border-subtle)]" aria-hidden="true" /> Upcoming
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-[var(--border-subtle)]" aria-hidden="true" />{" "}
          Manual (mark done yourself)
        </span>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {workflow.phases.map((phase) => (
        <section key={phase.phase} data-testid={`workflow-phase-${phase.phase}`}>
          <h3 className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            {phase.label}
            <span className="rounded-full bg-[var(--bg-tertiary)] px-1.5 text-[10px] font-semibold normal-case tracking-normal">
              {phase.steps.filter((s) => s.status === "done").length}/{phase.steps.length}
            </span>
          </h3>
          {phase.steps.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)]">No steps in this phase for this deal type.</p>
          ) : (
            <ol aria-label={`${phase.label} steps`} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {phase.steps.map((step) => {
                const isCurrent = step.status === "current";
                const external = step.href?.startsWith("http") ?? false;
                const busy = busyKey === step.key;
                const line = subLine(step);
                const body = (
                  <>
                    <div className="flex items-start gap-2">
                      <span className={badgeClasses(step.status)} aria-hidden="true">
                        {stepNumber.get(step.key)}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center gap-1">
                        <span className={titleClasses(step.status)}>
                          {step.title}
                          <span className="sr-only">{STATUS_SR[step.status]}</span>
                        </span>
                        {isCurrent && (
                          <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            Now
                          </span>
                        )}
                      </div>
                    </div>
                    {line && (
                      <span className="truncate pl-7 text-[10px] text-[var(--text-tertiary)]" data-testid="workflow-step-subline">
                        {line}
                      </span>
                    )}
                  </>
                );
                return (
                  <li
                    key={step.key}
                    aria-current={isCurrent ? "step" : undefined}
                    data-testid={`workflow-step-${step.key}`}
                    data-status={step.status}
                    className={cellClasses(step.status)}
                    title={step.description ?? undefined}
                  >
                    {step.href ? (
                      <Link
                        href={step.href}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noreferrer" : undefined}
                        className="flex flex-col gap-1 hover:opacity-80"
                        data-testid="workflow-step-link"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex flex-col gap-1">{body}</div>
                    )}
                    {canEdit && (
                      <div className="flex flex-wrap gap-1 pl-7">
                        {step.status === "done" ? (
                          <button type="button" className={ACTION_BTN} disabled={busy} onClick={() => reopen(step)} data-testid="workflow-reopen">
                            Reopen
                          </button>
                        ) : (
                          <>
                            <button type="button" className={ACTION_BTN} disabled={busy} onClick={() => markDone(step)} data-testid="workflow-mark-done">
                              Mark done
                            </button>
                            <button type="button" className={ACTION_BTN} disabled={busy} onClick={() => moveHere(step)} data-testid="workflow-move-here">
                              Move deal here
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
