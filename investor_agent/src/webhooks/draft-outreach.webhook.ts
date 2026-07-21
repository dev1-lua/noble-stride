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

// The job name is the canonical carrier of the transaction id (see
// `resolveJobTransactionId`). Kept as one builder so the write side (the name we
// create) and the read side (the regex that parses it back) can never drift.
// Transaction ids are cuids (lowercase alphanumeric, NO hyphens), so the id
// segment sits unambiguously between the fixed prefix and the trailing numeric
// timestamp.
const JOB_NAME_PREFIX = "draft-outreach";
export function outreachJobName(transactionId: string, now: number): string {
  return `${JOB_NAME_PREFIX}-${transactionId}-${now}`;
}
// `[a-z0-9]+` is exactly the cuid charset (no hyphens/underscores), and the `$`
// anchor is deliberately omitted: some Lua runtimes suffix the stored job name
// with `_<epoch>` (lua-cli's local sandbox does — index.js:20640), so anchoring
// to end-of-string would fail to parse a mangled name. Matching the id segment
// followed by `-<timestamp>` parses both the clean and the suffixed form.
const JOB_NAME_RE = new RegExp(`^${JOB_NAME_PREFIX}-([a-z0-9]+)-\\d+`);

/**
 * Resolve the transactionId a deferred job must draft for — reading ONLY from the
 * `job` argument the runner passes to `execute`.
 *
 * ROOT-CAUSE NOTE: lua-cli serializes a dynamic job via `config.execute.toString()`
 * (api-exports.js:6516) — only the function's SOURCE TEXT crosses to the
 * out-of-process run, never its closure bindings. So a value captured from the
 * enclosing `queueDraftOutreach` scope (e.g. a local `transactionId`) is an
 * undefined free variable at execution → ReferenceError. The value must instead
 * ride on the `job` record, whose fields the runner rebuilds (index.js:20856-74:
 * `name: jobData.name`, `metadata: jobData.metadata || {}`). In prod `metadata`
 * comes back empty for dynamic jobs (that was the original HTTP 400 — the query
 * fired with `transactionId: undefined`), but `name` is a core field we control
 * and always get back. We therefore prefer `metadata` (harmless if a future SDK
 * populates it) and fall back to parsing `name`, failing LOUD if neither yields
 * an id — so an undefined variable can never reach the CRM again.
 */
export function resolveJobTransactionId(job?: { name?: string; metadata?: Record<string, unknown> }): string {
  const fromMeta = job?.metadata?.transactionId;
  const metaId = typeof fromMeta === "string" ? fromMeta.trim() : "";
  const nameMatch = typeof job?.name === "string" ? job.name.match(JOB_NAME_RE) : null;
  const nameId = nameMatch?.[1]?.trim() ?? "";
  const id = metaId || nameId;
  if (!id) {
    throw new Error(
      "draft-outreach job: transactionId unavailable from job.metadata or job.name — cannot draft outreach.",
    );
  }
  return id;
}

/**
 * Drafting N investors with AI.generate can exceed the webhook's ~5s response
 * budget, so the real work is deferred to a one-off `Jobs.create` job instead of
 * running inline. The transaction id rides on the job RECORD (name + metadata),
 * NOT a closure — see `resolveJobTransactionId` for why closures cannot survive
 * `execute.toString()` serialization. The module-level deps `runDraftOutreach`,
 * `crmClientFromEnv`, `AI` are bundled into the job artifact and resolve at
 * execution (the original job already reached the CRM this way). Returns
 * immediately so the webhook ACKs fast.
 */
async function queueDraftOutreach(transactionId: string): Promise<RunResult & { queued: true }> {
  await Jobs.create({
    name: outreachJobName(transactionId, Date.now()),
    description: `Draft investor outreach for transaction ${transactionId}`,
    schedule: { type: "once", executeAt: new Date(Date.now() + 1000) },
    metadata: { transactionId },
    execute: async (job) => {
      try {
        const txId = resolveJobTransactionId(job);
        return await runDraftOutreach({ crm: crmClientFromEnv(), generate: (p) => AI.generate(p) }, txId);
      } catch (err) {
        // Guarantee the real reason reaches the logs: the runner's own
        // console.error(e) prints only the message/stack, but a CrmError carries
        // the diagnostic on `.detail` (the CRM's actual GraphQL error). Surface
        // it explicitly so a future failure is self-diagnosing, then rethrow so
        // the job is still recorded as failed.
        const detail = (err as { detail?: string })?.detail;
        console.error("draft-outreach job failed:", (err as Error)?.message, detail ? `| detail: ${detail}` : "");
        throw err;
      }
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
