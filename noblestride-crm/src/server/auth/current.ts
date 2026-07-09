// The single source of request identity (real-auth spec §7).
// getCurrentAuth: session cookie → account (+User / +Person+Investor).
// resolveViewpointFor: identity (+optional signed admin lens) → Viewpoint.

import { cache } from "react";
import { cookies } from "next/headers";
import type { AuthAccount, Investor, Person, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validateSessionToken } from "./session";
import { SESSION_COOKIE } from "./session-cookie";
import { verifyImpersonation } from "./impersonation";
import type { Viewpoint } from "@/lib/viewpoint";

export type CurrentAuth = {
  account: AuthAccount;
  user: User | null;
  person: (Person & { investor: Investor | null }) | null;
};

export const getCurrentAuth = cache(async (): Promise<CurrentAuth | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const validated = await validateSessionToken(token);
  if (!validated) return null;
  const { account } = validated;
  const [user, person] = await Promise.all([
    account.userId ? prisma.user.findUnique({ where: { id: account.userId } }) : null,
    account.personId
      ? prisma.person.findUnique({ where: { id: account.personId }, include: { investor: true } })
      : null,
  ]);
  return { account, user, person };
});

/** Derivation core — shared with the GraphQL context (which has no cookies()). */
export async function resolveViewpointFor(
  auth: CurrentAuth | null,
  impersonationJwt: string | undefined,
): Promise<Viewpoint | null> {
  if (!auth) return null;

  if (auth.account.kind === "INVESTOR") {
    const investorId = auth.person?.investorId;
    if (!investorId) return null; // orphaned account — treat as signed out
    return { role: "investor", recordId: investorId };
  }

  // INTERNAL
  const user = auth.user;
  if (!user || !user.isActive) return null;
  const base: Viewpoint =
    user.role === "Admin"
      ? { role: "admin", orgRole: "Admin" }
      : { role: "admin", orgRole: user.role, userId: user.id };

  if (user.role === "Admin" && impersonationJwt) {
    const lens = await verifyImpersonation(impersonationJwt);
    if (lens) return lens;
  }
  return base;
}
