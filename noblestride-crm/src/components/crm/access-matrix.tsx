"use client";

// access-matrix.tsx — in-org access matrix display (design spec §7.2).
// Static, read-only reference of who-can-do-what per org role, sourced
// directly from src/server/rbac/matrix.ts.

import { useState } from "react";
import { RBAC_ENTITIES, RBAC_MATRIX, type Perm } from "@/server/rbac/matrix";
import { label } from "@/lib/vocab";

const ROLES = ["Admin", "DealLead", "TeamMember"] as const;
type OrgRole = (typeof ROLES)[number];

const ENTITIES = RBAC_ENTITIES;
const PERMS: Perm[] = ["C", "R", "U", "D"];
type Grid = Record<string, Perm[]>;

const MATRIX: Record<OrgRole, Grid> = RBAC_MATRIX as unknown as Record<OrgRole, Grid>;

export function AccessMatrix() {
  const [role, setRole] = useState<OrgRole>("DealLead");

  const grid = MATRIX[role];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[var(--text-secondary)]">Organisation role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as OrgRole)}
          className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {label("OrgRole", r)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Create</th>
              <th className="px-4 py-3">Read</th>
              <th className="px-4 py-3">Update</th>
              <th className="px-4 py-3">Delete</th>
            </tr>
          </thead>
          <tbody>
            {ENTITIES.map((entity) => (
              <tr key={entity} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{entity}</td>
                {PERMS.map((perm) => {
                  const on = grid[entity]?.includes(perm);
                  return (
                    <td key={perm} className="px-4 py-2.5">
                      <span
                        aria-label={`${entity} ${perm} ${on ? "allowed" : "denied"}`}
                        title={`${entity} ${perm} ${on ? "allowed" : "denied"}`}
                        className={
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold " +
                          (on
                            ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
                            : "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]")
                        }
                      >
                        {on ? "✓" : "—"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
