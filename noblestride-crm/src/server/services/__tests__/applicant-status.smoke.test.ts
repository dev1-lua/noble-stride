// The applicant OTP state machine and the applicant-facing projection (F2.4 /
// G1), against the real DB.
//
// The projection assertions are the important ones: this data goes to an
// anonymous caller who proved only that they can read one inbox, so the tests
// check what is ABSENT (file URLs, storage keys, investor identities) as
// carefully as what is present.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const UNIQ = `applicant-${Date.now()}`;
const EMAIL = `zz-applicant-${UNIQ}@zzapplicant.test`;
const OTHER_EMAIL = `zz-other-${UNIQ}@zzapplicant.test`;
const COMPANY = `zz-Applicant Co ${UNIQ}`;
const OTHER_COMPANY = `zz-Other Applicant Co ${UNIQ}`;

let clientId: string;
let investorId: string;

d("applicant status (DB)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    if (!process.env.AUTH_SECRET) process.env.AUTH_SECRET = "zz-applicant-smoke-secret-0123456789";

    const client = await prisma.client.create({
      data: {
        name: COMPANY,
        status: "Prospect",
        source: "Website",
        contacts: {
          create: {
            firstName: "Ada",
            lastName: "Applicant",
            email: EMAIL,
            isPrimaryContact: true,
          },
        },
        documents: {
          create: {
            name: "zz-pitch-deck.pdf",
            type: "PitchDeck",
            status: "UnderReview",
            accessLevel: "Internal",
            // A stored file, so the projection has something it must NOT leak.
            storageKey: "zz/secret/object/key.pdf",
            fileUrl: "https://storage.example.test/zz-secret",
          },
        },
      },
    });
    clientId = client.id;
    await prisma.mandate.create({
      data: {
        name: `${COMPANY} — Fundraising`,
        clientId: client.id,
        stage: "NewLead",
        source: "Website",
        dealStatus: "Open",
      },
    });

    // A second applicant's application, to prove the query is scoped by email.
    const other = await prisma.client.create({
      data: {
        name: OTHER_COMPANY,
        status: "Prospect",
        source: "Website",
        contacts: { create: { firstName: "Other", email: OTHER_EMAIL, isPrimaryContact: true } },
      },
    });
    await prisma.mandate.create({
      data: {
        name: `${OTHER_COMPANY} — Fundraising`,
        clientId: other.id,
        stage: "NewLead",
        source: "Website",
        dealStatus: "Open",
      },
    });

    const investor = await prisma.investor.create({
      data: { name: `zz-Interested Fund ${UNIQ}`, investorType: "PrivateEquity" },
    });
    investorId = investor.id;
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    const clients = await prisma.client.findMany({
      where: { name: { contains: UNIQ } },
      select: { id: true },
    });
    const ids = clients.map((c) => c.id);
    await prisma.engagement.deleteMany({ where: { investorId } });
    await prisma.document.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.transaction.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.mandate.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.person.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.client.deleteMany({ where: { id: { in: ids } } });
    await prisma.investor.deleteMany({ where: { id: investorId } });
    await prisma.applicantOtpChallenge.deleteMany({ where: { email: { contains: UNIQ } } });
  });

  it("issues one live challenge, and caps the window", async () => {
    const { prisma } = await import("@/lib/db");
    const { requestApplicantOtp, APPLICANT_OTP_MAX_PER_WINDOW } = await import("../applicant-status");

    await requestApplicantOtp(EMAIL);
    let live = await prisma.applicantOtpChallenge.count({ where: { email: EMAIL, usedAt: null } });
    expect(live).toBe(1);

    // Re-requesting supersedes rather than accumulating.
    await requestApplicantOtp(EMAIL);
    live = await prisma.applicantOtpChallenge.count({ where: { email: EMAIL, usedAt: null } });
    expect(live).toBe(1);

    // Past the cap, no new challenge is created — and the caller still gets ok.
    for (let i = 0; i < APPLICANT_OTP_MAX_PER_WINDOW + 2; i++) {
      expect(await requestApplicantOtp(EMAIL)).toEqual({ ok: true });
    }
    const total = await prisma.applicantOtpChallenge.count({ where: { email: EMAIL } });
    expect(total).toBeLessThanOrEqual(APPLICANT_OTP_MAX_PER_WINDOW);
  });

  it("returns { ok: true } for an email with no application (no enumeration oracle)", async () => {
    const { requestApplicantOtp } = await import("../applicant-status");
    expect(await requestApplicantOtp(`zz-nobody-${UNIQ}@nowhere.test`)).toEqual({ ok: true });
    expect(await requestApplicantOtp("")).toEqual({ ok: true });
  });

  it("verifies the emailed code once, and mints a token the verifier accepts", async () => {
    const { prisma } = await import("@/lib/db");
    const { requestApplicantOtp, verifyApplicantOtp, verifyApplicantToken } = await import("../applicant-status");
    const { readDevOtp } = await import("@/server/auth/dev-otp-sink");

    // The per-email rate limiter is already spent for EMAIL by the cap test
    // above, so the happy path runs against a fresh address — which also has to
    // become the contact on file, since the projection is keyed by email.
    const freshEmail = `zz-fresh-${UNIQ}@zzapplicant.test`;
    await prisma.applicantOtpChallenge.deleteMany({ where: { email: EMAIL } });
    await prisma.person.updateMany({ where: { clientId }, data: { email: freshEmail } });

    await requestApplicantOtp(freshEmail);
    const code = readDevOtp(freshEmail);
    expect(code).toMatch(/^\d{6}$/);

    expect(await verifyApplicantOtp(freshEmail, "000000")).toEqual({ status: "failed" });

    const ok = await verifyApplicantOtp(freshEmail, code!);
    if (ok.status !== "ok") throw new Error("expected the emailed code to verify");
    expect(await verifyApplicantToken(ok.token)).toEqual({ email: freshEmail });

    // Single use: replaying the same code fails.
    expect(await verifyApplicantOtp(freshEmail, code!)).toEqual({ status: "failed" });
  });

  it("lists only this applicant's applications, with a status and no leaked file paths", async () => {
    const { prisma } = await import("@/lib/db");
    const { listApplicationsForEmail } = await import("../applicant-status");
    const contact = await prisma.person.findFirstOrThrow({ where: { clientId } });

    const rows = await listApplicationsForEmail(contact.email!);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      company: COMPANY,
      status: "Awaiting review",
      statusDetail: "Awaiting review",
      interestCount: 0,
    });
    // The document is visible as a name/type/status, and nothing more.
    expect(rows[0]!.documents).toHaveLength(1);
    expect(rows[0]!.documents[0]).toMatchObject({ name: "zz-pitch-deck.pdf", typeLabel: "Pitch Deck" });
    const json = JSON.stringify(rows);
    expect(json).not.toContain("storageKey");
    expect(json).not.toContain("zz/secret/object/key.pdf");
    expect(json).not.toContain("storage.example.test");
    expect(json).not.toContain(OTHER_COMPANY);
  });

  it("reports investor interest as a count once accepted, never as identities", async () => {
    const { prisma } = await import("@/lib/db");
    const { listApplicationsForEmail } = await import("../applicant-status");
    const contact = await prisma.person.findFirstOrThrow({ where: { clientId } });
    const mandate = await prisma.mandate.findFirstOrThrow({ where: { clientId } });
    const lead = await prisma.user.create({
      data: { name: `ZZ Lead ${UNIQ}`, email: `zz-lead-${UNIQ}@noblestride.capital`, role: "DealLead" },
    });
    const txn = await prisma.transaction.create({
      data: {
        name: `${COMPANY} — Raise`,
        clientId,
        mandateId: mandate.id,
        stage: "InvestorOutreach",
      },
    });
    await prisma.engagement.create({
      data: { name: "zz-Interest", transactionId: txn.id, investorId, status: "Interested" },
    });
    await prisma.mandate.update({ where: { id: mandate.id }, data: { leadId: lead.id } });

    const rows = await listApplicationsForEmail(contact.email!);
    expect(rows[0]!.status).toBe("Accepted / In progress");
    expect(rows[0]!.interestCount).toBe(1);
    // The fund's name must never reach the applicant.
    expect(JSON.stringify(rows)).not.toContain("zz-Interested Fund");

    await prisma.user.deleteMany({ where: { id: lead.id } });
  });

  it("returns nothing for an unknown email rather than throwing", async () => {
    const { listApplicationsForEmail } = await import("../applicant-status");
    expect(await listApplicationsForEmail(`zz-nobody-${UNIQ}@nowhere.test`)).toEqual([]);
    expect(await listApplicationsForEmail("")).toEqual([]);
  });
});
