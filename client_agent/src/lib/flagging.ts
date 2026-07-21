import { Data } from "lua-cli";

export const SECURITY_FLAG_COLLECTION = "security_flags";
export const DEFAULT_FLAG_DEDUPE_WINDOW_MIN = 60;

/**
 * Pure dedupe core: record a flag only when this sender has NO event inside the trailing
 * window. Keeps one flag per sender per window. Kept in lockstep with
 * investor_agent/src/lib/flagging.ts (the source of truth).
 */
export function shouldRecordFlag(events: number[], nowMs: number, windowMs: number): boolean {
  const windowStart = nowMs - windowMs;
  return !events.some((t) => t > windowStart);
}

export interface FlagDeps {
  dataCreate?: typeof Data.create;
  dataGet?: typeof Data.get;
  now?: () => number;
  windowMs?: number;
}

/**
 * Records ONE deterministic security flag event for `sender`, deduped to once per trailing
 * window. Returns whether a new event was written. FAIL-OPEN: any Data API error resolves to
 * false and never throws, so flagging can never block or break a real visitor conversation.
 */
export async function recordFlagEvent(sender: string, reasons: string[], deps: FlagDeps = {}): Promise<boolean> {
  const dataCreate = deps.dataCreate ?? Data.create;
  const dataGet = deps.dataGet ?? Data.get;
  const now = deps.now ?? Date.now;
  const windowMs = deps.windowMs ?? DEFAULT_FLAG_DEDUPE_WINDOW_MIN * 60_000;
  try {
    const resp = await dataGet(SECURITY_FLAG_COLLECTION, { sender }, 1, 500);
    const events = resp.data.map((entry) => entry.createdAt);
    if (!shouldRecordFlag(events, now(), windowMs)) return false;
    await dataCreate(SECURITY_FLAG_COLLECTION, { sender, reasons: reasons.join("; ") });
    return true;
  } catch {
    return false; // fail-open
  }
}
