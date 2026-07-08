// DEV/TEST ONLY. When running on the ConsoleMailer fallback (no RESEND_API_KEY),
// records the most recent OTP per destination to a temp file so the Playwright
// e2e can retrieve it. NOT web-accessible. Inert in production or when Resend is
// configured (a real email is sent instead).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SINK_PATH = join(tmpdir(), "ns-dev-otp-sink.json");

function enabled(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY;
}

export function recordDevOtp(destination: string, code: string): void {
  if (!enabled()) return;
  let data: Record<string, { code: string; ts: number }> = {};
  try {
    if (existsSync(SINK_PATH)) data = JSON.parse(readFileSync(SINK_PATH, "utf8"));
  } catch {
    data = {};
  }
  data[destination.toLowerCase()] = { code, ts: Date.now() };
  try {
    writeFileSync(SINK_PATH, JSON.stringify(data));
  } catch {
    /* best-effort */
  }
}

export function readDevOtp(destination: string): string | null {
  if (process.env.NODE_ENV === "production") return null;
  try {
    if (!existsSync(SINK_PATH)) return null;
    const data = JSON.parse(readFileSync(SINK_PATH, "utf8")) as Record<string, { code: string }>;
    return data[destination.toLowerCase()]?.code ?? null;
  } catch {
    return null;
  }
}
