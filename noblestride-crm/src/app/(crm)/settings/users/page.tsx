// settings/users/page.tsx — Admin-only user management (real-auth spec §10).
// Pending-approval queue + all-accounts table. Guarded server-side against the
// REAL role (never the impersonation lens) — see requireRealAdmin in actions.ts
// for why this check is duplicated here rather than shared.

import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/server/auth/current";
import { prisma } from "@/lib/db";
import { label } from "@/lib/vocab";
import { UserActionsClient } from "./user-actions-client";
import { AccountsTable, type AccountRow } from "./accounts-table";

// StatusChip is duplicated in accounts-table.tsx (client component) rather
// than imported from here — see that file's header comment for why.

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
  // Pending onboarding approvals include ALL kinds (internal + investor
  // sign-ups) — the product owner still wants investor-contact onboarding
  // approved from this page. Only the active/all-accounts log below is
  // restricted to internal accounts (investor accounts are managed day-to-day
  // on the Investors page — see auth-enhancements plan, Task 9).
  const pending = accounts.filter((a) => a.status === "PENDING");
  const rest = accounts.filter((a) => a.status !== "PENDING" && a.kind === "INTERNAL");

  function displayNameFor(a: (typeof accounts)[number]): string {
    if (a.kind === "INTERNAL") return a.displayName ?? a.user?.name ?? "—";
    return a.person?.investor?.name ?? (a.person ? `${a.person.firstName} ${a.person.lastName ?? ""}`.trim() : "—");
  }

  // Serialize to primitives only (no Date/Prisma objects) before crossing
  // into the client component.
  const accountRows: AccountRow[] = rest.map((a) => ({
    id: a.id,
    email: a.email,
    kind: a.kind,
    status: a.status,
    role: a.user?.role ?? null,
    roleLabel: label("OrgRole", a.user?.role ?? "TeamMember"),
    lastLogin: formatDate(a.lastLoginAt),
  }));

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
        <div className="px-4 py-3">
          <AccountsTable rows={accountRows} />
        </div>
      </div>
    </div>
  );
}
