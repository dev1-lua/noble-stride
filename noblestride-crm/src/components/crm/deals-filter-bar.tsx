"use client";

// deals-filter-bar.tsx — Search + dimension filters + group-by for the unified
// deals queue. Mirrors filter-bar.tsx: a client island that mutates URL
// searchParams so the server page (`/deals`) re-queries. No client-side fetch.

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input, Select } from "@/components/ui";
import { options } from "@/lib/vocab";
import { TICKET_BANDS } from "@/server/domain/deals-queue";

export function DealsFilterBar({ leads }: { leads: { value: string; label: string }[] }) {
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

  const typeOpts = [
    { value: "", label: "All types" },
    { value: "mandate", label: "Mandate" },
    { value: "transaction", label: "Transaction" },
  ];
  const statusOpts = [{ value: "", label: "All statuses" }, ...options("DealStatus")];
  const sectorOpts = [{ value: "", label: "All sectors" }, ...options("Sector")];
  const ticketOpts = [
    { value: "", label: "Any ticket" },
    ...TICKET_BANDS.map((b) => ({ value: b.value, label: b.label })),
  ];
  const leadOpts = [{ value: "", label: "All leads" }, ...leads];
  const priorityOpts = [{ value: "", label: "All priorities" }, ...options("Priority")];
  const sourceOpts = [{ value: "", label: "All sources" }, ...options("Source")];
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
        <Select options={typeOpts} value={sp.get("type") ?? ""} onChange={(v) => update("type", v)} placeholder="Type" />
      </div>
      <div className="w-44">
        <Select options={statusOpts} value={sp.get("status") ?? ""} onChange={(v) => update("status", v)} placeholder="Status" />
      </div>
      <div className="w-44">
        <Select options={sectorOpts} value={sp.get("sector") ?? ""} onChange={(v) => update("sector", v)} placeholder="Sector" />
      </div>
      <div className="w-40">
        <Select options={ticketOpts} value={sp.get("ticket") ?? ""} onChange={(v) => update("ticket", v)} placeholder="Ticket" />
      </div>
      <div className="w-44">
        <Select options={leadOpts} value={sp.get("lead") ?? ""} onChange={(v) => update("lead", v)} placeholder="Lead" />
      </div>
      <div className="w-40">
        <Select options={priorityOpts} value={sp.get("priority") ?? ""} onChange={(v) => update("priority", v)} placeholder="Priority" />
      </div>
      <div className="w-44">
        <Select options={sourceOpts} value={sp.get("source") ?? ""} onChange={(v) => update("source", v)} placeholder="Source" />
      </div>
      <div className="w-44">
        <Select options={groupOpts} value={sp.get("group") ?? ""} onChange={(v) => update("group", v)} placeholder="Group by" />
      </div>
    </div>
  );
}
