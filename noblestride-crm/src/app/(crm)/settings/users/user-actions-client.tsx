"use client";
// user-actions-client.tsx — per-row action buttons for /settings/users
// (real-auth spec §10). Every form posts to a server action that re-checks
// the REAL admin role (see actions.ts requireRealAdmin) — this component
// only decides which buttons to show, never authorizes anything itself.

import { useActionState } from "react";
import type { AccountKind, AccountStatus, OrgRole } from "@prisma/client";
import {
  approveInternalAction,
  approveInvestorAccountAction,
  rejectAccountAction,
  suspendAccountAction,
  reactivateAccountAction,
  changeRoleAction,
  generateResetLinkAction,
  type UserActionState,
} from "./actions";

const ROLES: OrgRole[] = ["Admin", "DealLead", "TeamMember"];

const buttonClass =
  "rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium " +
  "text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-60";

const selectClass =
  "rounded border border-[var(--border-strong)] bg-[var(--bg-primary)] px-2 py-1.5 text-xs text-[var(--text-primary)]";

export interface AccountRow {
  id: string;
  email: string;
  kind: AccountKind;
  status: AccountStatus;
  role: OrgRole | null;
}

const initialState: UserActionState = {};

function ErrorLine({ state }: { state: UserActionState }) {
  if (!state.error) return null;
  return <p className="mt-1 text-xs text-[var(--t-tag-text-rose)]">{state.error}</p>;
}

function ResetLinkBlock({ state }: { state: UserActionState }) {
  if (!state.resetLink) return null;
  return (
    <code className="mt-1 block max-w-xs truncate rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
      {state.resetLink}
    </code>
  );
}

function ApproveInternalForm({ accountId }: { accountId: string }) {
  const [state, submitAction, isPending] = useActionState(approveInternalAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <div className="inline-flex items-center gap-1.5">
        <input type="hidden" name="accountId" value={accountId} />
        <select name="role" defaultValue="TeamMember" className={selectClass}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit" disabled={isPending} className={buttonClass}>
          {isPending ? "Approving…" : "Approve"}
        </button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

function ApproveInvestorForm({ accountId }: { accountId: string }) {
  const [state, submitAction, isPending] = useActionState(approveInvestorAccountAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Approving…" : "Approve investor"}
      </button>
      <ErrorLine state={state} />
    </form>
  );
}

function RejectForm({ accountId }: { accountId: string }) {
  const [state, submitAction, isPending] = useActionState(rejectAccountAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Rejecting…" : "Reject"}
      </button>
      <ErrorLine state={state} />
    </form>
  );
}

function SuspendForm({ accountId }: { accountId: string }) {
  const [state, submitAction, isPending] = useActionState(suspendAccountAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Suspending…" : "Suspend"}
      </button>
      <ErrorLine state={state} />
    </form>
  );
}

function ReactivateForm({ accountId }: { accountId: string }) {
  const [state, submitAction, isPending] = useActionState(reactivateAccountAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Reactivating…" : "Reactivate"}
      </button>
      <ErrorLine state={state} />
    </form>
  );
}

function ChangeRoleForm({ accountId, currentRole }: { accountId: string; currentRole: OrgRole | null }) {
  const [state, submitAction, isPending] = useActionState(changeRoleAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <div className="inline-flex items-center gap-1.5">
        <input type="hidden" name="accountId" value={accountId} />
        <select name="role" defaultValue={currentRole ?? "TeamMember"} className={selectClass}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit" disabled={isPending} className={buttonClass}>
          {isPending ? "Saving…" : "Change role"}
        </button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

function ResetLinkForm({ accountId }: { accountId: string }) {
  const [state, submitAction, isPending] = useActionState(generateResetLinkAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Generating…" : "Reset link"}
      </button>
      <ErrorLine state={state} />
      <ResetLinkBlock state={state} />
    </form>
  );
}

export function UserActionsClient({ account, mode }: { account: AccountRow; mode: "pending" | "active" }) {
  if (mode === "pending") {
    return (
      <div className="flex flex-wrap items-start gap-2">
        {account.kind === "INTERNAL" ? (
          <ApproveInternalForm accountId={account.id} />
        ) : (
          <ApproveInvestorForm accountId={account.id} />
        )}
        <RejectForm accountId={account.id} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      {account.kind === "INTERNAL" && <ChangeRoleForm accountId={account.id} currentRole={account.role} />}
      {account.status === "SUSPENDED" ? (
        <ReactivateForm accountId={account.id} />
      ) : (
        <SuspendForm accountId={account.id} />
      )}
      <ResetLinkForm accountId={account.id} />
    </div>
  );
}
