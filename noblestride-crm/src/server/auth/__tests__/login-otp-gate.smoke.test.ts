// Task E: RESEND_API_KEY is the on/off switch for investor 2FA (spec Task 4 /
// plan Task E, Option B). Mocks only sendMail (never hits the real Resend API)
// while exercising the REAL mailProvider()/twoFactorEnabled() gate logic keyed
// off process.env.RESEND_API_KEY, so the gate itself is under test.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../mailer", async () => {
  const actual = await vi.importActual<typeof import("../mailer")>("../mailer");
  return { ...actual, sendMail: vi.fn().mockResolvedValue(undefined) };
});

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("loginWithPassword — 2FA gate (RESEND_API_KEY on/off)", () => {
  const SUFFIX = Math.random().toString(36).slice(2, 8);
  const EMAIL_GATE_OFF = `zz-test-2fa-gate-off-${SUFFIX}@example.com`;
  const EMAIL_GATE_ON = `zz-test-2fa-gate-on-${SUFFIX}@example.com`;
  const PASSWORD = "Str0ng!Passw0rd";
  const PREV_AUTH_SECRET = process.env.AUTH_SECRET;
  // Captured in beforeAll (post-collection, pre-run), NOT at module top-level:
  // instantiating the Prisma client auto-loads .env, and that can happen lazily
  // on the first dynamic `import("@/lib/db")` anywhere in the suite. Capturing
  // here — after forcing that import — reflects the real ambient value so
  // afterEach restores it correctly instead of accidentally deleting a key
  // that other test files (e.g. login.smoke.test.ts) rely on being present.
  let prevResendKey: string | undefined;

  beforeAll(async () => {
    if (!process.env.AUTH_SECRET) process.env.AUTH_SECRET = "zz-test-2fa-gate-secret-do-not-use-in-prod";
    await import("@/lib/db");
    prevResendKey = process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    if (prevResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevResendKey;
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: { startsWith: "zz-test-2fa-gate" } } });
    process.env.AUTH_SECRET = PREV_AUTH_SECRET;
  });

  it("bypasses OTP and issues a real session when RESEND_API_KEY is unset (gate off)", async () => {
    // Import first: instantiating the Prisma client auto-loads .env (this repo's
    // real .env carries a live RESEND_API_KEY), so delete AFTER imports settle,
    // immediately before the call under test, or the reload clobbers it back in.
    const { prisma } = await import("@/lib/db");
    const { hashPassword } = await import("../password");
    const { loginWithPassword } = await import("../login");
    delete process.env.RESEND_API_KEY;
    await prisma.authAccount.create({
      data: { email: EMAIL_GATE_OFF, passwordHash: await hashPassword(PASSWORD), kind: "INVESTOR", status: "ACTIVE" },
    });

    const res = await loginWithPassword(EMAIL_GATE_OFF, PASSWORD);
    // LoginResult is a discriminated union — asserting ok:true here rules out
    // otp_required/otp_unavailable (both are ok:false variants) at the type level.
    if (!res.ok) throw new Error(`expected a successful session, got reason=${res.reason}`);
    expect(res.token).toEqual(expect.any(String));
    expect(res.expiresAt).toBeInstanceOf(Date);
    expect(res.home).toBe("/portal/investor");
  });

  it("still requires OTP when RESEND_API_KEY is set (gate on)", async () => {
    process.env.RESEND_API_KEY = "re_test_zz2fa_gate_on";
    const { prisma } = await import("@/lib/db");
    const { hashPassword } = await import("../password");
    const { loginWithPassword } = await import("../login");
    await prisma.authAccount.create({
      data: { email: EMAIL_GATE_ON, passwordHash: await hashPassword(PASSWORD), kind: "INVESTOR", status: "ACTIVE" },
    });

    const res = await loginWithPassword(EMAIL_GATE_ON, PASSWORD);
    expect(res).toEqual({
      ok: false,
      reason: "otp_required",
      pendingToken: expect.any(String),
      emailMask: expect.any(String),
    });
  });
});
