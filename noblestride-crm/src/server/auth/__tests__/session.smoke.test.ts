import { afterAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("auth session store (DB)", () => {
  const cleanupEmails = ["zz-test-session-UNIQ@example-authtest.com"];

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: { in: cleanupEmails } } });
  });

  async function makeAccount() {
    const { prisma } = await import("@/lib/db");
    return prisma.authAccount.upsert({
      where: { email: cleanupEmails[0] },
      create: { email: cleanupEmails[0], passwordHash: "x", kind: "INVESTOR", status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
  }

  it("creates and validates a session; raw token is not stored", async () => {
    const { prisma } = await import("@/lib/db");
    const { createSession, validateSessionToken, hashToken } = await import("../session");
    const account = await makeAccount();
    const { token } = await createSession(account.id);
    expect(token.length).toBeGreaterThanOrEqual(40);
    const stored = await prisma.authSession.findUnique({ where: { tokenHash: hashToken(token) } });
    expect(stored).not.toBeNull();
    expect(stored!.tokenHash).not.toBe(token);
    const validated = await validateSessionToken(token);
    expect(validated?.account.id).toBe(account.id);
  });

  it("rejects unknown and expired tokens", async () => {
    const { prisma } = await import("@/lib/db");
    const { createSession, validateSessionToken, hashToken } = await import("../session");
    expect(await validateSessionToken("no-such-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
    const account = await makeAccount();
    const { token } = await createSession(account.id);
    await prisma.authSession.update({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await validateSessionToken(token)).toBeNull();
    // expired row is deleted
    expect(await prisma.authSession.findUnique({ where: { tokenHash: hashToken(token) } })).toBeNull();
  });

  it("rejects sessions of non-ACTIVE accounts and invalidateAllSessions works", async () => {
    const { prisma } = await import("@/lib/db");
    const { createSession, validateSessionToken, invalidateAllSessions } = await import("../session");
    const account = await makeAccount();
    const { token } = await createSession(account.id);
    await prisma.authAccount.update({ where: { id: account.id }, data: { status: "SUSPENDED" } });
    expect(await validateSessionToken(token)).toBeNull();
    await prisma.authAccount.update({ where: { id: account.id }, data: { status: "ACTIVE" } });
    const { token: token2 } = await createSession(account.id);
    await invalidateAllSessions(account.id);
    expect(await validateSessionToken(token2)).toBeNull();
  });

  it("reset tokens are single-use and purpose-scoped", async () => {
    const { createAuthToken, consumeAuthToken } = await import("../tokens");
    const account = await makeAccount();
    const raw = await createAuthToken(account.id, "RESET_PASSWORD");
    expect(await consumeAuthToken(raw, "VERIFY_EMAIL")).toBeNull(); // wrong purpose
    const consumed = await consumeAuthToken(raw, "RESET_PASSWORD");
    expect(consumed?.id).toBe(account.id);
    expect(await consumeAuthToken(raw, "RESET_PASSWORD")).toBeNull(); // single-use
  });
});
