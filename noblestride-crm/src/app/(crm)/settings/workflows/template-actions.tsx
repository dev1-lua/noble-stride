"use client";
// template-actions.tsx — per-row buttons on /settings/workflows. Server
// actions do the authorising (requireRealAdmin); this only renders controls.

import { useActionState } from "react";
import {
  duplicateTemplateAction,
  setDefaultTemplateAction,
  deleteTemplateAction,
  createTemplateAction,
  type WorkflowActionState,
} from "./actions";

const initialState: WorkflowActionState = {};

const BTN =
  "rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium " +
  "text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50";

function ErrorLine({ state }: { state: WorkflowActionState }) {
  if (!state.error) return null;
  return <p className="mt-1 text-xs text-[var(--t-tag-text-rose)]">{state.error}</p>;
}

export function TemplateRowActions({
  id,
  isDefault,
  usedBy,
}: {
  id: string;
  isDefault: boolean;
  usedBy: number;
}) {
  const [dupState, dupAction, dupPending] = useActionState(duplicateTemplateAction, initialState);
  const [defState, defAction, defPending] = useActionState(setDefaultTemplateAction, initialState);
  const [delState, delAction, delPending] = useActionState(deleteTemplateAction, initialState);

  const deleteBlocked = isDefault
    ? "The default template can't be deleted — make another template the default first."
    : usedBy > 0
      ? `${usedBy} deal(s) still use this template.`
      : undefined;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <form action={dupAction} className="inline">
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={BTN} disabled={dupPending} data-testid="wf-duplicate">
            {dupPending ? "Copying…" : "Duplicate"}
          </button>
        </form>
        {!isDefault && (
          <form action={defAction} className="inline">
            <input type="hidden" name="id" value={id} />
            <button type="submit" className={BTN} disabled={defPending} data-testid="wf-set-default">
              {defPending ? "Setting…" : "Set default"}
            </button>
          </form>
        )}
        <form action={delAction} className="inline">
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className={BTN}
            disabled={delPending || Boolean(deleteBlocked)}
            title={deleteBlocked}
            data-testid="wf-delete"
          >
            {delPending ? "Deleting…" : "Delete"}
          </button>
        </form>
      </div>
      <ErrorLine state={dupState} />
      <ErrorLine state={defState} />
      <ErrorLine state={delState} />
    </div>
  );
}

export function NewTemplateForm() {
  const [state, submitAction, pending] = useActionState(createTemplateAction, initialState);
  return (
    <form action={submitAction} className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <input
          name="name"
          placeholder="New template name"
          required
          maxLength={80}
          aria-label="New template name"
          data-testid="wf-new-name"
          className="rounded border border-[var(--border-strong)] bg-[var(--bg-primary)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
        />
        <button type="submit" className={BTN} disabled={pending} data-testid="wf-new-submit">
          {pending ? "Creating…" : "+ New template"}
        </button>
      </div>
      <p className="text-[11px] text-[var(--text-tertiary)]">
        A new template starts as a copy of the 13 default steps — edit it from there.
      </p>
      <ErrorLine state={state} />
    </form>
  );
}
