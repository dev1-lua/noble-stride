"use client";

// portal-switcher.tsx — inline "view as" picker in the portal banner so the
// demo can hop between investors/partners without returning to Admin.

export interface PortalRecordOption {
  id: string;
  name: string;
  hint?: string | null; // e.g. classification for investors
}

export function PortalSwitcher({
  role,
  recordId,
  investors,
  partners,
}: {
  role: "investor" | "partner";
  recordId: string;
  investors: PortalRecordOption[];
  partners: PortalRecordOption[];
}) {
  function go(nextRole: string, nextId: string) {
    const params = new URLSearchParams({ role: nextRole, recordId: nextId });
    window.location.href = `/api/viewpoint?${params.toString()}`;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={role}
        onChange={(e) => {
          const r = e.target.value as "investor" | "partner";
          const first = r === "investor" ? investors[0] : partners[0];
          if (first) go(r, first.id);
        }}
        className="rounded-md border border-amber-300 bg-white px-1.5 py-0.5 text-xs font-medium text-amber-900"
        aria-label="Portal role"
      >
        <option value="investor">Investor</option>
        <option value="partner">Partner</option>
      </select>
      <select
        value={recordId}
        onChange={(e) => go(role, e.target.value)}
        className="max-w-52 rounded-md border border-amber-300 bg-white px-1.5 py-0.5 text-xs font-medium text-amber-900"
        aria-label={`Which ${role} to view as`}
      >
        {(role === "investor" ? investors : partners).map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.hint && r.hint !== "Active" ? ` (${r.hint})` : ""}
          </option>
        ))}
      </select>
    </span>
  );
}
