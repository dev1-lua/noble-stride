import type { RecordType } from "./resolve";

const DAY_MS = 86_400_000;

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
    `You are an internal deal-ops analyst at Noblestride Capital. Write a concise briefing on the ${recordType} below.`,
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

// ── Pipeline digest ──────────────────────────────────────────────────────────

export interface PipelineItem {
  id: string;
  name: string;
  stageEnteredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  dateOpened?: string | null;
  currency?: string | null;
  dealSize?: number | null;
  targetRaise?: number | null;
  feeAmount?: number | null;
}

export interface StageColumn { stage: string; label: string; items: PipelineItem[] }

export interface DigestSection {
  moved: Array<{ name: string; stage: string }>;
  newEntries: Array<{ name: string; stage: string }>;
  stalled: Array<{ name: string; stage: string; idleDays: number }>;
  totalsByStage: Array<{ label: string; count: number }>;
}

export interface DigestData {
  windowDays: number;
  generatedAt: string;
  mandates: DigestSection;
  transactions: DigestSection;
}

function computeSection(columns: StageColumn[], windowDays: number, now: Date): DigestSection {
  const cutoff = now.getTime() - windowDays * DAY_MS;
  const section: DigestSection = { moved: [], newEntries: [], stalled: [], totalsByStage: [] };
  for (const col of columns) {
    section.totalsByStage.push({ label: col.label, count: col.items.length });
    for (const item of col.items) {
      const created = Math.min(
        new Date(item.createdAt).getTime(),
        item.dateOpened ? new Date(item.dateOpened).getTime() : Infinity,
      );
      const entered = item.stageEnteredAt ? new Date(item.stageEnteredAt).getTime() : null;
      const updated = new Date(item.updatedAt).getTime();
      if (created >= cutoff) {
        section.newEntries.push({ name: item.name, stage: col.label });
      } else if (entered !== null && entered >= cutoff) {
        section.moved.push({ name: item.name, stage: col.label });
      } else if (updated < cutoff) {
        section.stalled.push({ name: item.name, stage: col.label, idleDays: Math.floor((now.getTime() - updated) / DAY_MS) });
      }
    }
  }
  return section;
}

export function computeDigest(input: {
  mandateColumns: StageColumn[];
  transactionColumns: StageColumn[];
  windowDays: number;
  now: Date;
}): DigestData {
  return {
    windowDays: input.windowDays,
    generatedAt: input.now.toISOString(),
    mandates: computeSection(input.mandateColumns, input.windowDays, input.now),
    transactions: computeSection(input.transactionColumns, input.windowDays, input.now),
  };
}

function sectionsFor(digest: DigestData, pipeline: "mandates" | "transactions" | "both") {
  const parts: Array<[string, DigestSection]> = [];
  if (pipeline !== "transactions") parts.push(["Mandates (client acquisition)", digest.mandates]);
  if (pipeline !== "mandates") parts.push(["Transactions (fundraising execution)", digest.transactions]);
  return parts;
}

export function buildDigestPrompt(digest: DigestData, pipeline: "mandates" | "transactions" | "both"): string {
  const data = JSON.stringify(Object.fromEntries(sectionsFor(digest, pipeline)), null, 2);
  return [
    `You are an internal deal-ops analyst at Noblestride Capital. Write the pipeline digest for the last ${digest.windowDays} days.`,
    `Use EXACTLY these markdown sections, each as a "## " heading: Movement / New entries / Stalled deals / Totals by stage.`,
    `Rules: use only facts in the data — never invent. If a section is empty, write "Nothing this period." Keep it under 300 words.`,
    `DATA:\n${data}`,
  ].join("\n\n");
}

export function fallbackDigestMarkdown(digest: DigestData, pipeline: "mandates" | "transactions" | "both"): string {
  const lines: string[] = [`# Pipeline digest — last ${digest.windowDays} days (raw facts; AI summary unavailable)`];
  for (const [title, s] of sectionsFor(digest, pipeline)) {
    lines.push(`\n## ${title}`);
    lines.push(`**Movement:** ${s.moved.map((m) => `${m.name} → ${m.stage}`).join("; ") || "Nothing this period."}`);
    lines.push(`**New entries:** ${s.newEntries.map((m) => `${m.name} (${m.stage})`).join("; ") || "Nothing this period."}`);
    lines.push(`**Stalled:** ${s.stalled.map((m) => `${m.name} (${m.stage}, ${m.idleDays}d idle)`).join("; ") || "Nothing this period."}`);
    lines.push(`**Totals:** ${s.totalsByStage.map((t) => `${t.label}: ${t.count}`).join(", ")}`);
  }
  return lines.join("\n");
}
