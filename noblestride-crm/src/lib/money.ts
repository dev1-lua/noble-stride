// money.ts — money formatting + the fee/retainer balance helper.
export function formatMoney(amount?: number | null, currency = "USD"): string {
  if (amount == null) return "";
  const sign = currency === "USD" ? "$" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(amount / 1_000)}K`;
  return `${sign}${Math.round(amount)}`;
}

/**
 * Outstanding balance on a fee or retainer (Aug-2026 feedback F4.2.1/F4.3.1:
 * "track paid amount and pending balance"). Null when no total is recorded —
 * there is nothing to owe. An overpayment reads as 0, never negative.
 */
export function balanceDue(total: number | null | undefined, paid: number | null | undefined): number | null {
  if (total == null) return null;
  return Math.max(total - (paid ?? 0), 0);
}
