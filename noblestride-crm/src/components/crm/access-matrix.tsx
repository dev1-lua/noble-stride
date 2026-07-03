"use client";

// access-matrix.tsx — display-only in-org access matrix (design spec §7).
// Cells are toggleable in-session for illustration; nothing is persisted or enforced.

import { useState } from "react";

const ROLES = ["Admin", "Deal Lead", "Team Member"] as const;
type OrgRole = (typeof ROLES)[number];

const ENTITIES = [
  "Investors",
  "Clients",
  "Mandates",
  "Transactions",
  "Engagements",
  "Partners",
  "Documents",
  "Service Providers",
  "Tasks",
] as const;

type Perm = "C" | "R" | "U" | "D";
const PERMS: Perm[] = ["C", "R", "U", "D"];
type Grid = Record<string, Perm[]>;

// Defaults per spec §7: Admin full CRUD; Deal Lead CRUD own deals + read all;
// Team Member read all, update assigned work.
const DEFAULTS: Record<OrgRole, Grid> = {
  Admin: Object.fromEntries(ENTITIES.map((e) => [e, ["C", "R", "U", "D"] as Perm[]])),
  "Deal Lead": {
    Investors: ["C", "R", "U"],
    Clients: ["C", "R", "U"],
    Mandates: ["C", "R", "U"],
    Transactions: ["C", "R", "U"],
    Engagements: ["C", "R", "U"],
    Partners: ["R"],
    Documents: ["C", "R", "U"],
    "Service Providers": ["R"],
    Tasks: ["C", "R", "U"],
  },
  "Team Member": {
    Investors: ["R"],
    Clients: ["R"],
    Mandates: ["R"],
    Transactions: ["R"],
    Engagements: ["R", "U"],
    Partners: ["R"],
    Documents: ["R"],
    "Service Providers": ["R"],
    Tasks: ["R", "U"],
  },
};

export function AccessMatrix() {
  const [role, setRole] = useState<OrgRole>("Deal Lead");
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
        Illustrative only — this matrix shows the intended in-organisation access model. Changes
        here are not saved and nothing is enforced yet.
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-700">Organisation role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as OrgRole)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm"
        >
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
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
