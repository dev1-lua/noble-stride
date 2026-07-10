"use client";
// accounts-table.tsx — "All accounts" table for /settings/users (real-auth
// spec §10 + auth-enhancements Point 2/3). Client wrapper adding search +
// filters via <TableSearch> around the existing table markup. Rows are
// pre-serialized (primitives only) by the server page — see AccountRow below.
//
// StatusChip is duplicated here (rather than imported from the server
// page.tsx) so this client module never pulls page.tsx's server-only imports
// (prisma, getCurrentAuth) into the client bundle.

import { options } from "@/lib/vocab";
import { TableSearch, type TableFilter } from "@/components/crm/table-search";
import { UserActionsClient, type AccountRow as UserActionsAccountRow } from "./user-actions-client";

export interface AccountRow {
  id: string;
  email: string;
  kind: UserActionsAccountRow["kind"];
  status: UserActionsAccountRow["status"];
  role: UserActionsAccountRow["role"];
  roleLabel: string;
  lastLogin: string;
}

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

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
];

const filters: TableFilter<AccountRow>[] = [
  { key: "role", label: "Role", options: options("OrgRole"), get: (row) => row.role ?? "" },
  { key: "status", label: "Status", options: STATUS_OPTIONS, get: (row) => row.status },
];

export function AccountsTable({ rows }: { rows: AccountRow[] }) {
  return (
    <TableSearch
      rows={rows}
      searchText={(row) => [row.email]}
      filters={filters}
      searchPlaceholder="Search by email…"
      emptyLabel="No accounts on record."
    >
      {(filtered) => (
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
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-3 text-[var(--text-primary)]">{row.email}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{row.kind}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{row.roleLabel}</td>
                  <td className="px-4 py-3">
                    <StatusChip status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{row.lastLogin}</td>
                  <td className="px-4 py-3">
                    <UserActionsClient
                      account={{ id: row.id, email: row.email, kind: row.kind, status: row.status, role: row.role }}
                      mode="active"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableSearch>
  );
}
