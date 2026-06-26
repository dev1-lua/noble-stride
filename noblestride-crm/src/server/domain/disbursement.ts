/** USD-Mn pending = total − disbursed. Null total → null. Null disbursed → 0. */
export function amountPending(total?: number | null, disbursed?: number | null): number | null {
  if (total == null) return null;
  return total - (disbursed ?? 0);
}

/** Calendar year + quarter (1–4) from a date. */
export function deriveYearQuarter(date: Date): { year: number; quarter: number } {
  return { year: date.getUTCFullYear(), quarter: Math.floor(date.getUTCMonth() / 3) + 1 };
}
