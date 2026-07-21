import { LuaJob, Data, Channels } from "lua-cli";
import { crmClientFromEnv } from "../lib/crm-client";
import { scanReferredDeals, type ReferredDeal } from "../lib/referral-scan";
import { weekOf } from "../lib/format";
import { STAFF_COLLECTION } from "../processors/passphrase-gate";

export const SNAPSHOT_COLLECTION = "referral_stage_snapshots";
export const NOTICE_COLLECTION = "referral_stage_notices";

/** One notice per deal+destination-stage per ISO week. */
export function noticeKey(deal: Pick<ReferredDeal, "dealKey" | "stage">, now: Date): string {
  return `${deal.dealKey}:${deal.stage}:${weekOf(now)}`;
}

export interface StageTransition {
  deal: ReferredDeal;
  fromStage: string;
  fromDealStatus: string;
}

interface SnapshotEntry {
  id?: string;
  _id?: string;
  // Data.get entries have carried record fields either top-level or nested
  // under `.data` depending on platform version (QA 2026-07-15 X1) — read both.
  stage?: string;
  dealStatus?: string;
  data?: {
    dealKey?: string;
    partnerId?: string;
    partnerName?: string;
    dealName?: string;
    stage?: string;
    dealStatus?: string;
    [key: string]: unknown;
  };
}

