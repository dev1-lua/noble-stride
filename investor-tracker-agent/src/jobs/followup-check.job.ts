import { LuaJob, Data, Channels } from "lua-cli";
import { crmClientFromEnv } from "../lib/crm-client";
import { CREATE_TASK } from "../lib/queries";
import { scanEngagements, type StalledFlag } from "../lib/tracker-runner";
import { thresholdsFromEnv } from "../lib/staleness";
import { weekOf } from "../lib/digest-runner";
import { STAFF_COLLECTION } from "../processors/passphrase-gate";
import { TASK_ATTRIBUTION, addBusinessDays } from "../skills/tools/CreateFollowupTaskTool";

export const TRACKER_FLAGS_COLLECTION = "tracker_flags";

/** One reminder per engagement+reason per ISO week. */
export function flagKey(flag: Pick<StalledFlag, "engagementId" | "reason">, now: Date): string {
  return `${flag.engagementId}:${flag.reason}:${weekOf(now)}`;
}

export interface FollowupCheckDeps {
  scan: () => Promise<StalledFlag[]>;
  createTask: (input: Record<string, unknown>) => Promise<unknown>;
  data: { create: typeof Data.create; get: typeof Data.get };
  send: (userId: string, text: string) => Promise<unknown>;
  now?: () => Date;
}

export async function runFollowupCheck(
  deps: FollowupCheckDeps,
): Promise<{ flagged: number; deduped: number; tasksCreated: number; taskFailures: number; notified: number; notifyFailed: number }> {
  const now = deps.now ? deps.now() : new Date();
  const flags = await deps.scan();

  let deduped = 0;
  let tasksCreated = 0;
  let taskFailures = 0;
  const fresh: StalledFlag[] = [];

  for (const flag of flags) {
    const key = flagKey(flag, now);
    const existing = await deps.data.get(TRACKER_FLAGS_COLLECTION, { flagKey: { $eq: key } }, 1, 1);
    if (existing.data.length > 0) {
      deduped += 1;
      continue;
    }
    try {
      await deps.createTask({
        title: `Follow up: ${flag.investor.name} × ${flag.transaction.name} (${flag.stage}, ${Number.isFinite(flag.idleDays) ? `${flag.idleDays}d idle` : "never touched"})`,
        body: `${flag.detail}\n${flag.link}\n${TASK_ATTRIBUTION} (followup-check).`,
        status: "NotStarted",
        source: "Other",
        dueAt: addBusinessDays(now, 3).toISOString(),
        transactionId: flag.transaction.id,
        investorId: flag.investor.id,
      });
      tasksCreated += 1;
      fresh.push(flag);
      // Dedupe record only after the task succeeded, so a failed run retries next time.
      await deps.data.create(TRACKER_FLAGS_COLLECTION, { flagKey: key, engagementId: flag.engagementId, reason: flag.reason }, `tracker flag ${key}`);
    } catch {
      taskFailures += 1; // one bad flag must not sink the run
    }
  }

  let notified = 0;
  let notifyFailed = 0;
  if (fresh.length > 0) {
    const bullets = fresh
      .map((f) => `• ${f.investor.name} × ${f.transaction.name} — ${f.detail} ${f.link}`)
      .join("\n");
    const message = `🔔 Investor Tracker — ${fresh.length} engagement${fresh.length === 1 ? "" : "s"} flagged this morning:\n${bullets}\nFollow-up tasks have been created.`;

    const staff = await deps.data.get(STAFF_COLLECTION, {}, 1, 100);
    const seen = new Set<string>();
    for (const entry of staff.data) {
      const userId = (entry as { data?: { userId?: string } }).data?.userId;
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      try {
        await deps.send(userId, message);
        notified += 1;
      } catch {
        notifyFailed += 1; // one bad recipient must not sink the run
      }
    }
  }

  return { flagged: flags.length, deduped, tasksCreated, taskFailures, notified, notifyFailed };
}

export const followupCheckJob = new LuaJob({
  name: "followup-check",
  description:
    "Weekday 08:00 Nairobi sweep of investor-deal engagements: flags stalled/overdue items, creates deduplicated follow-up tasks for deal leads, and notifies registered staff.",
  schedule: { type: "cron", expression: "0 8 * * 1-5", timezone: "Africa/Nairobi" },
  timeout: 300,
  retry: { maxAttempts: 3, backoffSeconds: 120 },
  execute: async () => {
    const crm = crmClientFromEnv();
    return runFollowupCheck({
      scan: () => scanEngagements({ crm, thresholds: thresholdsFromEnv() }),
      createTask: (input) => crm.query(CREATE_TASK, { input }),
      data: { create: Data.create, get: Data.get },
      send: (userId, text) => Channels.send({ channel: "webchat", to: { userId }, text }),
    });
  },
});
