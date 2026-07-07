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
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        This matrix drives the in-org view lens (demo — not backed by real login). Use the
        viewpoint switcher in the top bar to see the CRM as each role. In-session toggles below
        are illustrative and not persisted.
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-700">Organisation role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as OrgRole)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {label("OrgRole", r)}
            </option>
          ))}
        </select>
        <button
          onClick={() => setGrids(JSON.parse(JSON.stringify(DEFAULTS)))}
          className="ml-auto rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          Reset to defaults
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Create</th>
              <th className="px-4 py-3">Read</th>
              <th className="px-4 py-3">Update</th>
              <th className="px-4 py-3">Delete</th>
            </tr>
          </thead>
          <tbody>
            {ENTITIES.map((entity) => (
              <tr key={entity} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-zinc-900">{entity}</td>
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
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200")
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