/** Roster entries are written `{ userId }` top-level by passphrase-gate — accept both shapes. */
export function rosterUserId(entry: unknown): string | undefined {
  const e = entry as { userId?: unknown; data?: { userId?: unknown } };
  const raw = e?.userId ?? e?.data?.userId;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

export interface StageWatchDeps {
  scan: () => Promise<ReferredDeal[]>;
  data: {
    create: (collection: string, data: Record<string, unknown>, searchText?: string) => Promise<unknown>;
    get: (collection: string, filter?: Record<string, unknown>, page?: number, limit?: number) => Promise<{ data: SnapshotEntry[] }>;
    update: (collection: string, entryId: string, data: Record<string, unknown>) => Promise<unknown>;
  };
  send: (userId: string, text: string) => Promise<unknown>;
  baseUrl: string;
  now?: () => Date;
}

export interface StageWatchResult {
  scanned: number;
  seeded: number;
  unchanged: number;
  transitions: number;
  deduped: number;
  notified: number;
  notifyFailed: number;
  snapshotFailures: number;
}

export async function runStageWatch(deps: StageWatchDeps): Promise<StageWatchResult> {
  const now = deps.now ? deps.now() : new Date();
  const deals = await deps.scan();

  const result: StageWatchResult = {
    scanned: deals.length,
    seeded: 0,
    unchanged: 0,
    transitions: 0,
    deduped: 0,
    notified: 0,
    notifyFailed: 0,
    snapshotFailures: 0,
  };

  // ── Diff each deal against its snapshot ─────────────────────────────────
  const transitions: StageTransition[] = [];
  const seedable: ReferredDeal[] = [];
  const snapshotIds = new Map<string, string>(); // dealKey → entry id

  for (const deal of deals) {
    let snapshot: SnapshotEntry | undefined;
    try {
      const existing = await deps.data.get(SNAPSHOT_COLLECTION, { dealKey: { $eq: deal.dealKey } }, 1, 1);
      snapshot = existing.data[0];
    } catch {
      result.snapshotFailures += 1; // one bad deal must not sink the run
      continue;
    }

    if (!snapshot) {
      seedable.push(deal);
      continue;
    }
    const entryId = snapshot.id ?? snapshot._id;
    if (entryId) snapshotIds.set(deal.dealKey, entryId);

    const prevStage = snapshot.data?.stage ?? snapshot.stage;
    const prevStatus = snapshot.data?.dealStatus ?? snapshot.dealStatus;
    if (prevStage === deal.stage && prevStatus === deal.dealStatus) {
      result.unchanged += 1;
      continue;
    }

    // Dedupe: one notice per deal+toStage per ISO week.
    try {
      const key = noticeKey(deal, now);
      const notice = await deps.data.get(NOTICE_COLLECTION, { noticeKey: { $eq: key } }, 1, 1);
      if (notice.data.length > 0) {
        result.deduped += 1;
        continue;
      }
    } catch {
      result.snapshotFailures += 1;
      continue;
    }

    transitions.push({ deal, fromStage: prevStage ?? "(unknown)", fromDealStatus: prevStatus ?? "(unknown)" });
  }

  result.transitions = transitions.length;

  // ── First sighting seeds silently ───────────────────────────────────────
  for (const deal of seedable) {
    try {
      await deps.data.create(
        SNAPSHOT_COLLECTION,
        {
          dealKey: deal.dealKey,
          partnerId: deal.partnerId,
          partnerName: deal.partnerName,
          dealName: deal.dealName,
          stage: deal.stage,
          dealStatus: deal.dealStatus,
        },
        `referral snapshot ${deal.dealKey}`,
      );
      result.seeded += 1;
    } catch {
      result.snapshotFailures += 1;
    }
  }

  if (transitions.length === 0) return result;

  // ── One grouped message to the staff roster ─────────────────────────────
  const bullets = transitions
    .map((t) => {
      const suffix = t.deal.converted ? " — converted! 🎉" : t.deal.lost ? " — lost" : "";
      return `• ${t.deal.dealName} (${t.deal.partnerName}): ${t.fromStage} → ${t.deal.stage}${suffix} ${deps.baseUrl}${t.deal.link}`;
    })
    .join("\n");
  const message = `📇 Referral watch — ${transitions.length} referred deal${transitions.length === 1 ? "" : "s"} moved:\n${bullets}`;

  let anyDelivered = false;
  const staff = await deps.data.get(STAFF_COLLECTION, {}, 1, 100);
  const seen = new Set<string>();
  for (const entry of staff.data) {
    const userId = rosterUserId(entry);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    try {
      await deps.send(userId, message);
      result.notified += 1;
      anyDelivered = true;
    } catch {
      result.notifyFailed += 1; // one bad recipient must not sink the run
    }
  }

  // ── Snapshot update + notice AFTER a successful send, so a failed run
  // retries next time (action-before-dedupe, the tracker's proven ordering).
  // With no staff registered there is no delivery — keep state untouched. ──
  if (!anyDelivered) return result;

  for (const t of transitions) {
    try {
      const entryId = snapshotIds.get(t.deal.dealKey);
      if (entryId) {
        await deps.data.update(SNAPSHOT_COLLECTION, entryId, {
          dealKey: t.deal.dealKey,
          partnerId: t.deal.partnerId,
          partnerName: t.deal.partnerName,
          dealName: t.deal.dealName,
          stage: t.deal.stage,
          dealStatus: t.deal.dealStatus,
        });
      }
      await deps.data.create(
        NOTICE_COLLECTION,
        { noticeKey: noticeKey(t.deal, now), dealKey: t.deal.dealKey, toStage: t.deal.stage },
        `referral notice ${noticeKey(t.deal, now)}`,
      );
    } catch {
      result.snapshotFailures += 1;
    }
  }

  return result;
}

export const stageWatchJob = new LuaJob({
  name: "stage-watch",
  description:
    "Weekday 08:00 Nairobi sweep of referred deals: detects stage/status transitions since the last snapshot and sends registered staff one grouped update, flagging conversions and losses.",
  schedule: { type: "cron", expression: "0 8 * * 1-5", timezone: "Africa/Nairobi" },
  timeout: 300,
  retry: { maxAttempts: 3, backoffSeconds: 120 },
  execute: async () => {
    const crm = crmClientFromEnv();
    return runStageWatch({
      scan: () => scanReferredDeals(crm),
      data: { create: Data.create, get: Data.get, update: Data.update },
      send: (userId, text) => Channels.send({ channel: "webchat", to: { userId }, text }),
      baseUrl: crm.baseUrl,
    });
  },
});
