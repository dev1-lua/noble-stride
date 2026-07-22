"use client";

// deal-assign-select.tsx — inline lead/assist editors for the /deals table.
// Mirrors restage-select.tsx: a client control that fires a urql mutation on
// change, applies the change optimistically, rolls back on error, then
// router.refresh()es so the RSC re-queries. The thin assign*/set* mutations
// take just id + user id(s) (no create-shaped input), and the update services
// fire the "you were assigned" bell notification.

import { useState } from "react";
import { useMutation } from "urql";
import type { CombinedError } from "urql";
import { useRouter } from "next/navigation";
import { Select, MultiSelect } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

type DealKind = "mandate" | "transaction" | "advisory";

// ─── Lead mutations (one per kind — transaction's lead field is `ownerId`) ────
const ASSIGN_LEAD: Record<DealKind, string> = {
  mandate: `mutation AssignMandateLead($id: ID!, $leadId: ID!) { assignMandateLead(id: $id, leadId: $leadId) { id } }`,
  advisory: `mutation AssignAdvisoryLead($id: ID!, $leadId: ID!) { assignAdvisoryLead(id: $id, leadId: $leadId) { id } }`,
  transaction: `mutation AssignTransactionOwner($id: ID!, $ownerId: ID!) { assignTransactionOwner(id: $id, ownerId: $ownerId) { id } }`,
};

const SET_ASSISTS: Record<DealKind, string> = {
  mandate: `mutation SetMandateAssists($id: ID!, $assistIds: [ID!]!) { setMandateAssists(id: $id, assistIds: $assistIds) { id } }`,
  advisory: `mutation SetAdvisoryAssists($id: ID!, $assistIds: [ID!]!) { setAdvisoryAssists(id: $id, assistIds: $assistIds) { id } }`,
  transaction: `mutation SetTransactionAssists($id: ID!, $assistIds: [ID!]!) { setTransactionAssists(id: $id, assistIds: $assistIds) { id } }`,
};

function errorMessage(err: CombinedError): string {
  const raw = err.graphQLErrors?.[0]?.message ?? err.message;
  return (raw.startsWith("[GraphQL] ") ? raw.slice("[GraphQL] ".length) : raw) || "Update failed — please try again.";
}

// ─── DealLeadSelect ───────────────────────────────────────────────────────────

export function DealLeadSelect({ kind, id, value, users }: {
  kind: DealKind;
  id: string;
  value: string | null;
  users: SelectOption[];
}) {
  const router = useRouter();
  const [leadId, setLeadId] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, exec] = useMutation(ASSIGN_LEAD[kind]);

  async function handleChange(next: string) {
    if (!next || next === leadId || pending) return;
    const prev = leadId;
    setLeadId(next);
    setError(null);
    setPending(true);
    // transaction's lead argument is `ownerId`; mandate/advisory use `leadId`.
    const vars = kind === "transaction" ? { id, ownerId: next } : { id, leadId: next };
    const result = await exec(vars);
    setPending(false);
    if (result.error) {
      setLeadId(prev);
      setError(errorMessage(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <div className="min-w-[9rem] space-y-1">
      <Select
        options={users}
        value={leadId}
        onChange={handleChange}
        placeholder="Set lead…"
        disabled={pending}
        aria-label="Deal lead"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

// ─── DealAssistSelect ─────────────────────────────────────────────────────────

export function DealAssistSelect({ kind, id, value, users }: {
  kind: DealKind;
  id: string;
  value: string[];
  users: SelectOption[];
}) {
  const router = useRouter();
  const [assistIds, setAssistIds] = useState<string[]>(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, exec] = useMutation(SET_ASSISTS[kind]);

  async function handleChange(next: string[]) {
    if (pending) return;
    const prev = assistIds;
    setAssistIds(next);
    setError(null);
    setPending(true);
    const result = await exec({ id, assistIds: next });
    setPending(false);
    if (result.error) {
      setAssistIds(prev);
      setError(errorMessage(result.error));
      return;
    }
    router.refresh();
  }

  return (
    <div className="min-w-[10rem] space-y-1">
      <MultiSelect
        options={users}
        selected={assistIds}
        onChange={handleChange}
        placeholder="Set assist…"
        aria-label="Deal assist"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
