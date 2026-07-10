"use client";

// opportunity-filters.tsx — investor-side deal filters (SPEC §11.1).
// Writes URL searchParams only; the server re-runs the gated + filtered query.
// Filters can only narrow what the visibility engine already allows.

import { useRouter, useSearchParams } from "next/navigation";
import { MultiSelect } from "@/components/ui";
import { options } from "@/lib/vocab";

const SELECTS = [
  { key: "sector", label: "Sector", group: "Sector" },
  { key: "country", label: "Country", group: "Geography" },
  { key: "dealType", label: "Deal type", group: "DealType" },
  { key: "instrument", label: "Instrument", group: "Instrument" },
] as const;

// Multi-value params are comma-joined in the URL (e.g. ?sector=Tech,Health).
// Empty/absent param → empty array → no constraint.
function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

const NUMBERS = [
  { key: "ticketMin", label: "Ticket min (USD)" },
  { key: "ticketMax", label: "Ticket max (USD)" },
  { key: "revenueMin", label: "Revenue min (USD)" },
  { key: "revenueMax", label: "Revenue max (USD)" },
  { key: "ebitdaMin", label: "EBITDA min (USD)" },
  { key: "ebitdaMax", label: "EBITDA max (USD)" },
  { key: "netProfitMin", label: "Net profit min (USD)" },
  { key: "netProfitMax", label: "Net profit max (USD)" },
] as const;

const FLAGS = [
  { key: "womenLed", label: "Women-led" },
  { key: "youthLed", label: "Youth-led" },
] as const;

export function OpportunityFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `/portal/investor?${qs}` : "/portal/investor", { scroll: false });
  }

  // Comma-joins the selected values so the server-side parseOpportunityFilters
  // (multi-select, OR-matched) can split them back out.
  function setListParam(key: string, values: string[]) {
    setParam(key, values.join(","));
  }

  const hasAny = [...SELECTS, ...NUMBERS, ...FLAGS].some((f) => params.get(f.key));

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
      <div className="flex flex-wrap items-end gap-3">
        {SELECTS.map((f) => (
          <div key={f.key} className="w-40">
            <MultiSelect
              label={f.label}
              options={options(f.group)}
              selected={parseList(params.get(f.key))}
              onChange={(v) => setListParam(f.key, v)}
              placeholder="All"
            />
          </div>
        ))}
        {NUMBERS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-xs font-medium text-[var(--text-tertiary)]">
            {f.label}
            <input
              type="number"
              min={0}
              key={`${f.key}=${params.get(f.key) ?? ""}`}
              defaultValue={params.get(f.key) ?? ""}
              onBlur={(e) => setParam(f.key, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setParam(f.key, (e.target as HTMLInputElement).value)}
              className="w-32 rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
            />
          </label>
        ))}
        {FLAGS.map((f) => (
          <label key={f.key} className="flex items-center gap-1.5 pb-1.5 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={params.get(f.key) === "1"}
              onChange={(e) => setParam(f.key, e.target.checked ? "1" : "")}
              className="h-4 w-4 rounded border-[var(--border-strong)] text-[var(--accent)]"
            />
            {f.label}
          </label>
        ))}
        {hasAny && (
          <button
            onClick={() => router.replace("/portal/investor", { scroll: false })}
            className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
