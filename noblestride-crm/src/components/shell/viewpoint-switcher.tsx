"use client";

// viewpoint-switcher.tsx — demo "view as" control (design spec §6).
// Admin / Investor / Partner + record picker; navigates through /api/viewpoint
// which sets the viewpoint cookie and lands on the right surface.

import { useState } from "react";
import { Eye } from "lucide-react";

export interface ViewpointOption {
  id: string;
  name: string;
}

export function ViewpointSwitcher({
  investors,
  partners,
}: {
  investors: ViewpointOption[];
  partners: ViewpointOption[];
}) {
  const [role, setRole] = useState<"admin" | "investor" | "partner">("admin");
  const records = role === "investor" ? investors : role === "partner" ? partners : [];

  function go(nextRole: string, recordId?: string) {
    const params = new URLSearchParams({ role: nextRole });
    if (recordId) params.set("recordId", recordId);
    window.location.href = `/api/viewpoint?${params.toString()}`;
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
      <Eye className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
      <select
        value={role}
        onChange={(e) => {
          const next = e.target.value as typeof role;
          setRole(next);
          if (next === "admin") go("admin");
        }}
        className="bg-transparent text-xs font-medium text-zinc-600 focus:outline-none"
        aria-label="View CRM as role"
      >
        <option value="admin">Admin</option>
        <option value="investor">Investor</option>
        <option value="partner">Partner</option>
      </select>
      {role !== "admin" && (
        <select
          defaultValue=""
          onChange={(e) => e.target.value && go(role, e.target.value)}
          className="max-w-36 bg-transparent text-xs text-zinc-600 focus:outline-none"
          aria-label={`Choose ${role} to view as`}
        >
          <option value="" disabled>
            Choose {role}…
          </option>
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
