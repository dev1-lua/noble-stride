"use client";
// workflow-template-editor.tsx — the step-list editor for one workflow
// template (Aug-2026 feedback F4.1.2). Client island: keeps the whole step
// list in local state, posts it as JSON to saveTemplateAction (which
// re-validates with workflowTemplateSaveSchema and gates on requireRealAdmin).
//
// Keys are IMMUTABLE once saved: DealStageState rows are keyed on
// (dealKind, dealId, stepKey), so renaming a key would orphan recorded
// progress. New rows derive their key from the title until first save.

import { useActionState, useState } from "react";
import { MultiSelect } from "@/components/ui";
import { Button } from "@/components/ui";
import { slugKey, STEP_KEY_RE } from "@/lib/schemas/workflow";
import { options } from "@/lib/vocab";
import { EVIDENCE_RULE_KEYS } from "@/server/domain/workflow";
import { saveTemplateAction, type WorkflowActionState } from "./actions";

const PHASES = ["Qualify", "Prepare", "Execute"] as const;

export interface EditorStep {
  key: string;
  title: string;
  phase: (typeof PHASES)[number];
  description: string;
  appliesTo: string[];
  /** True for rows that already exist in the DB — their key is locked. */
  saved: boolean;
}

const initialState: WorkflowActionState = {};

const INPUT =
  "w-full rounded border border-[var(--border-strong)] bg-[var(--bg-primary)] px-2 py-1.5 text-xs text-[var(--text-primary)]";
const SMALL_BTN =
  "rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40";

export function WorkflowTemplateEditor({
  templateId,
  initialName,
  initialSteps,
}: {
  templateId: string;
  initialName: string;
  initialSteps: EditorStep[];
}) {
  const [state, submitAction, pending] = useActionState(saveTemplateAction, initialState);
  const [name, setName] = useState(initialName);
  const [steps, setSteps] = useState<EditorStep[]>(initialSteps);
  const dealKindOptions = options("DealKind");

  function update(i: number, patch: Partial<EditorStep>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function retitle(i: number, title: string) {
    setSteps((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        // Unsaved rows keep their key in sync with the title; saved rows never move.
        const key = s.saved ? s.key : slugKey(title, prev.filter((_, j) => j !== i).map((x) => x.key));
        return { ...s, title, key };
      }),
    );
  }

  function move(i: number, delta: number) {
    setSteps((prev) => {
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        key: slugKey("New step", prev.map((s) => s.key)),
        title: "New step",
        phase: "Execute",
        description: "",
        appliesTo: [],
        saved: false,
      },
    ]);
  }

  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  const payload = JSON.stringify({
    name,
    steps: steps.map((s) => ({
      key: s.key,
      title: s.title,
      phase: s.phase,
      description: s.description.trim() === "" ? null : s.description,
      appliesTo: s.appliesTo,
    })),
  });

  const localError =
    steps.length === 0
      ? "A template needs at least one step."
      : steps.find((s) => !STEP_KEY_RE.test(s.key))
        ? "Every step needs a valid camelCase key — rename the step so a key can be derived."
        : new Set(steps.map((s) => s.key)).size !== steps.length
          ? "Step keys must be unique within a template."
          : null;

  return (
    <form action={submitAction} className="space-y-4">
      <input type="hidden" name="id" value={templateId} />
      <input type="hidden" name="payload" value={payload} />

      <div className="max-w-md">
        <label htmlFor="wf-name" className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">
          Template name
        </label>
        <input
          id="wf-name"
          className={INPUT}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          data-testid="wf-name"
        />
      </div>

      <div className="space-y-2">
        {steps.map((s, i) => (
          <div
            key={`${s.key}-${i}`}
            data-testid="wf-step-row"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3"
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex flex-col items-center gap-1 pt-1">
                <span className="text-[11px] font-semibold tabular-nums text-[var(--text-tertiary)]">{i + 1}</span>
                <button type="button" className={SMALL_BTN} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${s.title} up`}>
                  ▲
                </button>
                <button
                  type="button"
                  className={SMALL_BTN}
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                  aria-label={`Move ${s.title} down`}
                >
                  ▼
                </button>
              </div>

              <div className="min-w-[12rem] flex-1">
                <label className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)]">Title</label>
                <input
                  className={INPUT}
                  value={s.title}
                  maxLength={80}
                  onChange={(e) => retitle(i, e.target.value)}
                  data-testid="wf-step-title"
                />
                <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                  key <code>{s.key}</code>
                  {s.saved ? " · locked (recorded progress is keyed on it)" : " · derived from the title until saved"}
                  {EVIDENCE_RULE_KEYS.includes(s.key) ? " · completes itself from records" : " · manual only"}
                </p>
              </div>

              <div className="w-32">
                <label className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)]">Phase</label>
                <select
                  className={INPUT}
                  value={s.phase}
                  onChange={(e) => update(i, { phase: e.target.value as EditorStep["phase"] })}
                  data-testid="wf-step-phase"
                >
                  {PHASES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-44">
                <label className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)]">Applies to</label>
                <MultiSelect
                  options={dealKindOptions}
                  selected={s.appliesTo}
                  onChange={(next) => update(i, { appliesTo: next })}
                  placeholder="All deal types"
                  aria-label={`${s.title} applies to`}
                />
              </div>

              <div className="min-w-[14rem] flex-[2]">
                <label className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)]">Description</label>
                <textarea
                  className={INPUT}
                  rows={2}
                  maxLength={400}
                  value={s.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  data-testid="wf-step-description"
                />
              </div>

              <div className="pt-5">
                <button type="button" className={SMALL_BTN} onClick={() => removeStep(i)} data-testid="wf-step-remove">
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" type="button" onClick={addStep} data-testid="wf-step-add">
          + Add step
        </Button>
        <Button variant="primary" size="sm" type="submit" disabled={pending || Boolean(localError)} data-testid="wf-save">
          {pending ? "Saving…" : "Save template"}
        </Button>
        {state.ok && !state.error && <span className="text-xs text-emerald-600">Saved.</span>}
        {(localError || state.error) && (
          <span className="text-xs text-[var(--t-tag-text-rose)]" data-testid="wf-error">
            {localError ?? state.error}
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">
        Evidence rules attach to these keys: {EVIDENCE_RULE_KEYS.join(", ")} — steps with any other key are
        manual-only (the team marks them done).
      </p>
    </form>
  );
}
