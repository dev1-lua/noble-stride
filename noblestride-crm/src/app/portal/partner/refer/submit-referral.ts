// submit-referral.ts — the testable core of the partner referral write-back.
// Plain server module (no "use server"): the server action in actions.ts is a
// thin wrapper that resolves the partner id from the viewpoint cookie and
// delegates here. Node test scripts can import and exercise this directly.

import { Sector, type Mandate } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createMandate } from "@/server/services/mandates";
import type { Actor } from "@/graphql/context";

/** Referrals arrive through the portal, not the internal UI → API provenance. */
const PORTAL_ACTOR: Actor = { type: "API", label: "partner-portal" };

export interface ReferralInput {
  companyName: string;
  /** Sector enum key from the vocab select; ignored if not a valid Sector. */
  sector?: string;
  /** Estimated deal size in USD. */
  dealSize?: number;
  /** Contact person at the referred company. */
  contactName?: string;
  /** Why is this a fit / free-text context from the partner. */
  context?: string;
}

/**
 * Create a referral on behalf of a partner:
 * 1. find the Client by case-insensitive exact name match, or create a
 *    minimal one (name + sector, createdSource API);
 * 2. create the Mandate through the Zod-validated createMandate service —
 *    mandateCreateSchema declares referredById, so the partner attribution
 *    goes through the service (no post-create patch needed). Stage defaults
 *    to NewLead ("introduced" in the referral lifecycle, spec §3.6);
 * 3. log a Note activity on the mandate for the internal team.
 *
 * `partnerId` must come from the server-side viewpoint cookie — callers must
 * never pass a client-supplied id.
 */
export async function submitReferral(partnerId: string, input: ReferralInput): Promise<Mandate> {
  const companyName = input.companyName.trim();
  if (!companyName) throw new Error("Company name is required");

  const sector =
    input.sector && (Object.values(Sector) as string[]).includes(input.sector)
      ? (input.sector as Sector)
      : undefined;

  let client = await prisma.client.findFirst({
    where: { name: { equals: companyName, mode: "insensitive" } },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: companyName,
        sector: sector ? [sector] : [],
        createdSource: "API",
      },
    });
  }

  const notes =
    [
      input.contactName?.trim() ? `Contact at company: ${input.contactName.trim()}` : null,
      input.context?.trim() ? `Partner context: ${input.context.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n") || undefined;

  const mandate = await createMandate(
    {
      name: `${companyName} – Referral`,
      clientId: client.id,
      referredById: partnerId,
      dealSize: input.dealSize,
      sector: sector ? [sector] : undefined,
      source: "Referral",
      notes,
    },
    PORTAL_ACTOR,
  );

  await prisma.activity.create({
    data: {
      type: "Note",
      subject: `Referral submitted via partner portal: ${companyName}`,
      mandateId: mandate.id,
      createdSource: "API",
    },
  });

  return mandate;
}
