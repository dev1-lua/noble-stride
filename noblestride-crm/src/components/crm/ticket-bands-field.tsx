"use client";
// Controlled ticket-band rows for entity forms (action points 2026-07 item 4).
// Value shape matches the InvestorInput.ticketBands GraphQL input / Zod
// ticketBandInputSchema: numbers, max null = open-ended, per-band currency.
// Shows the indicative-USD comparison inline as bands are edited.

import { NumberField, SelectField } from "@/components/ui/fields";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import { usdComparison, FX_AS_OF } from "@/lib/fx";

export interface TicketBandValue {
  min: number;
  max?: number | null;
  currency?: string;
}

export function TicketBandsField({
  label = "Ticket Sizes",
  value,
  onChange,
  error,
  maxBands = 5,
}: {
  label?: string;
  value: TicketBandValue[];
  onChange: (next: TicketBandValue[]) => void;
  error?: string;
  maxBands?: number;
}) {
  const update = (i: number, patch: Partial<TicketBandValue>) =>
    onChange(value.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-[var(--text-tertiary)]">{label}</span>
      {value.map((b, i) => {
        const usd =
          b.min != null && Number.isFinite(b.min) ? usdComparison(b.min, b.max ?? null, b.currency ?? "USD") : "";
        return (
          <div key={i} className="rounded-lg border border-[var(--border-subtle)] p-3">
            <div className="grid grid-cols-3 gap-2">
              <SelectField
                label="Currency"
                value={b.currency ?? "USD"}
                onChange={(x) => update(i, { currency: x })}
                options={CURRENCY_OPTIONS}
              />
              <NumberField
                label="Min"
                value={Number.isFinite(b.min) ? b.min : undefined}
                onChange={(x) => update(i, { min: x ?? 0 })}
                min={0}
              />
              <NumberField
                label="Max (empty = open)"
                value={b.max ?? undefined}
                onChange={(x) => update(i, { max: x ?? null })}
                min={0}
              />
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-[11px] text-[var(--text-tertiary)]">
                {i === 0 ? "Primary range (drives matching)" : ""}
                {usd ? `${i === 0 ? " · " : ""}${usd} (indicative, ${FX_AS_OF})` : ""}
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="text-[11px] font-medium text-rose-600 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
      {value.length < maxBands && (
        <button
          type="button"
          onClick={() => onChange([...value, { min: 0, max: null, currency: "USD" }])}
          className="rounded border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
        >
          + Add ticket range
        </button>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
