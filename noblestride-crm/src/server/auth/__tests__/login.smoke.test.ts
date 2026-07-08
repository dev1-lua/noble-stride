import { afterAll, describe, expect, it } from "vitest";
import { rateLimit } from "../rate-limit";

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

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: EMAIL } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.activity.deleteMany({ where: { subject: { contains: "zz-test-login" } } });
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
});
