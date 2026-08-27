"use client";
// account-panel.tsx — "Account access" panel for the investor detail page
// (auth-enhancements plan, Task 9). Investor login accounts are managed here
// instead of /settings/users. Every form posts to a server action that
// re-checks the REAL admin role (see account-actions.ts requireRealAdmin) —
// this component only decides which buttons to show, never authorizes
// anything itself.

import { useActionState } from "react";
import {
  suspendInvestorAccountAction,
  reactivateInvestorAccountAction,
  generateInvestorResetLinkAction,
  changeInvestorAccountEmailAction,
  type UserActionState,
} from "./account-actions";

const buttonClass =
  "rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium " +
  "text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-60";

const STATUS_CHIP: Record<string, string> = {
  PENDING: "bg-[var(--t-tag-bg-amber)] text-[var(--t-tag-text-amber)]",
  ACTIVE: "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
  SUSPENDED: "bg-[var(--t-tag-bg-rose)] text-[var(--t-tag-text-rose)]",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_CHIP[status] ?? "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]"
      }`}
    >
      {status}
    </span>
  );
}

const initialState: UserActionState = {};

function ErrorLine({ state }: { state: UserActionState }) {
  if (!state.error) return null;
  return <p className="mt-1 text-xs text-[var(--t-tag-text-rose)]">{state.error}</p>;
}

function ResetLinkBlock({ state }: { state: UserActionState }) {
  if (!state.resetLink) return null;
  return (
    <>
      {/* F3.5: the link is emailed now. Say which happened, and keep the link
          visible either way so an admin can pass it on out of band. */}
      <p
        className="mt-1 text-xs text-[var(--text-secondary)]"
        data-testid={state.emailSent ? "reset-link-emailed" : "reset-link-not-emailed"}
      >
        {state.emailSent
          ? "Reset link emailed to the member."
          : "Couldn't email the link — send it to the member yourself."}
      </p>
      <code className="mt-1 block max-w-xs truncate rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
        {state.resetLink}
      </code>
    </>
  );
}

/**
 * F3.6 (image11/12): move the address this person signs in with. Applies
 * immediately — an admin is doing this for someone they have already
 * identified — and ends every session on the account.
 */
function ChangeEmailForm({
  investorId,
  accountId,
  currentEmail,
}: {
  investorId: string;
  accountId: string;
  currentEmail: string;
}) {
  const [state, submitAction, isPending] = useActionState(changeInvestorAccountEmailAction, initialState);
  return (
    <form action={submitAction} className="flex flex-col items-start gap-1" data-testid="change-email-form">
      <input type="hidden" name="investorId" value={investorId} />
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="email"
          type="email"
          required
          defaultValue=""
          placeholder={currentEmail}
          aria-label="New sign-in email"
          className="w-64 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
        />
        <button type="submit" disabled={isPending} className={buttonClass}>
          {isPending ? "Changing…" : "Change email"}
        </button>
      </div>
      <ErrorLine state={state} />
      {state.notice && (
        <p className="mt-1 text-xs text-[var(--text-secondary)]" data-testid="email-changed">
          {state.notice}
        </p>
      )}
      <p className="text-[10px] text-[var(--text-tertiary)]">
        Signs the member out everywhere and notifies both addresses.
      </p>
    </form>
  );
}

function SuspendForm({ investorId, accountId }: { investorId: string; accountId: string }) {
  const [state, submitAction, isPending] = useActionState(suspendInvestorAccountAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="investorId" value={investorId} />
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Suspending…" : "Suspend"}
      </button>
      <ErrorLine state={state} />
    </form>
  );
}

function ReactivateForm({ investorId, accountId }: { investorId: string; accountId: string }) {
  const [state, submitAction, isPending] = useActionState(reactivateInvestorAccountAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="investorId" value={investorId} />
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Reactivating…" : "Reactivate"}
      </button>
      <ErrorLine state={state} />
    </form>
  );
}

function ResetLinkForm({ investorId, accountId }: { investorId: string; accountId: string }) {
  const [state, submitAction, isPending] = useActionState(generateInvestorResetLinkAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="investorId" value={investorId} />
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Emailing…" : "Email reset link"}
      </button>
      <ErrorLine state={state} />
      <ResetLinkBlock state={state} />
    </form>
  );
}

export interface InvestorAccountSummary {
  id: string;
  email: string;
  status: string;
  lastLogin: string;
  contactName: string | null;
}

// Panel is only ever rendered for a real admin (see page.tsx) — so once here,
// management controls always show, except for PENDING accounts: approval for
// those happens in the Users pending queue, not here, to avoid a second path
// that can activate an account without going through that review.
function AccountRow({ investorId, account }: { investorId: string; account: InvestorAccountSummary }) {
  return (
    <div className="space-y-3 border-b border-[var(--border-subtle)] py-3 last:border-0 last:pb-0">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Email</dt>
          <dd className="mt-1 text-sm text-[var(--text-primary)]">{account.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Contact</dt>
          <dd className="mt-1 text-sm text-[var(--text-primary)]">{account.contactName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Status</dt>
          <dd className="mt-1">
            <StatusChip status={account.status} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Last login</dt>
          <dd className="mt-1 text-sm text-[var(--text-primary)]">{account.lastLogin}</dd>
        </div>
      </dl>

      {account.status === "PENDING" ? (
        <p className="text-xs text-[var(--text-tertiary)]">
          Awaiting approval in User Management.
        </p>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          {account.status === "SUSPENDED" ? (
            <ReactivateForm investorId={investorId} accountId={account.id} />
          ) : (
            <SuspendForm investorId={investorId} accountId={account.id} />
          )}
          <ResetLinkForm investorId={investorId} accountId={account.id} />
        </div>
      )}

      {account.status !== "PENDING" && (
        <ChangeEmailForm investorId={investorId} accountId={account.id} currentEmail={account.email} />
      )}
    </div>
  );
}

export function AccountPanel({
  investorId,
  accounts,
}: {
  investorId: string;
  accounts: InvestorAccountSummary[];
}) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
      <div className="border-b border-[var(--border-subtle)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Account access</h2>
      </div>
      <div className="px-4 py-4">
        {accounts.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No login account for this investor.</p>
        ) : (
          <div>
            {accounts.map((account) => (
              <AccountRow key={account.id} investorId={investorId} account={account} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
