import { describe, it, expect, vi } from "vitest";
import { runFollowupCheck, flagKey, type FollowupCheckDeps } from "../followup-check.job";
import type { StalledFlag } from "../../lib/tracker-runner";

const NOW = new Date("2026-07-14T08:00:00Z"); // a Tuesday

const flag = (over: Partial<StalledFlag> = {}): StalledFlag => ({
  engagementId: "e1",
  reason: "stalled",
  detail: "No touch in 13 days at stage TeaserSent (threshold 10d).",
  idleDays: 13,
  thresholdDays: 10,
  stage: "TeaserSent",
  investor: { id: "i1", name: "Vantage Capital" },
  transaction: { id: "t1", name: "Busoga Raise" },
  link: "https://crm.example/engagement/e1",
  ...over,
});

function makeDeps(opts: {
  flags?: StalledFlag[];
  existingKeys?: string[];
  staff?: string[];
  staffEntries?: unknown[]; // raw roster entries, overrides `staff`
  failCreateTask?: boolean;
  failSendFor?: string[];
}) {
  const created: Record<string, unknown>[] = [];
  const dedupeWrites: unknown[] = [];
  const sent: Array<{ userId: string; text: string }> = [];
  const existing = new Set(opts.existingKeys ?? []);

  const deps: FollowupCheckDeps = {
    scan: async () => opts.flags ?? [],
    createTask: async (input) => {
      if (opts.failCreateTask) throw new Error("boom");
      created.push(input);
      return { id: `task-${created.length}` };
    },
    data: {
      create: vi.fn(async (_collection: string, data: unknown) => {
        dedupeWrites.push(data);
        return {} as never;
      }) as unknown as FollowupCheckDeps["data"]["create"],
      get: vi.fn(async (_collection: string, filter: Record<string, { $eq?: string }>) => {
        if (filter.flagKey?.$eq !== undefined) {
          return { data: existing.has(filter.flagKey.$eq) ? [{ data: { flagKey: filter.flagKey.$eq } }] : [] } as never;
        }
        return { data: opts.staffEntries ?? (opts.staff ?? []).map((userId) => ({ data: { userId } })) } as never;
      }) as unknown as FollowupCheckDeps["data"]["get"],
    },
    send: async (userId, text) => {
      if (opts.failSendFor?.includes(userId)) throw new Error("offline");
      sent.push({ userId, text });
    },
    now: () => NOW,
  };
  return { deps, created, dedupeWrites, sent };
}

describe("flagKey", () => {
  it("keys by engagement, reason, and ISO week", () => {
    expect(flagKey(flag(), NOW)).toBe("e1:stalled:2026-07-13"); // Monday of that week
  });
});

describe("runFollowupCheck", () => {
  it("creates a linked task and dedupe record per fresh flag, then notifies staff once each", async () => {
    const { deps, created, dedupeWrites, sent } = makeDeps({ flags: [flag()], staff: ["u1", "u2", "u1"] });
    const out = await runFollowupCheck(deps);

    expect(out).toEqual({ flagged: 1, deduped: 0, tasksCreated: 1, taskFailures: 0, notified: 2, notifyFailed: 0 });
    expect(created[0]).toMatchObject({
      title: "Follow up: Vantage Capital × Busoga Raise (TeaserSent, 13d idle)",
      status: "NotStarted",
      source: "Other",
      transactionId: "t1",
      investorId: "i1",
    });
    expect(String(created[0].body)).toContain("https://crm.example/engagement/e1");
    expect(String(created[0].body)).toContain("Created by Investor Tracker Agent");
    expect(dedupeWrites).toHaveLength(1);
    expect(sent.map((s) => s.userId)).toEqual(["u1", "u2"]); // duplicates collapsed
    expect(sent[0].text).toContain("Vantage Capital × Busoga Raise");
  });

  it("skips flags already recorded this week and stays silent when nothing is fresh", async () => {
    const { deps, created, sent } = makeDeps({
      flags: [flag()],
      existingKeys: ["e1:stalled:2026-07-13"],
      staff: ["u1"],
    });
    const out = await runFollowupCheck(deps);
    expect(out).toMatchObject({ flagged: 1, deduped: 1, tasksCreated: 0, notified: 0 });
    expect(created).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("counts task failures without writing a dedupe record, so the next run retries", async () => {
    const { deps, dedupeWrites } = makeDeps({ flags: [flag()], failCreateTask: true, staff: ["u1"] });
    const out = await runFollowupCheck(deps);
    expect(out).toMatchObject({ tasksCreated: 0, taskFailures: 1, notified: 0 });
    expect(dedupeWrites).toHaveLength(0);
  });

  it("one bad recipient never sinks the run", async () => {
    const { deps } = makeDeps({ flags: [flag()], staff: ["down", "u2"], failSendFor: ["down"] });
    const out = await runFollowupCheck(deps);
    expect(out).toMatchObject({ notified: 1, notifyFailed: 1 });
  });

  it("dedupes the same engagement across reasons independently", async () => {
    const { deps, created } = makeDeps({
      flags: [flag(), flag({ reason: "term_sheet_undated", detail: "Term sheet issued, no date." })],
      existingKeys: ["e1:stalled:2026-07-13"],
    });
    const out = await runFollowupCheck(deps);
    expect(out).toMatchObject({ flagged: 2, deduped: 1, tasksCreated: 1 });
    expect(String(created[0].body)).toContain("no date");
  });

  it("notifies staff whether roster entries store userId top-level (passphrase-gate shape) or nested under data", async () => {
    const { deps, sent } = makeDeps({
      flags: [flag()],
      staffEntries: [{ userId: "u-top" }, { data: { userId: "u-nested" } }, { userId: "u-top" }, { note: "no id" }],
    });
    const out = await runFollowupCheck(deps);
    expect(out).toMatchObject({ notified: 2, notifyFailed: 0 });
    expect(sent.map((s) => s.userId)).toEqual(["u-top", "u-nested"]);
  });

  it("labels never-touched engagements instead of printing Infinity", async () => {
    const { deps, created } = makeDeps({ flags: [flag({ idleDays: Number.POSITIVE_INFINITY })] });
    await runFollowupCheck(deps);
    expect(String(created[0].title)).toContain("never touched");
  });
});
