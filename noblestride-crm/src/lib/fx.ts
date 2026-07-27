// Indicative FX conversion for the currency-comparison view (action points
// 2026-07 item 4). STATIC, curated table — no external API (user decision
// 2026-07-27): deterministic, works offline/on Vercel. Rates are order-of-
// magnitude aids for comparing ticket bands across currencies, NOT dealing
// rates — every rendered conversion must carry the "indicative" caption.
// Ops can override a rate without a deploy via the FX_RATES_JSON env var,
// e.g. FX_RATES_JSON='{"KES":132,"NGN":1600}'.

import { CURRENCY_CODES } from "./currencies";

/** Units of the currency per 1 USD (so USD is 1). */
export const INDICATIVE_USD_RATES: Record<string, number> = {
  USD: 1,
  KES: 129,
  EUR: 0.86,
  GBP: 0.74,
  NGN: 1530,
  ZAR: 17.8,
  TZS: 2600,
  UGX: 3580,
  RWF: 1440,
  ETB: 137,
  EGP: 48.5,
  MAD: 9.0,
  GHS: 10.4,
  XOF: 565,
  AED: 3.6725,
};

/** Human-readable as-of stamp for the "indicative rates" caption. */
export const FX_AS_OF = "Jul 2026";

let envOverrides: Record<string, number> | null | undefined;

function overrides(): Record<string, number> | null {
  if (envOverrides !== undefined) return envOverrides;
  envOverrides = null;
  const raw = process.env.FX_RATES_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const clean: Record<string, number> = {};
      for (const [code, rate] of Object.entries(parsed)) {
        if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) clean[code.toUpperCase()] = rate;
      }
      if (Object.keys(clean).length > 0) envOverrides = clean;
    } catch {
      // Malformed override → fall back to the static table.
    }
  }
  return envOverrides;
}

/** Units of `currency` per USD, honoring env overrides. Null = unknown currency. */
export function usdRate(currency: string): number | null {
  const code = currency.toUpperCase();
  const rate = overrides()?.[code] ?? INDICATIVE_USD_RATES[code];
  return rate ?? null;
}

/** Convert an amount in `currency` to indicative USD. Null when the currency is unknown. */
export function toUsd(amount: number, currency: string): number | null {
  const rate = usdRate(currency);
  if (rate == null) return null;
  return amount / rate;
}

/** Compact money formatting: 1.5M, 750k, 900 — matching the app's short style. */
export function compactAmount(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${trimZeros((amount / 1_000_000_000).toFixed(1))}B`;
  if (abs >= 1_000_000) return `${trimZeros((amount / 1_000_000).toFixed(1))}M`;
  if (abs >= 1_000) return `${trimZeros((amount / 1_000).toFixed(0))}k`;
  return `${Math.round(amount)}`;
}

function trimZeros(s: string): string {
  return s.replace(/\.0$/, "");
}

/** "KES 100M – 500M" (max null = open-ended → "KES 100M+"). */
export function bandLabel(min: number, max: number | null, currency: string): string {
  return max == null
    ? `${currency} ${compactAmount(min)}+`
    : `${currency} ${compactAmount(min)} – ${compactAmount(max)}`;
}

/**
 * The comparison suffix: "≈ $775k – $3.9M" for a non-USD band; empty string
 * for USD bands (comparing USD to USD is noise) and unknown currencies.
 */
export function usdComparison(min: number, max: number | null, currency: string): string {
  if (currency.toUpperCase() === "USD") return "";
  const minUsd = toUsd(min, currency);
  if (minUsd == null) return "";
  if (max == null) return `≈ $${compactAmount(minUsd)}+`;
  const maxUsd = toUsd(max, currency);
  return maxUsd == null ? "" : `≈ $${compactAmount(minUsd)} – $${compactAmount(maxUsd)}`;
}

/** "KES 100M – 500M ≈ $775k – $3.9M" — the full display line for one band. */
export function fxPairLabel(min: number, max: number | null, currency: string): string {
  const base = bandLabel(min, max, currency);
  const usd = usdComparison(min, max, currency);
  return usd ? `${base} ${usd}` : base;
}

/** Every supported currency has an indicative rate (guard used by tests). */
export function missingRateCodes(): string[] {
  return CURRENCY_CODES.filter((c) => INDICATIVE_USD_RATES[c] == null);
}
