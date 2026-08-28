// F6b.4 (image31): "the investor can add onboarded colleagues as participants…
// The members need to be onboarded into the system for this to happen."
//
// Against the real DB. The refusals are the point: a colleague without a portal
// account, and a person belonging to a different fund, must both bounce — and
// with the SAME message, so the error cannot be read as an existence oracle.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const UNIQ = `participants-${Date.now()}`;

let investorId: string;
let otherInvestorId: string;
let clientId: string;
let transactionId: string;
let engagementId: string;
let primaryPersonId: string;
let onboardedPersonId: string;
let noAccountPersonId: string;
let strangerPersonId: string;

async function hash(): Promise<string> {
  const { hashPassword } = await import("@/server/auth/password");
  return hashPassword("zz-Part!cipants-2026");
}

d("engagement participants (DB)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const passwordHash = await hash();

    const investor = await prisma.investor.create({
      data: { name: `zz-Participant Fund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "Approved" },
      select: { id: true },
    });
    investorId = investor.id;
    const other = await prisma.investor.create({
      data: { name: `zz-Other Fund ${UNIQ}`, investorType: "VentureCapital", onboardingStatus: "Approved" },
      select: { id: true },
    });
    otherInvestorId = other.id;

    const client = await prisma.client.create({ data: { name: `zz-Participant Client ${UNIQ}` }, select: { id: true } });
    clientId = client.id;
    const txn = await prisma.transaction.create({
      data: { name: `zz-Participant Deal ${UNIQ}`, clientId },
      select: { id: true },
    });
    transactionId = txn.id;

    const primary = await prisma.person.create({
      data: {
        firstName: "Prim",
        lastName: "Contact",
        email: `zz-primary-${UNIQ}@zzpart.test`,
        investorId,
        isPrimaryContact: true,
        portalRole: "Editor",
      },
      select: { id: true },
    });
    primaryPersonId = primary.id;
    await prisma.authAccount.create({
      data: { email: `zz-primary-${UNIQ}@zzpart.test`, kind: "INVESTOR", status: "ACTIVE", passwordHash, personId: primary.id },
    });

    const onboarded = await prisma.person.create({
      data: { firstName: "Onboarded", lastName: "Colleague", email: `zz-onboarded-${UNIQ}@zzpart.test`, investorId },
      select: { id: true },
    });
    onboardedPersonId = onboarded.id;
    await prisma.authAccount.create({
      data: { email: `zz-onboarded-${UNIQ}@zzpart.test`, kind: "INVESTOR", status: "ACTIVE", passwordHash, personId: onboarded.id },
    });

    // A colleague on file but never invited — image31's "need to be onboarded".
    const noAccount = await prisma.person.create({
      data: { firstName: "Not", lastName: "Onboarded", email: `zz-noacct-${UNIQ}@zzpart.test`, investorId },
      select: { id: true },
    });
    noAccountPersonId = noAccount.id;

    const stranger = await prisma.person.create({
      data: { firstName: "Some", lastName: "Stranger", email: `zz-stranger-${UNIQ}@zzpart.test`, investorId: otherInvestorId },
      select: { id: true },
    });
    strangerPersonId = stranger.id;
    await prisma.authAccount.create({
      data: { email: `zz-stranger-${UNIQ}@zzpart.test`, kind: "INVESTOR", status: "ACTIVE", passwordHash, personId: stranger.id },
    });
  });

  beforeEach(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.engagementParticipant.deleteMany({ where: { engagement: { investorId } } });
    await prisma.activity.deleteMany({ where: { investorId } });
    await prisma.engagement.deleteMany({ where: { investorId } });
    const engagement = await prisma.engagement.create({
      data: {
        name: `zz-Participant Engagement ${UNIQ}`,
        transactionId,
        investorId,
        engagementStage: "Shared",
        status: "Interested",
      },
      select: { id: true },
    });
    engagementId = engagement.id;
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.engagementParticipant.deleteMany({
      where: { engagement: { investorId: { in: [investorId, otherInvestorId] } } },
    });
    await prisma.activity.deleteMany({ where: { investorId: { in: [investorId, otherInvestorId] } } });
    await prisma.notification.deleteMany({ where: { investorId: { in: [investorId, otherInvestorId] } } });
    await prisma.engagement.deleteMany({ where: { investorId: { in: [investorId, otherInvestorId] } } });
    await prisma.transaction.deleteMany({ where: { clientId } });
    await prisma.authAccount.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.person.deleteMany({ where: { investorId: { in: [investorId, otherInvestorId] } } });
    await prisma.investor.deleteMany({ where: { id: { in: [investorId, otherInvestorId] } } });
    await prisma.client.delete({ where: { id: clientId } });
  });

  it("adds an onboarded colleague, and is idempotent", async () => {
    const { prisma } = await import("@/lib/db");
    const { addParticipant, listParticipants } = await import("../engagement-participants");

    const row = await addParticipant({
      engagementId,
      personId: onboardedPersonId,
      investorId,
      addedByPersonId: primaryPersonId,
      addedByUserId: null,
    });
    expect(row.name).toBe("Onboarded Colleague");
    expect(row.personId).toBe(onboardedPersonId);

    const again = await addParticipant({
      engagementId,
      personId: onboardedPersonId,
      investorId,
      addedByPersonId: primaryPersonId,
      addedByUserId: null,
    });
    expect(again.id).toBe(row.id);
    expect(await prisma.engagementParticipant.count({ where: { engagementId } })).toBe(1);
    expect((await listParticipants(engagementId)).map((p) => p.personId)).toEqual([onboardedPersonId]);
  });

  it("logs the addition on the deal timeline", async () => {
    const { prisma } = await import("@/lib/db");
    const { addParticipant } = await import("../engagement-participants");
    await addParticipant({
      engagementId,
      personId: onboardedPersonId,
      investorId,
      addedByPersonId: primaryPersonId,
      addedByUserId: null,
    });
    const activity = await prisma.activity.findFirst({
      where: { engagementId, subject: { startsWith: "Participant added" } },
    });
    expect(activity?.subject).toContain("Onboarded Colleague");
  });

  it("refuses a colleague who has no portal account", async () => {
    const { addParticipant, NOT_ONBOARDED } = await import("../engagement-participants");
    await expect(
      addParticipant({
        engagementId,
        personId: noAccountPersonId,
        investorId,
        addedByPersonId: primaryPersonId,
        addedByUserId: null,
      }),
    ).rejects.toThrow(NOT_ONBOARDED);
  });

  it("refuses a person from another fund — with the same message, so it is no oracle", async () => {
    const { addParticipant, NOT_ONBOARDED } = await import("../engagement-participants");
    await expect(
      addParticipant({
        engagementId,
        personId: strangerPersonId,
        investorId,
        addedByPersonId: primaryPersonId,
        addedByUserId: null,
      }),
    ).rejects.toThrow(NOT_ONBOARDED);
  });

  it("refuses an engagement that is not this fund's", async () => {
    const { addParticipant } = await import("../engagement-participants");
    await expect(
      addParticipant({
        engagementId,
        personId: onboardedPersonId,
        investorId: otherInvestorId,
        addedByPersonId: null,
        addedByUserId: null,
      }),
    ).rejects.toThrow(/Not found/);
  });

  it("lists only colleagues with portal access as eligible, and drops those already on", async () => {
    const { addParticipant, eligibleParticipants } = await import("../engagement-participants");

    const before = await eligibleParticipants(engagementId, investorId);
    const ids = before.map((p) => p.personId);
    // Reviewer finding: the primary contact used to be offered FIRST, and so was
    // pre-selected in the dropdown — but removeParticipant refuses to remove
    // them, so submitting the default created a row that could never be deleted.
    // They already follow every deal, so they are not offered at all.
    expect(ids).not.toContain(primaryPersonId);
    expect(ids).toContain(onboardedPersonId);
    expect(ids).not.toContain(noAccountPersonId);
    expect(ids).not.toContain(strangerPersonId);

    await addParticipant({
      engagementId,
      personId: onboardedPersonId,
      investorId,
      addedByPersonId: primaryPersonId,
      addedByUserId: null,
    });
    expect((await eligibleParticipants(engagementId, investorId)).map((p) => p.personId)).not.toContain(
      onboardedPersonId,
    );
  });

  it("removes a participant, but never the primary contact", async () => {
    const { prisma } = await import("@/lib/db");
    const { addParticipant, removeParticipant } = await import("../engagement-participants");

    // The service still refuses if a primary-contact row exists from before this
    // rule (the UI no longer offers one).
    await addParticipant({
      engagementId,
      personId: primaryPersonId,
      investorId,
      addedByPersonId: primaryPersonId,
      addedByUserId: null,
    });
    await expect(
      removeParticipant({ engagementId, personId: primaryPersonId, investorId }),
    ).rejects.toThrow(/primary contact/i);

    await addParticipant({
      engagementId,
      personId: onboardedPersonId,
      investorId,
      addedByPersonId: primaryPersonId,
      addedByUserId: null,
    });
    await removeParticipant({ engagementId, personId: onboardedPersonId, investorId });
    expect(await prisma.engagementParticipant.count({ where: { engagementId, personId: onboardedPersonId } })).toBe(0);
  });

  it("will not let another fund remove a participant", async () => {
    const { addParticipant, removeParticipant } = await import("../engagement-participants");
    await addParticipant({
      engagementId,
      personId: onboardedPersonId,
      investorId,
      addedByPersonId: primaryPersonId,
      addedByUserId: null,
    });
    await expect(
      removeParticipant({ engagementId, personId: onboardedPersonId, investorId: otherInvestorId }),
    ).rejects.toThrow(/Not found/);
  });

  it("participantEngagementIds returns the deals a person follows", async () => {
    const { addParticipant, participantEngagementIds } = await import("../engagement-participants");
    expect(await participantEngagementIds(onboardedPersonId)).toEqual([]);
    await addParticipant({
      engagementId,
      personId: onboardedPersonId,
      investorId,
      addedByPersonId: primaryPersonId,
      addedByUserId: null,
    });
    expect(await participantEngagementIds(onboardedPersonId)).toEqual([engagementId]);
  });
});
