export const formatCompact = (n: number) => n.toLocaleString("en-US");

export function formatDate(d?: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function daysAgoLabel(d?: Date | string | null, now = new Date()): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  return days <= 0 ? "today" : `${days}d ago`;
}
