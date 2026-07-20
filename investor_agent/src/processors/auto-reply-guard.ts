import { PreProcessor, Lua, Data, env } from "lua-cli";
import { classifyInboundProbe } from "../lib/guardrails/inbound-probe";
import { recordFlagEvent } from "../lib/flagging";

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

/** Best-effort extraction of the inbound text body from a preprocessor `messages` array. */
export function textFromMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  return messages
    .filter((m): m is { type: string; text: string } =>
      !!m && typeof m === "object" && (m as { type?: unknown }).type === "text" && typeof (m as { text?: unknown }).text === "string")
    .map((m) => m.text)
    .join("\n");
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

export interface AutoReplyDecisionDeps {
  checkRateLimit?: (sender: string) => Promise<boolean>;
  classifyProbe?: typeof classifyInboundProbe;
  recordFlag?: typeof recordFlagEvent;
}

/**
 * Injectable decision core for the whole preprocessor (mirrors `enforceOutbound` in
 * outbound-leak-guard.ts: a pure-ish, I/O-injectable function the PreProcessor's
 * `execute` calls with real deps, so the composition can be integration-tested
 * without a live `Lua.request`/Data backend). Composes, in order (spec §4.5):
 *   1. machine-mail gate (RFC-3834 headers, bad senders, OOO subjects) — wins first;
 *   2. rate-limit backstop (spec §7);
 *   3. probe-flag backstop — never blocks; flags a probing sender for humans while
 *      the sender still gets a warm, safe reply. `recordFlag` (fail-open internally,
 *      see flagging.ts) is additionally wrapped here so a thrown Data error can
 *      never turn a "proceed" into a block, even if a caller injects a raw `recordFlag`
 *      that skips its own fail-open handling.
 */
export async function decideAutoReply(
  meta: InboundEmailMeta,
  probeText: string,
  deps: AutoReplyDecisionDeps = {},
): Promise<{ action: "block" | "proceed" }> {
  const decision = gateDecision(meta);
  if (decision.block) return { action: "block" };
  // Backstop (spec §7): only meaningful once we have a sender to key on.
  const sender = (meta.from ?? "").trim();
  if (sender) {
    const checkRateLimit = deps.checkRateLimit ?? checkAutoReplyRateLimit;
    const overLimit = await checkRateLimit(sender);
    if (overLimit) return { action: "block" };
    // spec §4.5 — deterministic probe flag backstop. A probe is NOT blocked:
    // the sender still gets a warm, safe reply. recordFlagEvent is fail-open.
    const classifyProbe = deps.classifyProbe ?? classifyInboundProbe;
    const recordFlag = deps.recordFlag ?? recordFlagEvent;
    const probe = classifyProbe(probeText);
    if (probe.isProbe) {
      try {
        await recordFlag(sender, probe.reasons);
      } catch {
        /* fail-open on flag I/O only — the decision above is unconditional */
      }
    }
  }
  return { action: "proceed" };
}

export const autoReplyGuard = new PreProcessor({
  name: "auto-reply-guard",
  description: "Blocks auto-replies, bounces and machine mail so the agent never loops with a robot.",
  priority: 5,
  execute: async (_user, messages, channel) => {
    if (channel !== "email") return { action: "proceed" as const };
    const meta = metaFromRequest();
    const probeText = [meta.subject, textFromMessages(messages)].filter(Boolean).join("\n");
    const { action } = await decideAutoReply(meta, probeText);
    return action === "block" ? { action: "block" as const, response: "" } : { action: "proceed" as const };
  },
});
