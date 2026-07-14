import { PreProcessor, Lua, Data, env } from "lua-cli";

export interface InboundEmailMeta {
  from?: string;
  subject?: string;
  autoSubmitted?: string;
  precedence?: string;
  autoResponseSuppress?: string;
}

const BAD_SENDERS = /^(no-?reply|mailer-daemon|postmaster|bounce)/i;
const OOO_SUBJECT = /\b(automatic reply|auto-?reply|out of office|delivery status|undeliverable)\b/i;

/** RFC-3834-flavoured loop protection. Conservative: block only clear machine mail. */
export function gateDecision(meta: InboundEmailMeta): { block: boolean; reason?: string } {
  if (meta.autoSubmitted && meta.autoSubmitted.toLowerCase() !== "no")
    return { block: true, reason: "auto-submitted" };
  if (meta.precedence && /^(bulk|junk|list|auto_reply)$/i.test(meta.precedence))
    return { block: true, reason: "precedence" };
  if (meta.autoResponseSuppress) return { block: true, reason: "suppress-header" };
  const from = (meta.from ?? "").trim();
  const local = from.includes("<") ? from.slice(from.indexOf("<") + 1) : from;
  if (BAD_SENDERS.test(local)) return { block: true, reason: "machine-sender" };
  if (meta.subject && OOO_SUBJECT.test(meta.subject)) return { block: true, reason: "ooo-subject" };
  return { block: false };
}

function metaFromRequest(): InboundEmailMeta {
  // Best-effort: field names vary by channel payload version; absent fields fail open.
  // `Lua.request.webhook?.payload` is typed `any` in lua-cli (WebhookRequest.payload: any),
  // so no unsafe cast is needed here.
  const payload = (Lua.request.webhook?.payload ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : undefined);
  const fromField = payload["from"];
  return {
    from:
      s(fromField) ??
      s((fromField as Record<string, unknown> | undefined)?.["address"]) ??
      s((fromField as Record<string, unknown> | undefined)?.["email"]),
    subject: s(payload["subject"]),
    autoSubmitted: s(payload["autoSubmitted"]) ?? s(payload["auto_submitted"]),
    precedence: s(payload["precedence"]),
    autoResponseSuppress: s(payload["xAutoResponseSuppress"]) ?? s(payload["x_auto_response_suppress"]),
  };
}

// --- spec §7: auto-reply rate-limit backstop ------------------------------
//
// The heuristics above catch obvious machine mail, but a misbehaving or
// compromised sender could still trigger many legitimate-looking messages in
// a row. This is a Data-collection-backed backstop: every non-blocked email
// records an event for its sender, and if that sender has sent more than
// LIMIT messages within WINDOW, the message is blocked (no auto-reply).
//
// Defaults: 20 messages / 10 minutes. Overridable via env() (lua-cli's
// per-agent environment variable accessor — see `env` in
// node_modules/lua-cli/dist/api-exports.d.ts) as AUTO_REPLY_RATE_LIMIT and
// AUTO_REPLY_RATE_WINDOW_MIN.
//
// Uses the Custom Data API (`Data.create` / `Data.get`, declared in
// node_modules/lua-cli/dist/api-exports.d.ts as `export declare const Data`)
// to persist a lightweight event per message, keyed by sender, in the
// "auto_reply_rate" collection. Each `CustomDataEntry` carries its own
// server-assigned `createdAt` timestamp (ms), so no extra timestamp field is
// stored — the entry's own metadata is the event clock.
//
// FAIL-OPEN: this is a backstop, not a gate. Any error talking to the Data
// API (misconfigured collection, network hiccup, etc.) must not block real
// investor mail, so every failure path proceeds.

export const AUTO_REPLY_RATE_COLLECTION = "auto_reply_rate";
export const DEFAULT_AUTO_REPLY_RATE_LIMIT = 20;
export const DEFAULT_AUTO_REPLY_RATE_WINDOW_MIN = 10;

function envPositiveInt(key: string, fallback: number): number {
  const raw = env(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Pure, injectable decision core (unit-testable without the platform).
 * `events` are timestamps (ms) of this sender's prior recorded messages;
 * `nowMs` is the current time. Returns `true` (block) once more than `limit`
 * events fall inside the trailing `windowMs` window ending at `nowMs`.
 */
export function rateDecision(events: number[], nowMs: number, limit: number, windowMs: number): boolean {
  const windowStart = nowMs - windowMs;
  const count = events.filter((t) => t > windowStart).length;
  return count > limit;
}

export interface RateLimiterDeps {
  dataCreate?: typeof Data.create;
  dataGet?: typeof Data.get;
  now?: () => number;
  limit?: number;
  windowMs?: number;
}

/**
 * Thin wrapper: records an event for `sender`, then counts this sender's
 * events in the trailing window and applies `rateDecision`. Fails open on
 * any thrown error from either Data API call.
 */
export async function checkAutoReplyRateLimit(sender: string, deps: RateLimiterDeps = {}): Promise<boolean> {
  const dataCreate = deps.dataCreate ?? Data.create;
  const dataGet = deps.dataGet ?? Data.get;
  const now = deps.now ?? Date.now;
  const limit = deps.limit ?? envPositiveInt("AUTO_REPLY_RATE_LIMIT", DEFAULT_AUTO_REPLY_RATE_LIMIT);
  const windowMs =
    deps.windowMs ?? envPositiveInt("AUTO_REPLY_RATE_WINDOW_MIN", DEFAULT_AUTO_REPLY_RATE_WINDOW_MIN) * 60_000;
  try {
    await dataCreate(AUTO_REPLY_RATE_COLLECTION, { sender });
    const resp = await dataGet(AUTO_REPLY_RATE_COLLECTION, { sender }, 1, 500);
    const events = resp.data.map((entry) => entry.createdAt);
    return rateDecision(events, now(), limit, windowMs);
  } catch {
    return false; // fail-open
  }
}

export const autoReplyGuard = new PreProcessor({
  name: "auto-reply-guard",
  description: "Blocks auto-replies, bounces and machine mail so the agent never loops with a robot.",
  priority: 5,
  execute: async (_user, _messages, channel) => {
    if (channel !== "email") return { action: "proceed" as const };
    const meta = metaFromRequest();
    const decision = gateDecision(meta);
    if (decision.block) return { action: "block" as const, response: "" };
    // Backstop (spec §7): only meaningful once we have a sender to key on.
    const sender = (meta.from ?? "").trim();
    if (sender) {
      const overLimit = await checkAutoReplyRateLimit(sender);
      if (overLimit) return { action: "block" as const, response: "" };
    }
    return { action: "proceed" as const };
  },
});
