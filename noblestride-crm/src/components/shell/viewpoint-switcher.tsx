"use client";

// viewpoint-switcher.tsx — demo "view as" control (design spec §6 + §7.2).
// Admin / Investor / Partner + record picker; when Admin is selected an
// org-role lens (Admin / Deal Lead / Team Member) plus a user picker scope the
// internal CRM. Navigates through /api/viewpoint which sets the viewpoint
// cookie and lands on the right surface.

import { useState } from "react";
import { Eye } from "lucide-react";

export interface ViewpointOption {
  id: string;
  name: string;
}

const ORG_ROLES = [
  { value: "Admin", label: "Admin" },
  { value: "DealLead", label: "Deal Lead" },
  { value: "TeamMember", label: "Team Member" },
] as const;

export function ViewpointSwitcher({
  investors,
  partners,
  users = [],
  activeOrgRole = "Admin",
  activeUserId,
}: {
  investors: ViewpointOption[];
  partners: ViewpointOption[];
  users?: ViewpointOption[];
  activeOrgRole?: string;
  activeUserId?: string;
}) {
  const [role, setRole] = useState<"admin" | "investor" | "partner">("admin");
  const [orgRole, setOrgRole] = useState<string>(activeOrgRole);
  const records = role === "investor" ? investors : role === "partner" ? partners : [];

  function go(nextRole: string, recordId?: string, nextOrgRole?: string, userId?: string) {
    const params = new URLSearchParams({ role: nextRole });
    if (recordId) params.set("recordId", recordId);
    if (nextOrgRole && nextOrgRole !== "Admin") params.set("orgRole", nextOrgRole);
    if (userId) params.set("userId", userId);
    window.location.href = `/api/viewpoint?${params.toString()}`;
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5">
      <Eye className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-tertiary)]" />
      <select
        value={role}
        onChange={(e) => {
          const next = e.target.value as typeof role;
          setRole(next);
          setOrgRole("Admin");
          if (next === "admin") go("admin");
        }}
        className="bg-transparent text-xs font-medium text-[var(--text-secondary)] focus:outline-none"
        aria-label="View CRM as role"
      >
        <option value="admin">Admin</option>
        <option value="investor">Investor</option>
        <option value="partner">Partner</option>
      </select>
      {role === "admin" && (
        <select
          value={orgRole}
          onChange={(e) => {
            const next = e.target.value;
            setOrgRole(next);
            if (next === "Admin") go("admin");
          }}
          className="bg-transparent text-xs text-[var(--text-secondary)] focus:outline-none"
          aria-label="Choose organisation role lens"
        >
          {ORG_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      )}
      {role === "admin" && orgRole !== "Admin" && (
        <select
          defaultValue={activeUserId ?? ""}
          onChange={(e) => e.target.value && go("admin", undefined, orgRole, e.target.value)}
          className="max-w-36 bg-transparent text-xs text-[var(--text-secondary)] focus:outline-none"
          aria-label="Choose team member to view as"
        >
          <option value="" disabled>
            Choose user…
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}
      {role !== "admin" && (
        <select
          defaultValue=""
          onChange={(e) => e.target.value && go(role, e.target.value)}
          className="max-w-36 bg-transparent text-xs text-[var(--text-secondary)] focus:outline-none"
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
