/** USD-Mn pending = total − disbursed. Null total → null. Null disbursed → 0. */
export function amountPending(total?: number | null, disbursed?: number | null): number | null {
  if (total == null) return null;
  return total - (disbursed ?? 0);
}

/** Calendar year + quarter (1–4) from a date. */
export function deriveYearQuarter(date: Date): { year: number; quarter: number } {
  return { year: date.getUTCFullYear(), quarter: Math.floor(date.getUTCMonth() / 3) + 1 };
}

export interface DisbursementRowInput {
  totalAmount: number | null;
  amountDisbursed: number | null;
  amountPending: number | null;
  dateReceived: Date | null;
  year: number | null;
  quarter: number | null;
}

export interface DisbursementPeriodRow {
  year: number;
  quarter: number;
  disbursed: number;
  pending: number;
}

/**
 * Group engagement disbursements into (year, quarter) buckets (SPEC §13).
 * Period = stored year/quarter, else derived from dateReceived; rows with
 * neither are dropped. Pending prefers the stored amountPending, else
 * total − disbursed. Sorted ascending.
 */
export function groupDisbursementsByPeriod(rows: DisbursementRowInput[]): DisbursementPeriodRow[] {
  const buckets = new Map<string, DisbursementPeriodRow>();
  for (const row of rows) {
    let year = row.year;
    let quarter = row.quarter;
    if ((year == null || quarter == null) && row.dateReceived) {
      const derived = deriveYearQuarter(row.dateReceived);
      year = year ?? derived.year;
      quarter = quarter ?? derived.quarter;
    }
    if (year == null || quarter == null) continue;
    const key = `${year}-${quarter}`;
    const bucket = buckets.get(key) ?? { year, quarter, disbursed: 0, pending: 0 };
    bucket.disbursed += row.amountDisbursed ?? 0;
    bucket.pending += row.amountPending ?? amountPending(row.totalAmount, row.amountDisbursed) ?? 0;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.year - b.year || a.quarter - b.quarter);
}
