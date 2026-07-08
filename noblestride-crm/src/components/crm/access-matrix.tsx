"use client";

// access-matrix.tsx — in-org access matrix display (design spec §7.2).
// The grid comes from src/server/rbac/matrix.ts — the SAME table that drives
// the in-org view lens. Cells are toggleable in-session for illustration only;
// toggles are not persisted and do not affect the lens.

import { useState } from "react";
import { RBAC_ENTITIES, RBAC_MATRIX, type Perm } from "@/server/rbac/matrix";
import { label } from "@/lib/vocab";

const ROLES = ["Admin", "DealLead", "TeamMember"] as const;
type OrgRole = (typeof ROLES)[number];

const ENTITIES = RBAC_ENTITIES;
const PERMS: Perm[] = ["C", "R", "U", "D"];
type Grid = Record<string, Perm[]>;

const DEFAULTS: Record<OrgRole, Grid> = RBAC_MATRIX as unknown as Record<OrgRole, Grid>;

export function AccessMatrix() {
  const [role, setRole] = useState<OrgRole>("DealLead");
  const [grids, setGrids] = useState<Record<OrgRole, Grid>>(() =>
    JSON.parse(JSON.stringify(DEFAULTS)),
  );

  const grid = grids[role];

  function toggle(entity: string, perm: Perm) {
    setGrids((prev) => {
      const next = { ...prev, [role]: { ...prev[role] } };
      const cell = new Set(next[role][entity]);
      if (cell.has(perm)) cell.delete(perm);
      else cell.add(perm);
      next[role][entity] = PERMS.filter((p) => cell.has(p));
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--t-tag-bg-amber)] bg-[var(--t-tag-bg-amber)] px-4 py-3 text-sm text-[var(--t-tag-text-amber)]">
        This matrix drives the in-org view lens (demo — not backed by real login). Use the
        viewpoint switcher in the top bar to see the CRM as each role. In-session toggles below
        are illustrative and not persisted.
      </div>

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
        <button
          onClick={() => setGrids(JSON.parse(JSON.stringify(DEFAULTS)))}
          className="ml-auto rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
        >
          Reset to defaults
        </button>
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
                      <button
                        onClick={() => toggle(entity, perm)}
                        aria-label={`${entity} ${perm} ${on ? "allowed" : "denied"}`}
                        className={
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors " +
                          (on
                            ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)] hover:opacity-80"
                            : "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)] hover:opacity-80")
                        }
                      >
                        {on ? "✓" : "—"}
                      </button>
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
