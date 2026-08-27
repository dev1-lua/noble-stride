"use client";
// partner-access-panel.tsx — "Partner portal access" on the partner detail page
// (F5.6: "partners should log in to the portal for deal status"). The partner
// mirror of investors/[id]/account-panel.tsx. Every form posts to a server
// action that re-checks the REAL admin role; this component only decides which
// buttons to show, never authorizes anything itself.

import { useActionState } from "react";
import {
  invitePartnerContactAction,
  resendPartnerInviteAction,
  suspendPartnerAccountAction,
  reactivatePartnerAccountAction,
  partnerResetLinkAction,
  type PartnerAccessState,
} from "./partner-access-actions";

const buttonClass =
  "rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium " +
  "text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-60";

const inputClass =
  "w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-sm " +
  "text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]";

const labelClass = "text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide";

const STATUS_CHIP: Record<string, string> = {
  PENDING: "bg-[var(--t-tag-bg-amber)] text-[var(--t-tag-text-amber)]",
  ACTIVE: "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
  SUSPENDED: "bg-[var(--t-tag-bg-rose)] text-[var(--t-tag-text-rose)]",
};

const initialState: PartnerAccessState = {};

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

function Feedback({ state }: { state: PartnerAccessState }) {
  return (
    <>
      {state.error && <p className="mt-1 text-xs text-[var(--t-tag-text-rose)]">{state.error}</p>}
      {state.notice && (
        <p
          className="mt-1 text-xs text-[var(--text-secondary)]"
          data-testid={state.emailSent ? "partner-invite-emailed" : "partner-invite-not-emailed"}
        >
          {state.notice}
        </p>
      )}
      {/* The link is shown whenever one was minted: when mail failed it is the
          only way in, and when mail worked it still helps if it lands in spam. */}
      {(state.inviteUrl ?? state.resetLink) && (
        <code
          data-testid="partner-invite-link"
          className="mt-1 block max-w-md truncate rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[10px] text-[var(--text-secondary)]"
        >
          {state.inviteUrl ?? state.resetLink}
        </code>
      )}
      {state.resetLink && (
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {state.emailSent
            ? "Reset link emailed to the contact."
            : "Couldn't email the link — send it to the contact yourself."}
        </p>
      )}
    </>
  );
}

