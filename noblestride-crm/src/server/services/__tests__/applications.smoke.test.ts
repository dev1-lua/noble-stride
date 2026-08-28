// F2.1/F2.3 (DB-backed). The tab predicates here also drive the sidebar badge
// and the dashboard callout, so the important assertion is not "the list works"
// but "the Awaiting count is the SAME number the dashboard shows" — those two
// disagreeing is exactly the kind of bug nobody notices until a client does.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const UNIQ = `apps-${Date.now()}`;
const COMPANY = {
  awaiting: `zz-Awaiting Co ${UNIQ}`,
  accepted: `zz-Accepted Co ${UNIQ}`,
  dropped: `zz-Dropped Co ${UNIQ}`,
  nonWebsite: `zz-Referral Co ${UNIQ}`,
};

let leadUserId: string;

async function makeApplication(
  company: string,
  opts: {
    source?: "Website" | "Referral";
    leadId?: string | null;
    dealStatus?: "Open" | "Dropped";
    createdSource?: "API" | "AGENT";
    contact?: { firstName: string; lastName?: string; email?: string; jobTitle?: string };
  } = {},
): Promise<string> {
  const { prisma } = await import("@/lib/db");
  const client = await prisma.client.create({
    data: {
      name: company,
      status: "Prospect",
      source: opts.source ?? "Website",
      ...(opts.contact
        ? { contacts: { create: { ...opts.contact, isPrimaryContact: true } } }
        : {}),
    },
  });
  const mandate = await prisma.mandate.create({
    data: {
      name: `${company} — Fundraising`,
      clientId: client.id,
      stage: "NewLead",
      source: opts.source ?? "Website",
      dealStatus: opts.dealStatus ?? "Open",
      leadId: opts.leadId ?? null,
      createdSource: opts.createdSource ?? "API",
      qualificationVerdict: "NeedsReview",
    },
  });
  return mandate.id;
}

d("applications service (DB)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const lead = await prisma.user.create({
      data: { name: `ZZ App Lead ${UNIQ}`, email: `zz-lead-${UNIQ}@noblestride.capital`, role: "DealLead" },
    });
    leadUserId = lead.id;
    await makeApplication(COMPANY.awaiting, {
      contact: {
        firstName: "Solomon",
        lastName: "Oulula",
        email: `zz-solomon-${UNIQ}@zzagri.co.ke`,
        jobTitle: "Managing Director",
      },
    });
    await makeApplication(COMPANY.accepted, { leadId: lead.id, createdSource: "AGENT" });
    await makeApplication(COMPANY.dropped, { dealStatus: "Dropped" });
    // Not a website application at all — must never appear.
    await makeApplication(COMPANY.nonWebsite, { source: "Referral" });
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.mandate.deleteMany({ where: { name: { contains: UNIQ } } });
    await prisma.person.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.client.deleteMany({ where: { name: { contains: UNIQ } } });
    await prisma.user.deleteMany({ where: { id: leadUserId } });
  });

  it("puts each application in exactly one tab and never lists non-website mandates", async () => {
    const { listApplications } = await import("../applications");
    const [awaiting, accepted, dropped] = await Promise.all([
      listApplications({ tab: "awaiting" }),
      listApplications({ tab: "accepted" }),
      listApplications({ tab: "dropped" }),
    ]);
    expect(awaiting.map((r) => r.company)).toContain(COMPANY.awaiting);
    expect(accepted.map((r) => r.company)).toContain(COMPANY.accepted);
    expect(dropped.map((r) => r.company)).toContain(COMPANY.dropped);

    const all = [...awaiting, ...accepted, ...dropped].map((r) => r.company);
    expect(all).not.toContain(COMPANY.nonWebsite);
    // No application appears in two tabs.
    expect(all.filter((c) => c === COMPANY.awaiting)).toHaveLength(1);
  });

  it("carries the applicant contact details the CRM was already storing (F2.3)", async () => {
    const { listApplications } = await import("../applications");
    const rows = await listApplications({ tab: "awaiting" });
    const row = rows.find((r) => r.company === COMPANY.awaiting);
    expect(row?.contact).toMatchObject({
      name: "Solomon Oulula",
      jobTitle: "Managing Director",
    });
    expect(row?.contact?.email).toContain("zz-solomon");
    expect(row?.statusLabel).toBe("Awaiting review");
    expect(row?.verdict).toBe("NeedsReview");
  });

  it("labels how the application arrived", async () => {
    const { listApplications } = await import("../applications");
    const [awaiting, accepted] = await Promise.all([
      listApplications({ tab: "awaiting" }),
      listApplications({ tab: "accepted" }),
    ]);
    expect(awaiting.find((r) => r.company === COMPANY.awaiting)?.via).toBe("Website form");
    expect(accepted.find((r) => r.company === COMPANY.accepted)?.via).toBe("Web chat");
  });

  it("searches company, contact name and contact email in one box", async () => {
    const { listApplications } = await import("../applications");
    expect((await listApplications({ tab: "awaiting", q: "Solomon" })).map((r) => r.company))
      .toContain(COMPANY.awaiting);
    expect((await listApplications({ tab: "awaiting", q: "zzagri.co.ke" })).map((r) => r.company))
      .toContain(COMPANY.awaiting);
    expect((await listApplications({ tab: "awaiting", q: "Awaiting Co" })).map((r) => r.company))
      .toContain(COMPANY.awaiting);
    expect(await listApplications({ tab: "awaiting", q: "zz-no-such-thing" })).toEqual([]);
  });

  it("the Awaiting count matches the dashboard's, byte for byte", async () => {
    const { applicationCounts } = await import("../applications");
    const { intakeAwaitingReviewCount } = await import("../dashboard");
    const counts = await applicationCounts();
    expect(counts.awaiting).toBe(await intakeAwaitingReviewCount());
    expect(counts.awaiting).toBeGreaterThan(0);
    expect(counts.accepted).toBeGreaterThan(0);
    expect(counts.dropped).toBeGreaterThan(0);
  });

  it("orders newest first", async () => {
    const { listApplications } = await import("../applications");
    const rows = await listApplications();
    const times = rows.map((r) => r.submittedAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});
