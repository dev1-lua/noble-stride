import type { RecordType } from "./resolve";

// ── Record summaries ─────────────────────────────────────────────────────────

/** Trim unbounded relations so prompts stay small: keep the 20 most recent activities. */
function trimRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out = { ...record };
  const activities = out.activities;
  if (Array.isArray(activities)) {
    out.activities = [...activities]
      .sort((a, b) => String(b?.occurredAt ?? "").localeCompare(String(a?.occurredAt ?? "")))
      .slice(0, 20);
  }
  return out;
}

export function buildRecordPrompt(recordType: RecordType, record: Record<string, unknown>, focus?: string): string {
  const data = JSON.stringify(trimRecord(record), null, 2);
  return [
    `You are an internal deal-ops analyst at NobleStride Capital. Write a concise briefing on the ${recordType} below.`,
    `Use EXACTLY these markdown sections, each as a "## " heading:`,
    `Headline / Current status / Recent activity / Open items / Risks & stalls / Next steps.`,
    `Rules: use only facts present in the data — never invent numbers, names, or dates. Omit a bullet rather than guess.`,
    `Do not mention raw record IDs. Keep it under 250 words.`,
    focus ? `The reader specifically asked about: ${focus}. Weight the briefing toward that.` : "",
    `DATA:\n${data}`,
  ].filter(Boolean).join("\n\n");
}

export function fallbackRecordMarkdown(recordType: RecordType, record: Record<string, unknown>): string {
  const r = trimRecord(record);
  const lines: string[] = [`## ${String(r.name ?? "(unnamed)")} — ${recordType} (raw facts; AI summary unavailable)`];
  for (const [key, value] of Object.entries(r)) {
    if (value === null || value === undefined || key === "id" || key.endsWith("Id")) continue;
    if (Array.isArray(value)) {
      lines.push(`- **${key}**: ${value.length} item(s)`);
    } else if (typeof value === "object") {
      const name = (value as Record<string, unknown>).name;
      if (name) lines.push(`- **${key}**: ${String(name)}`);
    } else {
      lines.push(`- **${key}**: ${String(value)}`);
    }
  }
  return lines.join("\n");
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** ISO date (YYYY-MM-DD) of the Monday of the week containing `date` (UTC). */
export function weekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Skip weekends when computing task due dates. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return d;
}
