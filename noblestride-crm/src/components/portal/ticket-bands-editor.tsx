"use client";
// Ticket-size band rows (action points 2026-07 item 4): multiple ranges per
// profile, each with its own currency, with a live indicative-USD comparison.
// Serializes to a hidden `ticketBandsJson` input for plain server-action forms.

import { useState } from "react";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import { usdComparison, FX_AS_OF } from "@/lib/fx";

export interface TicketBandRow {
  min: string;
  max: string;
  currency: string;
}

const INPUT_CLS =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60";

function comparison(row: TicketBandRow): string {
  const min = Number(row.min);
  if (!row.min || !Number.isFinite(min)) return "";
  const max = row.max && Number.isFinite(Number(row.max)) ? Number(row.max) : null;
  return usdComparison(min, max, row.currency);
}

export function TicketBandsEditor({
  name = "ticketBandsJson",
  initial,
  disabled = false,
  maxBands = 5,
}: {
  name?: string;
  initial: TicketBandRow[];
  disabled?: boolean;
  maxBands?: number;
}) {
  const [rows, setRows] = useState<TicketBandRow[]>(
    initial.length > 0 ? initial : [{ min: "", max: "", currency: "USD" }],
  );

  const update = (i: number, key: keyof TicketBandRow, value: string) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((r, i) => {
        const usd = comparison(r);
        return (
          <div key={i} className="rounded-lg border border-[var(--border-subtle)] p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                className={INPUT_CLS}
                value={r.currency}
                disabled={disabled}
                onChange={(e) => update(i, "currency", e.target.value)}
                aria-label="Band currency"
              >
                {CURRENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="any"
                className={INPUT_CLS}
                placeholder={`Minimum (${r.currency})`}
                value={r.min}
                disabled={disabled}
                onChange={(e) => update(i, "min", e.target.value)}
              />
              <input
                type="number"
                min={0}
                step="any"
                className={INPUT_CLS}
                placeholder={`Maximum (${r.currency}) — empty = open-ended`}
                value={r.max}
                disabled={disabled}
                onChange={(e) => update(i, "max", e.target.value)}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--text-tertiary)]">
                {i === 0 ? "Primary range (drives deal matching)" : usd ? `${usd} (indicative, ${FX_AS_OF})` : ""}
                {i === 0 && usd ? ` · ${usd} (indicative, ${FX_AS_OF})` : ""}
              </span>
              {!disabled && rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                  className="text-xs font-medium text-rose-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
      {!disabled && rows.length < maxBands && (
        <button
          type="button"
          onClick={() => setRows([...rows, { min: "", max: "", currency: "USD" }])}
          className="rounded border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
        >
          + Add another range (e.g. in a different currency)
        </button>
      )}
    </div>
  );
}
