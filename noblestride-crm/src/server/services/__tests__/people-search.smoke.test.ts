// F3.3 / F3.4 against the real DB.
//
// The client's ask on image9 was "search a person and get their fund", so the
// tests check both halves: the people card finds the person, and the fund list
// itself now matches on a contact rather than only the legal entity name.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const UNIQ = `people-${Date.now()}`;
const FUND = `zz-Zanzibar Growth Partners ${UNIQ}`;
const OTHER_FUND = `zz-Unrelated Fund ${UNIQ}`;
const SURNAME = `Mwangeka${UNIQ.replace(/\D/g, "").slice(-6)}`;

let investorId: string;
let otherInvestorId: string;
let personId: string;

d("people search + onboarded date (DB)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const investor = await prisma.investor.create({
      data: {
        name: FUND,
        investorType: "PrivateEquity",
        onboardingStatus: "PendingReview",
        contacts: {
          create: [
            {
              firstName: "Grace",
              lastName: SURNAME,
              jobTitle: "Investment Director",
              email: `zz-grace-${UNIQ}@zzzanzibar.test`,
              phone: "+255700000001",
              isPrimaryContact: true,
            },
            {
              firstName: "Second",
              lastName: "Contact",
              email: `zz-second-${UNIQ}@zzzanzibar.test`,
            },
          ],
        },
      },
      include: { contacts: true },
    });
    investorId = investor.id;
    personId = investor.contacts.find((c) => c.lastName === SURNAME)!.id;

    const other = await prisma.investor.create({
      data: { name: OTHER_FUND, investorType: "VentureCapital", onboardingStatus: "Approved" },
    });
    otherInvestorId = other.id;
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.activity.deleteMany({ where: { investorId: { in: [investorId, otherInvestorId] } } });
    await prisma.person.deleteMany({ where: { investorId: { in: [investorId, otherInvestorId] } } });
    await prisma.investor.deleteMany({ where: { id: { in: [investorId, otherInvestorId] } } });
  });

  it("finds a person by surname fragment and reports their fund", async () => {
    const { searchInvestorPeople } = await import("../persons");
    const hits = await searchInvestorPeople(SURNAME.slice(0, 6));
    const hit = hits.find((h) => h.personId === personId);
    expect(hit).toMatchObject({
      name: `Grace ${SURNAME}`,
      jobTitle: "Investment Director",
      investorId,
      investorName: FUND,
      hasAccount: false,
    });
    expect(hit?.email).toContain("zz-grace");
  });

  it("finds a person by email fragment and by job title", async () => {
    const { searchInvestorPeople } = await import("../persons");
    expect((await searchInvestorPeople(`zz-grace-${UNIQ}`)).map((h) => h.personId)).toContain(personId);
    const byTitle = await searchInvestorPeople("Investment Director");
    expect(byTitle.map((h) => h.personId)).toContain(personId);
  });

  it("refuses a one-character query rather than returning a third of the address book", async () => {
    const { searchInvestorPeople } = await import("../persons");
    expect(await searchInvestorPeople("a")).toEqual([]);
    expect(await searchInvestorPeople(" ")).toEqual([]);
    expect(await searchInvestorPeople("")).toEqual([]);
  });

  it("the fund list itself matches on a contact, not only the entity name (F3.4)", async () => {
    const { listInvestors } = await import("../investors");
    const bySurname = await listInvestors({ search: SURNAME.slice(0, 6) });
    expect(bySurname.map((i) => i.id)).toContain(investorId);

    const byEmail = await listInvestors({ search: `zz-second-${UNIQ}` });
    expect(byEmail.map((i) => i.id)).toEqual([investorId]);

    // And still matches the fund's own name.
    const byName = await listInvestors({ search: "Zanzibar Growth" });
    expect(byName.map((i) => i.id)).toContain(investorId);
  });

  it("approving an investor stamps approvedAt, and a later rejection keeps it", async () => {
    const { prisma } = await import("@/lib/db");
    const { setOnboardingStatus } = await import("../investors");
    const actor = { type: "HUMAN" as const };

    const before = await prisma.investor.findUniqueOrThrow({ where: { id: investorId } });
    expect(before.approvedAt).toBeNull();

    await setOnboardingStatus(investorId, "Approved", actor);
    const approved = await prisma.investor.findUniqueOrThrow({ where: { id: investorId } });
    expect(approved.approvedAt).toBeInstanceOf(Date);

    // The historical fact survives a later status change.
    await setOnboardingStatus(investorId, "Rejected", actor);
    const rejected = await prisma.investor.findUniqueOrThrow({ where: { id: investorId } });
    expect(rejected.onboardingStatus).toBe("Rejected");
    expect(rejected.approvedAt?.getTime()).toBe(approved.approvedAt!.getTime());
  });

  it("filters and sorts by the onboarded date", async () => {
    const { prisma } = await import("@/lib/db");
    const { listInvestors } = await import("../investors");
    const stamped = await prisma.investor.findUniqueOrThrow({ where: { id: investorId } });
    const approvedAt = stamped.approvedAt!;

    const inRange = await listInvestors({
      search: SURNAME.slice(0, 6),
      approvedFrom: new Date(approvedAt.getTime() - 60_000),
      approvedTo: new Date(approvedAt.getTime() + 60_000),
    });
    expect(inRange.map((i) => i.id)).toContain(investorId);

    const outOfRange = await listInvestors({
      search: SURNAME.slice(0, 6),
      approvedFrom: new Date(approvedAt.getTime() + 60_000),
    });
    expect(outOfRange.map((i) => i.id)).not.toContain(investorId);

    // Newest first by default when sorting on the date.
    const sorted = await listInvestors({ sort: "approvedAt" });
    const dates = sorted.map((i) => i.approvedAt?.getTime() ?? -1).filter((t) => t > 0);
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });
});
