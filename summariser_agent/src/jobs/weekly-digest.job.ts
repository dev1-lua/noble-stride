import { LuaJob, Data, Channels, AI } from "lua-cli";
import { crmClientFromEnv } from "../lib/crm-client";
import { generateDigestMarkdown, DIGESTS_COLLECTION, weekOf } from "../lib/digest-runner";
import { STAFF_COLLECTION } from "../processors/passphrase-gate";

export interface WeeklyDigestDeps {
  generateDigest: (windowDays: number) => Promise<string>;
  data: { create: typeof Data.create; get: typeof Data.get };
  send: (userId: string, text: string) => Promise<unknown>;
  now?: () => Date;
}

export async function runWeeklyDigest(
  deps: WeeklyDigestDeps,
): Promise<{ stored: boolean; delivered: number; failed: number }> {
  const now = deps.now ? deps.now() : new Date();
  const markdown = await deps.generateDigest(7);

  await deps.data.create(
    DIGESTS_COLLECTION,
    { weekOf: weekOf(now), markdown, generatedAt: now.toISOString() },
    `weekly pipeline digest ${weekOf(now)}`,
  );

  const staff = await deps.data.get(STAFF_COLLECTION, {}, 1, 100);
  let delivered = 0;
  let failed = 0;
  const seen = new Set<string>();
  for (const entry of staff.data) {
    const userId = (entry as { data?: { userId?: string } }).data?.userId;
    if (!userId) continue;
    if (seen.has(userId)) continue; // staff_users may contain duplicate entries (get-then-create race)
    seen.add(userId);
    try {
      await deps.send(userId, markdown);
      delivered += 1;
    } catch {
      failed += 1; // one bad recipient must not sink the run
    }
  }
  return { stored: true, delivered, failed };
}

export const weeklyDigestJob = new LuaJob({
  name: "weekly-digest",
  description: "Generates the 7-day pipeline digest every Monday 09:00 Nairobi time, stores it, and pushes it to registered staff.",
  schedule: { type: "cron", expression: "0 9 * * 1", timezone: "Africa/Nairobi" },
  timeout: 300,
  retry: { maxAttempts: 3, backoffSeconds: 120 },
  execute: async () =>
    runWeeklyDigest({
      generateDigest: (days) =>
        generateDigestMarkdown({ crm: crmClientFromEnv(), generate: (p) => AI.generate(p) }, days, "both"),
      data: { create: Data.create, get: Data.get },
      send: (userId, text) => Channels.send({ channel: "webchat", to: { userId }, text }),
    }),
});