function SuspendForm({ partnerId, accountId }: { partnerId: string; accountId: string }) {
  const [state, submitAction, isPending] = useActionState(suspendPartnerAccountAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="partnerId" value={partnerId} />
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Suspending…" : "Suspend"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function ReactivateForm({ partnerId, accountId }: { partnerId: string; accountId: string }) {
  const [state, submitAction, isPending] = useActionState(reactivatePartnerAccountAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="partnerId" value={partnerId} />
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Reactivating…" : "Reactivate"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function ResetLinkForm({ partnerId, accountId }: { partnerId: string; accountId: string }) {
  const [state, submitAction, isPending] = useActionState(partnerResetLinkAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="partnerId" value={partnerId} />
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Emailing…" : "Email reset link"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function ResendForm({ partnerId, personId }: { partnerId: string; personId: string }) {
  const [state, submitAction, isPending] = useActionState(resendPartnerInviteAction, initialState);
  return (
    <form action={submitAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="partnerId" value={partnerId} />
      <input type="hidden" name="personId" value={personId} />
      <button type="submit" disabled={isPending} className={buttonClass}>
        {isPending ? "Sending…" : "Re-send invitation"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function InviteForm({
  partnerId,
  contacts,
}: {
  partnerId: string;
  contacts: PartnerInvitableContact[];
}) {
  const [state, submitAction, isPending] = useActionState(invitePartnerContactAction, initialState);
  return (
    <div className="space-y-3">
      <form action={submitAction} className="grid gap-3 sm:grid-cols-2" data-testid="partner-invite-form">
        <input type="hidden" name="partnerId" value={partnerId} />
        <div>
          <label htmlFor="pa-name" className={labelClass}>Full name *</label>
          <input id="pa-name" name="name" required className={`${inputClass} mt-1`} placeholder="e.g. Amina Yusuf" />
        </div>
        <div>
          <label htmlFor="pa-email" className={labelClass}>Work email *</label>
          <input id="pa-email" name="email" type="email" required className={`${inputClass} mt-1`} placeholder="name@firm.com" />
        </div>
        <div>
          <label htmlFor="pa-phone" className={labelClass}>Phone</label>
          <input id="pa-phone" name="phone" className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label htmlFor="pa-title" className={labelClass}>Job title</label>
          <input id="pa-title" name="jobTitle" className={`${inputClass} mt-1`} />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {isPending ? "Inviting…" : "Invite contact"}
          </button>
          <Feedback state={state} />
        </div>
      </form>

      {contacts.length > 0 && (
        <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Existing contacts without portal access
          </p>
          <ul className="mt-2 space-y-2">
            {contacts.map((c) => (
              <li key={c.personId} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-[var(--text-primary)]">
                  {c.name}
                  {c.email ? <span className="text-[var(--text-tertiary)]"> · {c.email}</span> : null}
                </span>
                {c.email ? (
                  <ResendForm partnerId={partnerId} personId={c.personId} />
                ) : (
                  <span className="text-xs text-[var(--text-tertiary)]">Add an email first</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface PartnerAccountRow {
  accountId: string;
  email: string;
  contactName: string;
  status: string;
  lastLogin: string;
  personId: string;
  signedIn: boolean;
}

export interface PartnerInvitableContact {
  personId: string;
  name: string;
  email: string | null;
}

function AccountRow({ partnerId, account }: { partnerId: string; account: PartnerAccountRow }) {
  return (
    <div className="space-y-3 border-b border-[var(--border-subtle)] py-3 last:border-0 last:pb-0">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className={labelClass}>Email</dt>
          <dd className="mt-1 text-sm text-[var(--text-primary)]">{account.email}</dd>
        </div>
        <div>
          <dt className={labelClass}>Contact</dt>
          <dd className="mt-1 text-sm text-[var(--text-primary)]">{account.contactName || "—"}</dd>
        </div>
        <div>
          <dt className={labelClass}>Status</dt>
          <dd className="mt-1"><StatusChip status={account.status} /></dd>
        </div>
        <div>
          <dt className={labelClass}>Last login</dt>
          <dd className="mt-1 text-sm text-[var(--text-primary)]">{account.lastLogin}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-start gap-2">
        {account.status === "SUSPENDED" ? (
          <ReactivateForm partnerId={partnerId} accountId={account.accountId} />
        ) : (
          <SuspendForm partnerId={partnerId} accountId={account.accountId} />
        )}
        {account.signedIn ? (
          <ResetLinkForm partnerId={partnerId} accountId={account.accountId} />
        ) : (
          // Never signed in: a fresh invitation is the right affordance, and
          // resendPartnerInvite refuses once they have logged in.
          <ResendForm partnerId={partnerId} personId={account.personId} />
        )}
      </div>
    </div>
  );
}

export function PartnerAccessPanel({
  partnerId,
  accounts,
  invitableContacts,
}: {
  partnerId: string;
  accounts: PartnerAccountRow[];
  invitableContacts: PartnerInvitableContact[];
}) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
      <div className="border-b border-[var(--border-subtle)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Partner portal access</h2>
        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
          Contacts you invite can sign in and follow the status of the deals this partner referred.
          The portal is read-only — nothing they see is editable.
        </p>
      </div>
      <div className="space-y-4 px-4 py-4">
        {accounts.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No portal accounts for this partner yet.</p>
        ) : (
          <div>
            {accounts.map((a) => (
              <AccountRow key={a.accountId} partnerId={partnerId} account={a} />
            ))}
          </div>
        )}
        <InviteForm partnerId={partnerId} contacts={invitableContacts} />
      </div>
    </div>
  );
}
