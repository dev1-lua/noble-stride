// resolve-login.ts — testable core of the dummy /login flow.
// DEMO ONLY: this maps an email to a viewpoint lens; there are no credentials
// and no sessions (see repo:memory/remaining-tasks.md — real auth pending).
// Lookup order (landing spec §6): investor contact → partner contact →
// noblestride.* team domain → unknown.

import { prisma } from "@/lib/db";

export type LoginResolution =
  | { kind: "investor"; recordId: string }
  | { kind: "partner"; recordId: string }
  | { kind: "admin" }
  | { kind: "unknown" };

/** DEMO ONLY — team membership by corporate domain, not a directory. */
export function isTeamEmail(email: string): boolean {
  return /@noblestride\.[a-z]{2,}(\.[a-z]{2,})?$/i.test(email.trim());
}

export async function resolveLogin(email: string): Promise<LoginResolution> {
  const norm = email.trim();
  if (!norm) return { kind: "unknown" };

  const investorContact = await prisma.person.findFirst({
    where: { email: { equals: norm, mode: "insensitive" }, investorId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (investorContact?.investorId) return { kind: "investor", recordId: investorContact.investorId };

  const partnerContact = await prisma.person.findFirst({
    where: { email: { equals: norm, mode: "insensitive" }, partnerId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (partnerContact?.partnerId) return { kind: "partner", recordId: partnerContact.partnerId };

  if (isTeamEmail(norm)) return { kind: "admin" };
  return { kind: "unknown" };
}
