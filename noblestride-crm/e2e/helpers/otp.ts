// Reads the one-time codes the app writes when it is running on the console
// mailer (no RESEND_API_KEY) — see src/server/auth/dev-otp-sink.ts, which owns
// the file and is inert in production or whenever Resend is configured.
//
// This is how the applicant / login OTP flows get tested end to end without a
// mailbox. If RESEND_API_KEY is set the sink stays empty and the calling spec
// should skip rather than fail: a real email went out instead.
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SINK_PATH = join(tmpdir(), "ns-dev-otp-sink.json");

/** True when the app will record OTPs locally (and therefore the specs can read them). */
export function otpSinkAvailable(): boolean {
  return !process.env.RESEND_API_KEY;
}

function peek(email: string): string | null {
  try {
    if (!existsSync(SINK_PATH)) return null;
    const data = JSON.parse(readFileSync(SINK_PATH, "utf8")) as Record<string, { code: string; ts: number }>;
    return data[email.toLowerCase()]?.code ?? null;
  } catch {
    return null;
  }
}

/**
 * The most recent code recorded for this address. Polls for up to 5 s because
 * the request that sends it and this read are in different processes.
 *
 * Pass `after` (a timestamp) to insist on a code recorded since then, so a
 * stale code from an earlier step in the same spec cannot be mistaken for the
 * new one.
 */
export async function readOtp(email: string, opts: { after?: number } = {}): Promise<string> {
  const deadline = Date.now() + 5_000;
  for (;;) {
    try {
      if (existsSync(SINK_PATH)) {
        const data = JSON.parse(readFileSync(SINK_PATH, "utf8")) as Record<string, { code: string; ts: number }>;
        const entry = data[email.toLowerCase()];
        if (entry && (opts.after == null || entry.ts >= opts.after)) return entry.code;
      }
    } catch {
      /* mid-write; retry */
    }
    if (Date.now() > deadline) {
      throw new Error(
        `no OTP recorded for ${email}; is RESEND_API_KEY set? (sink: ${SINK_PATH}, last seen: ${peek(email) ? "an older code" : "nothing"})`,
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}
