import { describe, it, expect, vi } from "vitest";
import { runStageWatch, noticeKey, SNAPSHOT_COLLECTION, NOTICE_COLLECTION, type StageWatchDeps } from "../stage-watch.job";
import { STAFF_COLLECTION } from "../../processors/passphrase-gate";
import type { ReferredDeal } from "../../lib/referral-scan";

const NOW = () => new Date("2026-07-15T05:00:00Z");

function deal(overrides: Partial<ReferredDeal> = {}): ReferredDeal {
  return {
    dealKey: "mandate:m1",
    dealId: "m1",
    dealName: "Busoga Mandate",
    dealType: "mandate",
    partnerId: "p1",
    partnerName: "Acme Advisory",
    stage: "Proposal",
    dealStatus: "Open",
    link: "/mandates/m1",
    converted: false,
    lost: false,
    ...overrides,
  };
}

interface Store {
  snapshots: Array<{ id: string; data: Record<string, unknown> }>;
  notices: Array<{ id: string; data: Record<string, unknown> }>;
  staff: Array<{ id: string; data: { userId: string } }>;
}

function makeDeps(opts: {
  deals: ReferredDeal[];
  store?: Partial<Store>;
  sendFails?: (userId: string) => boolean;
}) {
  const store: Store = {
    snapshots: opts.store?.snapshots ?? [],
    notices: opts.store?.notices ?? [],
    staff: opts.store?.staff ?? [{ id: "s1", data: { userId: "u1" } }],
  };
  const events: string[] = [];
  let nextId = 100;

  const deps: StageWatchDeps = {
    scan: async () => opts.deals,
    data: {
      get: async (collection, filter) => {
        if (collection === STAFF_COLLECTION) return { data: store.staff };
        const rows = collection === SNAPSHOT_COLLECTION ? store.snapshots : store.notices;
        const eq = filter ? (Object.values(filter)[0] as { $eq: string }).$eq : undefined;
        const field = filter ? Object.keys(filter)[0] : undefined;
        return { data: eq !== undefined && field !== undefined ? rows.filter((r) => r.data[field] === eq) : rows };
      },
      create: async (collection, data) => {
        events.push(`create:${collection}`);
        const entry = { id: `e${nextId++}`, data };
        (collection === SNAPSHOT_COLLECTION ? store.snapshots : store.notices).push(entry);
        return entry;
      },
      update: async (collection, entryId, data) => {
        events.push(`update:${collection}:${entryId}`);
        const rows = collection === SNAPSHOT_COLLECTION ? store.snapshots : store.notices;
        const row = rows.find((r) => r.id === entryId);
        if (!row) throw new Error(`no entry ${entryId}`);
        row.data = data;
        return row;
      },
    },
    send: vi.fn(async (userId: string) => {
      events.push(`send:${userId}`);
      if (opts.sendFails?.(userId)) throw new Error("send failed");
    }),
    baseUrl: "https://crm.example",
    now: NOW,
  };
  return { deps, store, events };
}

