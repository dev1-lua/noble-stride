// DB-backed sessions (Lucia pattern): opaque 256-bit token in the cookie,
// sha256 hash at rest. Sliding renewal. Next-free so vitest can import it.

import { createHash, randomBytes } from "node:crypto";
import type { AuthAccount, AuthSession } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RENEW_WHEN_REMAINING_MS = 15 * 24 * 60 * 60 * 1000; // extend when < 15 days left
const TOUCH_INTERVAL_MS = 60 * 60 * 1000; // bump lastUsedAt at most hourly

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createSession(
  accountId: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await prisma.authSession.create({
    data: { tokenHash: hashToken(token), accountId, expiresAt, ip: meta?.ip, userAgent: meta?.userAgent },
  });
  return { token, expiresAt };
}

export type ValidatedSession = { session: AuthSession; account: AuthAccount };

export async function validateSessionToken(token: string): Promise<ValidatedSession | null> {
  const row = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { account: true },
  });
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await prisma.authSession.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  if (row.account.status !== "ACTIVE") return null;

  const updates: { expiresAt?: Date; lastUsedAt?: Date } = {};
  if (row.expiresAt.getTime() - now < RENEW_WHEN_REMAINING_MS) {
    updates.expiresAt = new Date(now + SESSION_LIFETIME_MS);
  }
  if (now - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    updates.lastUsedAt = new Date(now);
  }
  if (Object.keys(updates).length > 0) {
    await prisma.authSession.update({ where: { id: row.id }, data: updates }).catch(() => {});
    if (updates.expiresAt) row.expiresAt = updates.expiresAt;
  }
  const { account, ...session } = row;
  return { session, account };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { id: sessionId } });
}

export async function invalidateAllSessions(accountId: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { accountId } });
}
