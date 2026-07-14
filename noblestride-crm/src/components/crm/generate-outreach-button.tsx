"use client";

// generate-outreach-button.tsx — Client component: single-form action button
// that requests investor-outreach drafts from the investor agent for a deal.
// RBAC is re-checked server-side in the action; this component only exposes
// the trigger and renders the resulting ok/error state inline.

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { requestOutreachDraftsAction, type OutreachRequestState } from "@/app/(crm)/transactions/[id]/outreach-actions";

const initial: OutreachRequestState = {};

export function GenerateOutreachButton({ transactionId }: { transactionId: string }) {
  const [state, action, pending] = useActionState(requestOutreachDraftsAction, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="transactionId" value={transactionId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Requesting…" : "Generate investor outreach"}
      </Button>
      {state.ok && <span className="text-xs text-[var(--text-tertiary)]">Drafting started — check Outreach.</span>}
      {state.error && <span className="text-xs text-red-500">{state.error}</span>}
    </form>
  );
}