describe("runStageWatch", () => {
  it("first sighting seeds silently — no message, snapshot written", async () => {
    const { deps, store } = makeDeps({ deals: [deal()] });
    const result = await runStageWatch(deps);
    expect(result).toMatchObject({ scanned: 1, seeded: 1, transitions: 0, notified: 0 });
    expect(store.snapshots).toHaveLength(1);
    expect(store.snapshots[0].data).toMatchObject({ dealKey: "mandate:m1", stage: "Proposal" });
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("unchanged deals are skipped", async () => {
    const { deps } = makeDeps({
      deals: [deal()],
      store: { snapshots: [{ id: "snap1", data: { dealKey: "mandate:m1", stage: "Proposal", dealStatus: "Open" } }] },
    });
    const result = await runStageWatch(deps);
    expect(result).toMatchObject({ unchanged: 1, transitions: 0, notified: 0 });
  });

  it("a stage transition notifies the roster once and flags conversion", async () => {
    const { deps, store } = makeDeps({
      deals: [deal({ stage: "Signed", converted: true })],
      store: {
        snapshots: [{ id: "snap1", data: { dealKey: "mandate:m1", stage: "Proposal", dealStatus: "Open" } }],
        staff: [
          { id: "s1", data: { userId: "u1" } },
          { id: "s2", data: { userId: "u2" } },
          { id: "s3", data: { userId: "u1" } }, // duplicate — must not double-send
        ],
      },
    });
    const result = await runStageWatch(deps);
    expect(result).toMatchObject({ transitions: 1, notified: 2, deduped: 0 });
    expect(deps.send).toHaveBeenCalledTimes(2);
    const message = (deps.send as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(message).toContain("Proposal → Signed");
    expect(message).toContain("converted");
    expect(message).toContain("https://crm.example/mandates/m1");
    // Snapshot advanced + notice written.
    expect(store.snapshots[0].data).toMatchObject({ stage: "Signed" });
    expect(store.notices).toHaveLength(1);
  });

  it("dedupes repeat transitions to the same stage within the ISO week", async () => {
    const d = deal({ stage: "Signed" });
    const { deps } = makeDeps({
      deals: [d],
      store: {
        snapshots: [{ id: "snap1", data: { dealKey: "mandate:m1", stage: "Proposal", dealStatus: "Open" } }],
        notices: [{ id: "n1", data: { noticeKey: noticeKey(d, NOW()) } }],
      },
    });
    const result = await runStageWatch(deps);
    expect(result).toMatchObject({ transitions: 0, deduped: 1, notified: 0 });
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("keeps snapshot/notice state untouched when every send fails (retry next run)", async () => {
    const { deps, store, events } = makeDeps({
      deals: [deal({ stage: "Signed" })],
      store: { snapshots: [{ id: "snap1", data: { dealKey: "mandate:m1", stage: "Proposal", dealStatus: "Open" } }] },
      sendFails: () => true,
    });
    const result = await runStageWatch(deps);
    expect(result).toMatchObject({ transitions: 1, notified: 0, notifyFailed: 1 });
    expect(store.snapshots[0].data.stage).toBe("Proposal"); // NOT advanced
    expect(store.notices).toHaveLength(0);
    expect(events.filter((e) => e.startsWith("update:"))).toHaveLength(0);
  });

  it("updates state only AFTER a successful send (action-before-dedupe ordering)", async () => {
    const { deps, events } = makeDeps({
      deals: [deal({ stage: "Signed" })],
      store: { snapshots: [{ id: "snap1", data: { dealKey: "mandate:m1", stage: "Proposal", dealStatus: "Open" } }] },
    });
    await runStageWatch(deps);
    const sendIdx = events.findIndex((e) => e.startsWith("send:"));
    const updateIdx = events.findIndex((e) => e.startsWith("update:"));
    const noticeIdx = events.findIndex((e) => e === `create:${NOTICE_COLLECTION}`);
    expect(sendIdx).toBeGreaterThanOrEqual(0);
    expect(updateIdx).toBeGreaterThan(sendIdx);
    expect(noticeIdx).toBeGreaterThan(sendIdx);
  });

  it("one failing recipient does not sink the run — state still advances", async () => {
    const { deps, store } = makeDeps({
      deals: [deal({ stage: "Signed" })],
      store: {
        snapshots: [{ id: "snap1", data: { dealKey: "mandate:m1", stage: "Proposal", dealStatus: "Open" } }],
        staff: [
          { id: "s1", data: { userId: "bad" } },
          { id: "s2", data: { userId: "good" } },
        ],
      },
      sendFails: (userId) => userId === "bad",
    });
    const result = await runStageWatch(deps);
    expect(result).toMatchObject({ notified: 1, notifyFailed: 1 });
    expect(store.snapshots[0].data.stage).toBe("Signed");
  });

  it("mixes seeds and transitions in one run", async () => {
    const { deps, store } = makeDeps({
      deals: [
        deal({ stage: "Signed" }),
        deal({ dealKey: "transaction:t9", dealId: "t9", dealName: "Kigali Raise", dealType: "transaction", link: "/transactions/t9" }),
      ],
      store: { snapshots: [{ id: "snap1", data: { dealKey: "mandate:m1", stage: "Proposal", dealStatus: "Open" } }] },
    });
    const result = await runStageWatch(deps);
    expect(result).toMatchObject({ scanned: 2, seeded: 1, transitions: 1 });
    expect(store.snapshots).toHaveLength(2);
  });
});
