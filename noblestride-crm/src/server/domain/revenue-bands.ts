// revenue-bands.ts — revenue buckets for the Clients list filter (Aug-2026
// feedback F6.1/image26: "clients filterable by country, sector, revenue").
// Pure: no DB, no React. Bands are half-open [min, max) so a value on a
// boundary lands in exactly one band.

export interface RevenueBand {
  key: string;
  label: string;
  min: number;
  /** Exclusive upper bound; null = open-ended. */
  max: number | null;
}

export const REVENUE_BANDS: RevenueBand[] = [
  { key: "lt1m", label: "< $1M", min: 0, max: 1_000_000 },
  { key: "1-5m", label: "$1M – $5M", min: 1_000_000, max: 5_000_000 },
  { key: "5-20m", label: "$5M – $20M", min: 5_000_000, max: 20_000_000 },
  { key: "20m+", label: "$20M+", min: 20_000_000, max: null },
];

/** Bucket key for a client's last-year revenue; "unknown" when not recorded. */
export const UNKNOWN_REVENUE_BAND = "unknown";
export const UNKNOWN_REVENUE_LABEL = "Not recorded";

export function revenueBandOf(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return UNKNOWN_REVENUE_BAND;
  const band = REVENUE_BANDS.find((b) => amount >= b.min && (b.max == null || amount < b.max));
  return band?.key ?? UNKNOWN_REVENUE_BAND;
}

/** Filter options, including the "Not recorded" bucket. */
export function revenueBandOptions(): { value: string; label: string }[] {
  return [
    ...REVENUE_BANDS.map((b) => ({ value: b.key, label: b.label })),
    { value: UNKNOWN_REVENUE_BAND, label: UNKNOWN_REVENUE_LABEL },
  ];
}
