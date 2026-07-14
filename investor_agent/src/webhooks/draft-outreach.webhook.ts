import { LuaWebhook, Jobs, AI, env } from "lua-cli";
import { crmClientFromEnv } from "../lib/crm-client";
import { runDraftOutreach } from "../lib/draft-runner";

type WebhookEventLike = { headers: Record<string, string | undefined>; body: unknown };

type RunResult = { requested: number; saved: number; skipped: number; fallbacks: number };

/**
 * Pure handler (exported for tests). Secret check first; no work — not even a
 * lookup — happens on a failed/missing secret or a missing transactionId.
 */
export async function handleDraftOutreach(
  event: WebhookEventLike,
  expectedSecret: string | undefined,
  run: (transactionId: string) => Promise<RunResult | (RunResult & Record<string, unknown>)>,
): Promise<Record<string, unknown>> {
  // lua-cli's LuaWebhookEvent.headers type is an untyped Record<string, any> — real HTTP
  // headers arrive lowercased, but we check both casings defensively since that isn't
  // guaranteed by the SDK typings.
  const provided = event.headers["x-webhook-secret"] ?? event.headers["X-Webhook-Secret"];
  if (!expectedSecret || !provided || provided !== expectedSecret) return { ok: false, error: "unauthorized" };
  const body = (event.body ?? {}) as { transactionId?: unknown };
  const transactionId = typeof body.transactionId === "string" ? body.transactionId : "";
  if (!transactionId) return { ok: false, error: "transactionId required" };
  const result = await run(transactionId);
  return { ok: true, ...result };
}

/**
 * Drafting N investors with AI.generate can exceed the webhook's ~5s response
 * budget, so the real work is deferred to a one-off `Jobs.create` job instead of
 * running inline. Jobs created dynamically like this are persisted and executed
 * out-of-process, so the job's `execute` closure CANNOT rely on capturing this
 * function's `transactionId` argument (or any other local variable) — the id
 * travels via `metadata` and `execute` re-derives it from `job.metadata`. All
 * other dependencies (`crmClientFromEnv()`, `AI.generate`) are re-created fresh
 * from module-level imports inside `execute`, which is safe (imports, not
 * closures over local scope). Returns immediately so the webhook ACKs fast.
 */
async function queueDraftOutreach(transactionId: string): Promise<RunResult & { queued: true }> {
  await Jobs.create({
    name: `draft-outreach-${transactionId}-${Date.now()}`,
    description: `Draft investor outreach for transaction ${transactionId}`,
    schedule: { type: "once", executeAt: new Date(Date.now() + 1000) },
    metadata: { transactionId },
    execute: async (job) => {
      const txId = job.metadata.transactionId as string;
      return runDraftOutreach({ crm: crmClientFromEnv(), generate: (p) => AI.generate(p) }, txId);
    },
  });
  return { requested: 0, saved: 0, skipped: 0, fallbacks: 0, queued: true };
}

const draftOutreachWebhook = new LuaWebhook({
  name: "draft-outreach",
  description: "CRM calls this when a deal lead requests investor outreach drafts.",
  execute: async (event) => {
    return handleDraftOutreach(
      { headers: (event.headers ?? {}) as Record<string, string | undefined>, body: event.body },
      env("WEBHOOK_SHARED_SECRET"),
      queueDraftOutreach,
    );
  },
});

export default draftOutreachWebhook;
