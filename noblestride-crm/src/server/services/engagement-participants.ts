// F6b.4 (image31: "the investor can add onboarded colleagues as participants…
// The members need to be onboarded into the system for this to happen").
//
// Two hard rules, both enforced here rather than in the UI:
//   1. the engagement must belong to the investor doing the adding, and
//   2. the person must be a colleague at that same investor who already has an
//      ACTIVE portal account. "Onboarded" is not a formality — adding somebody
//      without an account would create a participant who can never see the deal,
//      and would let a fund register an arbitrary email against a live deal.
//
// Deviation from the plan: EngagementParticipant.addedById points at User, so a
// portal add (made by a Person, not staff) records no adder. Attributing it
// would need a schema change; the Activity row carries the fund's action either
// way. Flagged for the branch review.

import { prisma } from "@/lib/db";
import { isUniqueViolation } from "@/server/auth/accounts";
import { notify } from "./notifications";
import { staffRecipientsForEngagementId } from "./conversations";

export class ParticipantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParticipantError";
  }
}

export const NOT_ONBOARDED =
  "Only onboarded colleagues with portal access can be added. Invite them from the Team page first.";
const NOT_FOUND = "Not found.";
const PRIMARY_STAYS = "The primary contact always follows the deal.";

export interface ParticipantRow {
  id: string;
  personId: string;
  name: string;
  email: string | null;
  jobTitle: string | null;
  addedAt: Date;
  addedByName: string | null;
}

function personName(p: { firstName: string; lastName: string | null }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

const ROW_SELECT = {
  id: true,
  personId: true,
  createdAt: true,
  person: { select: { firstName: true, lastName: true, email: true, jobTitle: true } },
  addedBy: { select: { name: true } },
} as const;

type RawRow = {
  id: string;
  personId: string;
  createdAt: Date;
  person: { firstName: string; lastName: string | null; email: string | null; jobTitle: string | null };
  addedBy: { name: string } | null;
};

function toRow(r: RawRow): ParticipantRow {
  return {
    id: r.id,
    personId: r.personId,
    name: personName(r.person),
    email: r.person.email,
    jobTitle: r.person.jobTitle,
    addedAt: r.createdAt,
    addedByName: r.addedBy?.name ?? null,
  };
}

export async function listParticipants(engagementId: string): Promise<ParticipantRow[]> {
  const rows = await prisma.engagementParticipant.findMany({
    where: { engagementId },
    orderBy: { createdAt: "asc" },
    select: ROW_SELECT,
  });
  return rows.map(toRow);
}

/** Colleagues with portal access who are not already on this deal. */
export async function eligibleParticipants(
  engagementId: string,
  investorId: string,
): Promise<{ personId: string; name: string; email: string | null }[]> {
  const people = await prisma.person.findMany({
    where: {
      investorId,
      authAccount: { status: "ACTIVE" },
      engagementParticipations: { none: { engagementId } },
      // The primary contact follows every deal already (loadInvestorPipeline
      // treats them as following all of them), and removeParticipant refuses to
      // remove them. Offering them here — as the FIRST and therefore
      // pre-selected option — let an editor create a row whose Remove button
      // then failed permanently.
      isPrimaryContact: false,
    },
    orderBy: [{ firstName: "asc" }, { id: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  return people.map((p) => ({ personId: p.id, name: personName(p), email: p.email }));
}

export async function addParticipant(input: {
  engagementId: string;
  personId: string;
  investorId: string;
  addedByPersonId: string | null;
  addedByUserId: string | null;
}): Promise<ParticipantRow> {
  const engagement = await prisma.engagement.findFirst({
    where: { id: input.engagementId, investorId: input.investorId },
    select: {
      id: true,
      transactionId: true,
      investorId: true,
      investor: { select: { name: true } },
      transaction: { select: { name: true } },
    },
  });
  if (!engagement) throw new ParticipantError(NOT_FOUND);

  const person = await prisma.person.findFirst({
    where: { id: input.personId, investorId: engagement.investorId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      authAccount: { select: { status: true } },
    },
  });
  // Same refusal for "not your colleague" and "no portal account": a fund must
  // not learn from the error which of the two it hit.
  if (!person || person.authAccount?.status !== "ACTIVE") throw new ParticipantError(NOT_ONBOARDED);

  let row: RawRow;
  try {
    row = await prisma.engagementParticipant.create({
      data: {
        engagementId: engagement.id,
        personId: person.id,
        addedById: input.addedByUserId,
      },
      select: ROW_SELECT,
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Already a participant — idempotent, so a double submit is harmless.
    return toRow(
      await prisma.engagementParticipant.findFirstOrThrow({
        where: { engagementId: engagement.id, personId: person.id },
        select: ROW_SELECT,
      }),
    );
  }

  await prisma.activity.create({
    data: {
      type: "Note",
      channel: "Portal",
      direction: "Inbound",
      subject: `Participant added: ${personName(person)}`,
      engagementId: engagement.id,
      transactionId: engagement.transactionId,
      investorId: engagement.investorId,
      createdSource: "API",
    },
  });

  await notify(await staffRecipientsForEngagementId(engagement.id), {
    kind: "participant_added",
    title: `${engagement.investor.name} added ${personName(person)} to ${engagement.transaction.name}`,
    href: `/engagement/${engagement.id}#participants`,
  }).catch((err) => console.error("[participants] notification failed:", err));

  return toRow(row);
}

export async function removeParticipant(input: {
  engagementId: string;
  personId: string;
  investorId: string;
}): Promise<void> {
  const row = await prisma.engagementParticipant.findFirst({
    where: {
      engagementId: input.engagementId,
      personId: input.personId,
      engagement: { investorId: input.investorId },
    },
    select: {
      id: true,
      engagementId: true,
      person: { select: { firstName: true, lastName: true, isPrimaryContact: true } },
      engagement: { select: { transactionId: true, investorId: true } },
    },
  });
  if (!row) throw new ParticipantError(NOT_FOUND);
  if (row.person.isPrimaryContact) throw new ParticipantError(PRIMARY_STAYS);

  await prisma.engagementParticipant.delete({ where: { id: row.id } });
  await prisma.activity.create({
    data: {
      type: "Note",
      channel: "Portal",
      direction: "Inbound",
      subject: `Participant removed: ${personName(row.person)}`,
      engagementId: row.engagementId,
      transactionId: row.engagement.transactionId,
      investorId: row.engagement.investorId,
      createdSource: "API",
    },
  });
}

/** Engagement ids this person follows as a participant (F6b.4 `?mine=1`). */
export async function participantEngagementIds(personId: string): Promise<string[]> {
  const rows = await prisma.engagementParticipant.findMany({
    where: { personId },
    select: { engagementId: true },
  });
  return rows.map((r) => r.engagementId);
}
