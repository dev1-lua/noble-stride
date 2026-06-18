export function formatMoney(amount?: number | null, currency = "USD"): string {
  if (amount == null) return "";
  const sign = currency === "USD" ? "$" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(amount / 1_000)}K`;
  return `${sign}${Math.round(amount)}`;
}
