import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rateLimit } from "../rate-limit";
import { hashPassword } from "../password";
import { signTrust } from "../two-factor";

// Task E gates the investor OTP branch behind twoFactorEnabled() (RESEND_API_KEY
// present). The investor-2FA tests below need that gate ON to exercise the OTP
// path, regardless of whatever RESEND_API_KEY happens to be in the ambient
// .env — so force a key in beforeAll and mock sendMail (never hit real Resend).
vi.mock("../mailer", async () => {
  const actual = await vi.importActual<typeof import("../mailer")>("../mailer");
  return { ...actual, sendMail: vi.fn().mockResolvedValue(undefined) };
});

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

describe("rateLimit (in-memory)", () => {
  it("allows up to max then blocks within the window", () => {
    const key = "test-key-UNIQ-" + Math.random();
    for (let i = 0; i < 5; i++) expect(rateLimit(key, { max: 5, windowMs: 60_000 })).toBe(true);
    expect(rateLimit(key, { max: 5, windowMs: 60_000 })).toBe(false);
  });
});

d("loginWithPassword (DB)", () => {
  const SUFFIX = Math.random().toString(36).slice(2, 8);
  const EMAIL = `zz-test-login-${SUFFIX}@noblestride.capital`;
  const PASSWORD = "long-enough-pass-1";
  const PREV_AUTH_SECRET = process.env.AUTH_SECRET;
  const PREV_RESEND_KEY = process.env.RESEND_API_KEY;

  beforeAll(() => {
    if (!process.env.AUTH_SECRET) process.env.AUTH_SECRET = "zz-test-login-secret-do-not-use-in-prod";
    process.env.RESEND_API_KEY = "re_test_zz_login_smoke_2fa_on";
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: EMAIL } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.activity.deleteMany({ where: { subject: { contains: "zz-test-login" } } });
    await prisma.authAccount.deleteMany({ where: { email: { startsWith: "zz-test-login" } } });
    process.env.AUTH_SECRET = PREV_AUTH_SECRET;
    if (PREV_RESEND_KEY === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = PREV_RESEND_KEY;
  });

  async function makeActiveAccount() {
    const { prisma } = await import("@/lib/db");
    const { hashPassword } = await import("../password");
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      create: { name: "ZZ Login Test", email: EMAIL, role: "TeamMember" },
      update: {},
    });
    return prisma.authAccount.upsert({
      where: { email: EMAIL },
      create: { email: EMAIL, passwordHash: await hashPassword(PASSWORD), kind: "INTERNAL", status: "ACTIVE", userId: user.id },
      update: { status: "ACTIVE", failedLogins: 0, lockedUntil: null, passwordHash: await hashPassword(PASSWORD) },
    });
  }

  it("succeeds with correct credentials and returns internal home", async () => {
    await makeActiveAccount();
    const { loginWithPassword } = await import("../login");
    const res = await loginWithPassword(EMAIL, PASSWORD);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.home).toBe("/dashboard");
  });

  it("fails generically for wrong password and unknown email", async () => {
    await makeActiveAccount();
    const { loginWithPassword } = await import("../login");
    const wrong = await loginWithPassword(EMAIL, "totally-wrong-1");
    expect(wrong).toEqual({ ok: false, reason: "invalid" });
    const unknown = await loginWithPassword(`zz-nobody-${SUFFIX}@noblestride.capital`, PASSWORD);
    expect(unknown).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks after 10 consecutive failures", async () => {
    await makeActiveAccount();
    const { loginWithPassword } = await import("../login");
    for (let i = 0; i < 10; i++) await loginWithPassword(EMAIL, "totally-wrong-1");
    const locked = await loginWithPassword(EMAIL, PASSWORD); // even the RIGHT password
    expect(locked).toEqual({ ok: false, reason: "locked" });
  });

  it("reports pending and suspended states", async () => {
    const { prisma } = await import("@/lib/db");
    const account = await makeActiveAccount();
    const { loginWithPassword } = await import("../login");
    await prisma.authAccount.update({ where: { id: account.id }, data: { status: "PENDING", failedLogins: 0, lockedUntil: null } });
    expect(await loginWithPassword(EMAIL, PASSWORD)).toEqual({ ok: false, reason: "pending" });
    await prisma.authAccount.update({ where: { id: account.id }, data: { status: "SUSPENDED" } });
    expect(await loginWithPassword(EMAIL, PASSWORD)).toEqual({ ok: false, reason: "suspended" });
  });

  // --- investor 2FA branch (Task 5) ---
  it("challenges an ACTIVE investor for OTP when no trusted device", async () => {
    const { prisma } = await import("@/lib/db");
    const { loginWithPassword } = await import("../login");
    const email = `zz-test-login-2fa-${Date.now()}@example.com`;
    await prisma.authAccount.create({
      data: { email, passwordHash: await hashPassword("Str0ng!Passw0rd"), kind: "INVESTOR", status: "ACTIVE" },
    });
    const res = await loginWithPassword(email, "Str0ng!Passw0rd");
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ reason: "otp_required" });
    if (!res.ok && res.reason === "otp_required") {
      expect(res.pendingToken.length).toBeGreaterThan(10);
      expect(res.emailMask).toContain("@");
    }
  });

  it("skips OTP for an investor with a valid trusted-device token", async () => {
    const { prisma } = await import("@/lib/db");
    const { loginWithPassword } = await import("../login");
    const email = `zz-test-login-trust-${Date.now()}@example.com`;
    const acct = await prisma.authAccount.create({
      data: { email, passwordHash: await hashPassword("Str0ng!Passw0rd"), kind: "INVESTOR", status: "ACTIVE" },
    });
    const trust = await signTrust(acct.id);
    const res = await loginWithPassword(email, "Str0ng!Passw0rd", undefined, { trustedDeviceToken: trust });
    expect(res.ok).toBe(true);
  });

  it("never challenges an INTERNAL account", async () => {
    const { prisma } = await import("@/lib/db");
    const { loginWithPassword } = await import("../login");
    const email = `zz-test-login-internal-${Date.now()}@example.com`;
    await prisma.authAccount.create({
      data: { email, passwordHash: await hashPassword("Str0ng!Passw0rd"), kind: "INTERNAL", status: "ACTIVE" },
    });
    const res = await loginWithPassword(email, "Str0ng!Passw0rd");
    expect(res.ok).toBe(true);
  });
});
