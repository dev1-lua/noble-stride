// settings/users/page.tsx — Admin-only user management (real-auth spec §10).
// Pending-approval queue + all-accounts table. Guarded server-side against the
// REAL role (never the impersonation lens) — see requireRealAdmin in actions.ts
// for why this check is duplicated here rather than shared.

import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/server/auth/current";
import { prisma } from "@/lib/db";
import { label } from "@/lib/vocab";
import { UserActionsClient } from "./user-actions-client";

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

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export default async function UsersSettingsPage() {
  const auth = await getCurrentAuth();
  if (!auth || auth.account.kind !== "INTERNAL" || auth.user?.role !== "Admin" || !auth.user?.isActive) {
    redirect("/dashboard");
  }

  const accounts = await prisma.authAccount.findMany({
    include: { user: true, person: { include: { investor: { select: { id: true, name: true, onboardingStatus: true } } } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const pending = accounts.filter((a) => a.status === "PENDING");
  const rest = accounts.filter((a) => a.status !== "PENDING");

  function displayNameFor(a: (typeof accounts)[number]): string {
    if (a.kind === "INTERNAL") return a.displayName ?? a.user?.name ?? "—";
    return a.person?.investor?.name ?? (a.person ? `${a.person.firstName} ${a.person.lastName ?? ""}`.trim() : "—");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">User Management</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Approve pending sign-ups, manage roles, and suspend or reactivate accounts.
        </p>
      </div>

      {/* Pending approval */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Pending approval {pending.length > 0 && <span className="text-[var(--text-tertiary)]">({pending.length})</span>}
          </h2>
        </div>
        {pending.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--text-tertiary)]">No accounts awaiting approval.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Kind</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-4 py-3 text-[var(--text-primary)]">{a.email}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{a.kind}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{displayNameFor(a)}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(a.createdAt)}</td>
                    <td className="px-4 py-3">
                      <UserActionsClient
                        account={{ id: a.id, email: a.email, kind: a.kind, status: a.status, role: a.user?.role ?? null }}
                        mode="pending"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All accounts */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">All accounts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((a) => (
                <tr key={a.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-3 text-[var(--text-primary)]">{a.email}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{a.kind}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {a.kind === "INTERNAL" ? label("OrgRole", a.user?.role ?? "TeamMember") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(a.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <UserActionsClient
                      account={{ id: a.id, email: a.email, kind: a.kind, status: a.status, role: a.user?.role ?? null }}
                      mode="active"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
