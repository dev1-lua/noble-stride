// Single-use auth tokens (password reset now, email verification later).
// Same hash-at-rest rule as sessions.

import type { AuthAccount, AuthTokenPurpose } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashToken } from "./session";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 60 min

export async function createAuthToken(
  accountId: string,
  purpose: AuthTokenPurpose,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.authToken.create({
    data: { tokenHash: hashToken(raw), accountId, purpose, expiresAt: new Date(Date.now() + ttlMs) },
  });
  return raw;
}

/** Marks the token used and returns its account, or null (unknown/expired/used/wrong purpose). */
export async function consumeAuthToken(raw: string, purpose: AuthTokenPurpose): Promise<AuthAccount | null> {
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { account: true },
  });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
  // Guard against concurrent consumption: only one updateMany can win.
  const claimed = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;
  return row.account;
}
