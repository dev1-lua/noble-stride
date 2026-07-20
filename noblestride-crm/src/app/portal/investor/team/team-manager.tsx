"use client";
// Team page interactions: invite form + per-row link/revoke/remove.
// The share link appears in a one-time panel after generation — it is the
// only place the raw token ever surfaces, so the copy affordance lives here.

import { useActionState, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  inviteTeamMemberAction,
  memberLinkAction,
  removeMemberAction,
  revokeInviteAction,
  type TeamActionState,
} from "./actions";
import type { MemberBadge } from "@/lib/team-status";

export interface TeamRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  isPrimaryContact: boolean;
  isSelf: boolean;
  badge: MemberBadge;
}

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

const BADGE_STYLES: Record<MemberBadge, string> = {
  Active: "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
  Invited: "bg-[var(--t-tag-bg-amber)] text-[var(--t-tag-text-amber)]",
  Suspended: "bg-[var(--t-tag-bg-rose)] text-[var(--t-tag-text-rose)]",
  "No account": "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
};

function ShareLinkPanel({ url, email }: { url: string; email?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--accent)] bg-[var(--t-tag-bg-emerald)] p-4">
      <p className="text-sm font-medium text-[var(--t-tag-text-emerald)]">
        Share this link{email ? ` with ${email}` : ""}. It&apos;s personal to their email and
        expires in 7 days.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input readOnly value={url} className={`${inputClass} font-mono text-xs`} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

export default function TeamManager({ rows }: { rows: TeamRow[] }) {
  const [inviteState, inviteAction, invitePending] = useActionState<TeamActionState, FormData>(
    inviteTeamMemberAction,
    {},
  );
  const [linkState, linkAction, linkPending] = useActionState<TeamActionState, FormData>(
    memberLinkAction,
    {},
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Team</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Give colleagues their own sign-in. They&apos;ll see exactly what you see — deals, teasers,
          documents, and engagement progress.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Invite a team member
          </h2>
        </CardHeader>
        <CardBody>
          {inviteState.error && (
            <div className="mb-3 rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-3 text-sm text-[var(--t-tag-text-rose)]">
              {inviteState.error}
            </div>
          )}
          {inviteState.inviteUrl && (
            <div className="mb-3">
              <ShareLinkPanel url={inviteState.inviteUrl} email={inviteState.invitedEmail} />
            </div>
          )}
          <form action={inviteAction} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tm-name" className={labelClass}>Full name *</label>
              <input id="tm-name" name="name" required className={`${inputClass} mt-1`} placeholder="e.g. Priya Patel" />
            </div>
            <div>
              <label htmlFor="tm-email" className={labelClass}>Work email *</label>
              <input id="tm-email" name="email" type="email" required className={`${inputClass} mt-1`} placeholder="name@yourfund.com" />
            </div>
            <div>
              <label htmlFor="tm-phone" className={labelClass}>Phone</label>
              <input id="tm-phone" name="phone" type="tel" className={`${inputClass} mt-1`} placeholder="+254 700 000000" />
            </div>
            <div>
              <label htmlFor="tm-title" className={labelClass}>Job title</label>
              <input id="tm-title" name="jobTitle" className={`${inputClass} mt-1`} placeholder="e.g. Investment Analyst" />
            </div>
            <div className="sm:col-span-2 flex justify-end border-t border-[var(--border-subtle)] pt-4">
              <button
                type="submit"
                disabled={invitePending}
                className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {invitePending ? "Creating link…" : "Create invite link"}
              </button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            People at your organization
          </h2>
        </CardHeader>
        <CardBody>
          {linkState.error && (
            <div className="mb-3 rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-3 text-sm text-[var(--t-tag-text-rose)]">
              {linkState.error}
            </div>
          )}
          {linkState.inviteUrl && (
            <div className="mb-3">
              <ShareLinkPanel url={linkState.inviteUrl} />
            </div>
          )}
          <ul className="divide-y divide-[var(--border-subtle)]">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {r.name}
                    {r.isSelf && <span className="ml-2 text-xs text-[var(--text-tertiary)]">(you)</span>}
                    {r.isPrimaryContact && (
                      <span className="ml-2 rounded-full bg-[var(--t-tag-bg-sky)] px-2 py-0.5 text-xs font-medium text-[var(--t-tag-text-sky)]">
                        Primary contact
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {[r.jobTitle, r.email, r.phone].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_STYLES[r.badge]}`}>
                    {r.badge}
                  </span>
                  {(r.badge === "Invited" || r.badge === "No account") && r.email && (
                    <form action={linkAction}>
                      <input type="hidden" name="personId" value={r.id} />
                      <button
                        type="submit"
                        disabled={linkPending}
                        className="rounded border border-[var(--border-subtle)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-60"
                      >
                        {r.badge === "Invited" ? "New link" : "Invite"}
                      </button>
                    </form>
                  )}
                  {r.badge === "Invited" && (
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="personId" value={r.id} />
                      <button type="submit" className="rounded border border-[var(--border-subtle)] px-3 py-1 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]">
                        Revoke
                      </button>
                    </form>
                  )}
                  {!r.isSelf && r.badge === "Active" && (
                    <form action={removeMemberAction}>
                      <input type="hidden" name="personId" value={r.id} />
                      <button type="submit" className="rounded border border-[var(--t-tag-bg-rose)] px-3 py-1 text-xs font-medium text-[var(--t-tag-text-rose)] hover:bg-[var(--t-tag-bg-rose)]">
                        Remove
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
