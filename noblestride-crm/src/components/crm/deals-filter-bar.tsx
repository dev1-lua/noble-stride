"use client";

// deals-filter-bar.tsx — Search + dimension filters + group-by for the unified
// deals queue. Mirrors filter-bar.tsx: a client island that mutates URL
// searchParams so the server page (`/deals`) re-queries. No client-side fetch.
// Every true filter dimension is a searchable multi-select (comma-joined in
// the URL); Group-by is a view control, not a filter, and stays single-select.

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input, MultiSelect, Select } from "@/components/ui";
import { options } from "@/lib/vocab";
import { TICKET_BANDS } from "@/server/domain/deals-queue";

// Multi-value params are comma-joined in the URL, e.g. ?status=Won,Lost.
// Empty/absent param → empty array → no constraint.
function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export function DealsFilterBar({
  leads,
  assists,
  countries,
}: {
  leads: { value: string; label: string }[];
  assists: { value: string; label: string }[];
  countries: { value: string; label: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  const update = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(sp.toString());
      if (value) p.set(key, value);
      else p.delete(key);
      if (key !== "page") p.delete("page"); // reset paging on any filter change
      router.push(`${pathname}?${p.toString()}`);
    },
    [router, sp, pathname]
  );

  const updateMulti = useCallback(
    (key: string, values: string[]) => update(key, values.join(",")),
    [update]
  );

  const typeOpts = [
    { value: "mandate", label: "Mandate" },
    { value: "transaction", label: "Transaction" },
    { value: "advisory", label: "Advisory" },
  ];
  const statusOpts = options("DealStatus");
  const sectorOpts = options("Sector");
  const ticketOpts = TICKET_BANDS.map((b) => ({ value: b.value, label: b.label }));
  const priorityOpts = options("Priority");
  const sourceOpts = options("Source");
  const financingOpts = options("DealFinancingType");
  const groupOpts = [{ value: "", label: "No grouping" }, ...options("DealQueueGroupBy")];

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-56">
        <Input
          type="search"
          placeholder="Search deals…"
          defaultValue={sp.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
          aria-label="Search deals"
        />
      </div>
      <div className="w-40">
        <MultiSelect options={typeOpts} selected={parseList(sp.get("type"))} onChange={(v) => updateMulti("type", v)} placeholder="Type" />
      </div>
      <div className="w-44">
        <MultiSelect options={statusOpts} selected={parseList(sp.get("status"))} onChange={(v) => updateMulti("status", v)} placeholder="Status" />
      </div>
      <div className="w-44">
        <MultiSelect options={sectorOpts} selected={parseList(sp.get("sector"))} onChange={(v) => updateMulti("sector", v)} placeholder="Sector" />
      </div>
      <div className="w-40">
        <MultiSelect options={ticketOpts} selected={parseList(sp.get("ticket"))} onChange={(v) => updateMulti("ticket", v)} placeholder="Ticket" />
      </div>
      {countries.length > 0 && (
        <div className="w-44">
          <MultiSelect options={countries} selected={parseList(sp.get("country"))} onChange={(v) => updateMulti("country", v)} placeholder="Country" />
        </div>
      )}
      <div className="w-44">
        <MultiSelect options={leads} selected={parseList(sp.get("lead"))} onChange={(v) => updateMulti("lead", v)} placeholder="Lead" />
      </div>
      <div className="w-44">
        <MultiSelect options={assists} selected={parseList(sp.get("assist"))} onChange={(v) => updateMulti("assist", v)} placeholder="Assist" />
      </div>
      <div className="w-44">
        <MultiSelect options={financingOpts} selected={parseList(sp.get("financing"))} onChange={(v) => updateMulti("financing", v)} placeholder="Financing" />
      </div>
      <div className="w-40">
        <MultiSelect options={priorityOpts} selected={parseList(sp.get("priority"))} onChange={(v) => updateMulti("priority", v)} placeholder="Priority" />
      </div>
      <div className="w-44">
        <MultiSelect options={sourceOpts} selected={parseList(sp.get("source"))} onChange={(v) => updateMulti("source", v)} placeholder="Source" />
      </div>
      {/* Group-by is a VIEW control (chooses grouping), not a filter — stays single-select. */}
      <div className="w-44">
        <Select options={groupOpts} value={sp.get("group") ?? ""} onChange={(v) => update("group", v)} placeholder="Group by" />
      </div>
    </div>
  );
}
