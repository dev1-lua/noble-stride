"use client";

// dd-tracks-panel.tsx — DD workstreams editor (SPEC §6.2): one row per track
// (financial / tax / commercial / ESG / legal) with status, owner, service
// provider, dates and notes. Fires upsertDueDiligenceTrack via urql, then
// router.refresh() — same write pattern as restage-select.

import { useState } from "react";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { label, options } from "@/lib/vocab";

const UPSERT = `
  mutation UpsertDDTrack($input: DueDiligenceTrackInput!) {
    upsertDueDiligenceTrack(input: $input) { id }
  }
`;

export interface DDTrackRow {
  track: string;
  status: string;
  ownerId: string;
  serviceProviderId: string;
  startedAt: string;
  completedAt: string;
  notes: string;
}

interface Option {
  id: string;
  name: string;
}

const inputCls =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

function TrackRow({
  transactionId,
  row,
  users,
  serviceProviders,
}: {
  transactionId: string;
  row: DDTrackRow;
  users: Option[];
  serviceProviders: Option[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(row);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [{ fetching }, executeUpsert] = useMutation(UPSERT);

  function set<K extends keyof DDTrackRow>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setError(null);
    const result = await executeUpsert({
      input: {
        transactionId,
        track: values.track,
        status: values.status || undefined,
        ownerId: values.ownerId || undefined,
        serviceProviderId: values.serviceProviderId || undefined,
        startedAt: values.startedAt ? new Date(values.startedAt) : undefined,
        completedAt: values.completedAt ? new Date(values.completedAt) : undefined,
        notes: values.notes || undefined,
      },
    });
    if (result.error) {
      console.error("[DDTracksPanel] upsert failed:", result.error.message);
      setError("Save failed — please try again.");
      return;
    }
    setDirty(false);
    router.refresh();
  }

  return (
    <tr className="border-b border-[var(--border-subtle)] last:border-0">
      <td className="px-3 py-2.5 text-sm font-medium text-[var(--text-primary)]">{label("DDTrack", values.track)}</td>
      <td className="px-3 py-2.5">
        <select value={values.status} onChange={(e) => set("status", e.target.value)} className={inputCls} aria-label={`${values.track} status`}>
          {options("DDStatus").map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <select value={values.ownerId} onChange={(e) => set("ownerId", e.target.value)} className={inputCls} aria-label={`${values.track} owner`}>
          <option value="">—</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <select value={values.serviceProviderId} onChange={(e) => set("serviceProviderId", e.target.value)} className={inputCls} aria-label={`${values.track} service provider`}>
          <option value="">—</option>
          {serviceProviders.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <input type="date" value={values.startedAt} onChange={(e) => set("startedAt", e.target.value)} className={inputCls} aria-label={`${values.track} started`} />
      </td>
      <td className="px-3 py-2.5">
        <input type="date" value={values.completedAt} onChange={(e) => set("completedAt", e.target.value)} className={inputCls} aria-label={`${values.track} completed`} />
      </td>
      <td className="px-3 py-2.5">
        <input type="text" value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes" className={inputCls} aria-label={`${values.track} notes`} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <Button variant={dirty ? "primary" : "secondary"} size="sm" onClick={save} disabled={fetching || !dirty}>
          {fetching ? "Saving…" : "Save"}
        </Button>
        {error && <p className="mt-1 text-xs text-[var(--t-tag-text-rose)]">{error}</p>}
      </td>
    </tr>
  );
}

export function DDTracksPanel({
  transactionId,
  tracks,
  users,
  serviceProviders,
}: {
  transactionId: string;
  tracks: DDTrackRow[];
  users: Option[];
  serviceProviders: Option[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            <th className="px-3 py-2">Workstream</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Owner</th>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Started</th>
            <th className="px-3 py-2">Completed</th>
            <th className="px-3 py-2">Notes</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {tracks.map((row) => (
            <TrackRow
              key={row.track}
              transactionId={transactionId}
              row={row}
              users={users}
              serviceProviders={serviceProviders}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
