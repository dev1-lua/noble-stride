import { afterAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const EMAIL = "zz-test-reset-UNIQ@noblestride.capital";

d("password reset (DB)", () => {
  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: EMAIL } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.activity.deleteMany({ where: { subject: { contains: "zz-test-reset" } } });
  });

  it("full reset flow: request → token → new password; sessions revoked; token single-use", async () => {
    const { prisma } = await import("@/lib/db");
    const { hashPassword, verifyPassword } = await import("../password");
    const { createSession, validateSessionToken } = await import("../session");
    const { createAuthToken } = await import("../tokens");
    const { performPasswordReset } = await import("../reset");

    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      create: { name: "ZZ Reset Test", email: EMAIL, role: "TeamMember" },
      update: {},
    });
    const account = await prisma.authAccount.upsert({
      where: { email: EMAIL },
      create: { email: EMAIL, passwordHash: await hashPassword("old-password-1"), kind: "INTERNAL", status: "ACTIVE", userId: user.id },
      update: {},
    });
    const { token: sessionToken } = await createSession(account.id);
    const raw = await createAuthToken(account.id, "RESET_PASSWORD");

    const bad = await performPasswordReset(raw, "short");
    expect(bad.ok).toBe(false); // policy rejected, token NOT consumed

    const good = await performPasswordReset(raw, "brand-new-pass-1");
    expect(good.ok).toBe(true);

    const after = await prisma.authAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(await verifyPassword(after.passwordHash, "brand-new-pass-1")).toBe(true);
    expect(await validateSessionToken(sessionToken)).toBeNull(); // sessions revoked

    const again = await performPasswordReset(raw, "another-pass-12");
    expect(again.ok).toBe(false); // single-use
  });
});
