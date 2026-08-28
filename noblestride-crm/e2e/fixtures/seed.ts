/**
 * e2e/fixtures/seed.ts — idempotent `zz-` fixtures for the Playwright suite.
 *
 * Runs against the restored-dump DB, so it must only ever ADD rows whose
 * name/email starts with `zz-` (cleanup.ts removes exactly those). It never
 * updates or deletes anything belonging to the real data.
 *
 * Usage: npm run e2e:seed   (globalSetup calls seedE2E() directly)
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/server/auth/password";
import { E2E_PASSWORD } from "../helpers/login";

export const PREFIX = "zz-";

const prisma = new PrismaClient();

export const IDS = {
  adminUser: "zze2eadminuser000000000001",
  memberUser: "zze2ememberuser0000000001",
  clientKenya: "zze2eclientkenya00000001",
  clientUganda: "zze2eclientuganda0000001",
  mandate: "zze2emandate000000000001",
  transaction: "zze2etransaction00000001",
  advisory: "zze2eadvisory000000000001",
  investor: "zze2einvestor000000000001",
  investorPerson: "zze2einvestorperson00001",
  // F6b.4: one colleague WITH portal access (addable as a participant) and one
  // without (image31: "the members need to be onboarded for this to happen").
  investorColleague: "zze2einvcolleague000001",
  investorNoAccount: "zze2einvnoaccount000001",
  // F5.6: a partner with a real portal login, and the deal they referred.
  partner: "zze2epartner000000000001",
  partnerPerson: "zze2epartnerperson000001",
  // F6b.1: a live deal deliberately OUTSIDE the investor's mandate, so "browse
  // all" has something to show that discovery would have hidden.
  offMandateClient: "zze2eoffmandclient000001",
  offMandateTransaction: "zze2eoffmandtxn000000001",
  engagement: "zze2eengagement000000001",
  // F2.1/F2.3: a website application, so the Applications queue and the
  // applicant block on the mandate page have something real to show. The
  // restored production dump contains no `source: "Website"` mandates.
  applicantClient: "zze2eapplicantclient0001",
  applicantMandate: "zze2eapplicantmandate001",
  applicantPerson: "zze2eapplicantperson0001",
  acceptedApplicantClient: "zze2eacceptedclient00001",
  acceptedApplicantMandate: "zze2eacceptedmandate0001",
  // F3.1: a registration still awaiting review, with its investment criteria
  // attached — so the review queue's "Criteria attached" badge is exercisable.
  pendingInvestor: "zze2ependinginvestor0001",
  pendingInvestorPerson: "zze2ependinginvperson001",
  pendingCriteriaDoc: "zze2ependingcriteria0001",
} as const;

export const EMAILS = {
  admin: "zz-e2e-admin@e2e.noblestride.test",
  member: "zz-e2e-member@e2e.noblestride.test",
  investor: "zz-e2e-investor@e2e.noblestride.test",
  investorColleague: "zz-e2e-colleague@e2e.noblestride.test",
  partner: "zz-e2e-partner@e2e.noblestride.test",
} as const;

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export async function seedE2E(): Promise<void> {
  const passwordHash = await hashPassword(E2E_PASSWORD);

  // ── staff accounts ────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: EMAILS.admin },
    update: { role: "Admin", isActive: true },
    create: { id: IDS.adminUser, name: "zz-E2E Admin", email: EMAILS.admin, role: "Admin", isActive: true },
  });
  await prisma.authAccount.upsert({
    where: { email: EMAILS.admin },
    update: { status: "ACTIVE", passwordHash, kind: "INTERNAL", userId: admin.id },
    create: { email: EMAILS.admin, kind: "INTERNAL", status: "ACTIVE", passwordHash, userId: admin.id, displayName: "zz-E2E Admin" },
  });

  const member = await prisma.user.upsert({
    where: { email: EMAILS.member },
    update: { role: "TeamMember", isActive: true },
    create: { id: IDS.memberUser, name: "zz-E2E Member", email: EMAILS.member, role: "TeamMember", isActive: true },
  });
  await prisma.authAccount.upsert({
    where: { email: EMAILS.member },
    update: { status: "ACTIVE", passwordHash, kind: "INTERNAL", userId: member.id },
    create: { email: EMAILS.member, kind: "INTERNAL", status: "ACTIVE", passwordHash, userId: member.id, displayName: "zz-E2E Member" },
  });

  // ── clients (F2.2 newest-first + F6.1 country/sector/revenue filters) ─────
  await prisma.client.upsert({
    where: { id: IDS.clientKenya },
    update: {},
    create: {
      id: IDS.clientKenya,
      name: "zz-E2E Client (Kenya)",
      sector: ["Agribusiness"],
      hqCountry: "Kenya",
      hqCity: "Nairobi",
      countries: ["EastAfrica"],
      revenueLastYear: 2_500_000,
      projectCodename: "zz-Project Kite",
      codename: "zz-Project Kite",
      status: "Active",
    },
  });
  await prisma.client.upsert({
    where: { id: IDS.clientUganda },
    update: {},
    create: {
      id: IDS.clientUganda,
      name: "zz-E2E Client (Uganda)",
      sector: ["Technology"],
      hqCountry: "Uganda",
      hqCity: "Kampala",
      countries: ["EastAfrica"],
      revenueLastYear: 250_000,
      createdAt: daysAgo(2),
      status: "Prospect",
    },
  });

  // ── mandate (retainer 50k / paid 20k, NDA signed → ndaSigned evidence) ────
  await prisma.mandate.upsert({
    where: { id: IDS.mandate },
    update: {},
    create: {
      id: IDS.mandate,
      name: "zz-E2E Mandate",
      clientId: IDS.clientKenya,
      leadId: admin.id,
      stage: "Qualification",
      ndaStatus: "Signed",
      ndaSignedDate: daysAgo(10),
      retainerAmount: 50_000,
      retainerPaidAmount: 20_000,
      sector: ["Agribusiness"],
      source: "Referral",
    },
  });

  // ── partner with a portal login (F5.6) ───────────────────────────────────
  await prisma.partner.upsert({
    where: { id: IDS.partner },
    update: {},
    create: {
      id: IDS.partner,
      name: "zz-E2E Partner",
      advisorType: "TransactionAdvisor",
      feeSharingAgreement: true,
      feeSharingTerms: "25% of the advisory success fee on referred mandates.",
      partnerAgreementStatus: "Signed",
    },
  });
  await prisma.person.upsert({
    where: { id: IDS.partnerPerson },
    update: {},
    create: {
      id: IDS.partnerPerson,
      firstName: "zz-E2E",
      lastName: "Partner Contact",
      email: EMAILS.partner,
      partnerId: IDS.partner,
      isPrimaryContact: true,
    },
  });
  await prisma.authAccount.upsert({
    where: { email: EMAILS.partner },
    update: { status: "ACTIVE", passwordHash, kind: "PARTNER", personId: IDS.partnerPerson },
    create: {
      email: EMAILS.partner,
      kind: "PARTNER",
      status: "ACTIVE",
      passwordHash,
      personId: IDS.partnerPerson,
    },
  });
  // The referral link the partner portal reports on.
  await prisma.mandate.update({ where: { id: IDS.mandate }, data: { referredById: IDS.partner } });

  // ── website applications (F2.1/F2.3) ─────────────────────────────────────
  // One awaiting review with a full applicant contact, one already accepted, so
  // both tabs and the Applicant block are exercisable.
  await prisma.client.upsert({
    where: { id: IDS.applicantClient },
    update: {},
    create: {
      id: IDS.applicantClient,
      name: "zz-E2E Applicant (Website)",
      status: "Prospect",
      source: "Website",
      sector: ["Agribusiness"],
      hqCountry: "Kenya",
      contacts: {
        create: {
          id: IDS.applicantPerson,
          firstName: "Solomon",
          lastName: "Oulula",
          jobTitle: "Managing Director",
          email: "zz-solomon@e2e-applicant.test",
          phone: "+254700000111",
          isPrimaryContact: true,
        },
      },
    },
  });
  await prisma.mandate.upsert({
    where: { id: IDS.applicantMandate },
    update: {},
    create: {
      id: IDS.applicantMandate,
      name: "zz-E2E Applicant (Website) — Fundraising",
      clientId: IDS.applicantClient,
      stage: "NewLead",
      source: "Website",
      dealStatus: "Open",
      leadId: null,
      dealSize: 1_500_000,
      qualificationVerdict: "NeedsReview",
      qualificationReasons: ["Revenue below the usual threshold"],
      qualifiedAt: daysAgo(1),
      createdSource: "API",
    },
  });
  await prisma.client.upsert({
    where: { id: IDS.acceptedApplicantClient },
    update: {},
    create: {
      id: IDS.acceptedApplicantClient,
      name: "zz-E2E Applicant Accepted (Web chat)",
      status: "Prospect",
      source: "Website",
      hqCountry: "Uganda",
    },
  });
  await prisma.mandate.upsert({
    where: { id: IDS.acceptedApplicantMandate },
    update: {},
    create: {
      id: IDS.acceptedApplicantMandate,
      name: "zz-E2E Applicant Accepted — Fundraising",
      clientId: IDS.acceptedApplicantClient,
      stage: "Qualification",
      source: "Website",
      dealStatus: "Open",
      leadId: admin.id,
      // AGENT provenance is what makes the row read "Web chat".
      createdSource: "AGENT",
      qualificationVerdict: "Qualified",
    },
  });

  // ── transaction (own workflow; VDR link → opportunityPreparation evidence) ─
  await prisma.transaction.upsert({
    where: { id: IDS.transaction },
    update: {},
    create: {
      id: IDS.transaction,
      name: "zz-E2E Transaction",
      clientId: IDS.clientKenya,
      mandateId: IDS.mandate,
      ownerId: admin.id,
      stage: "InvestorOutreach",
      vdrLink: "https://vdr.example.test/zz",
      targetRaise: 5_000_000,
      successFeeAmount: 100_000,
      sector: ["Agribusiness"],
    },
  });

  // ── F6b.1: a live deal the investor's mandate does NOT match ─────────────
  // Manufacturing / West Africa against a fund focused on Agribusiness in East
  // Africa. Before the F6b.1 widening this deal was invisible to the investor;
  // it is what makes "Browse all" demonstrably different from "Matches my
  // mandate".
  await prisma.client.upsert({
    where: { id: IDS.offMandateClient },
    update: {},
    create: {
      id: IDS.offMandateClient,
      name: "zz-E2E Offmandate Client",
      sector: ["Manufacturing"],
      hqCountry: "Ghana",
      countries: ["WestAfrica"],
      revenueLastYear: 9_000_000,
      projectCodename: "zz-Project Tamarind",
      codename: "zz-Project Tamarind",
      status: "Active",
    },
  });
  await prisma.transaction.upsert({
    where: { id: IDS.offMandateTransaction },
    update: {},
    create: {
      id: IDS.offMandateTransaction,
      name: "zz-E2E Offmandate Transaction",
      clientId: IDS.offMandateClient,
      ownerId: admin.id,
      stage: "InvestorOutreach",
      targetRaise: 12_000_000,
      sector: ["Manufacturing"],
    },
  });

  // ── advisory (F4.2.1 classification + fee paid/balance) ──────────────────
  await prisma.advisoryEngagement.upsert({
    where: { id: IDS.advisory },
    update: {},
    create: {
      id: IDS.advisory,
      name: "zz-E2E Advisory",
      clientId: IDS.clientUganda,
      leadId: admin.id,
      stage: "Proposal",
      classification: "Valuation",
      feeAmount: 10_000,
      feePaidAmount: 2_500,
      sector: ["Technology"],
    },
  });

  // ── investor + engagement (investorOutreach / investorInterest evidence) ──
  await prisma.investor.upsert({
    where: { id: IDS.investor },
    update: {},
    create: {
      id: IDS.investor,
      name: "zz-E2E Investor",
      investorType: "PrivateEquity",
      onboardingStatus: "Approved",
      engagementClassification: "Active",
      ndaStatus: "None",
      sectorFocus: ["Agribusiness"],
      geographicFocus: ["EastAfrica"],
    },
  });
  // ── a PendingReview registration with criteria attached (F3.1 / image6) ───
  await prisma.investor.upsert({
    where: { id: IDS.pendingInvestor },
    update: {},
    create: {
      id: IDS.pendingInvestor,
      name: "zz-E2E Pending Fund",
      investorType: "VentureCapital",
      onboardingStatus: "PendingReview",
      registeredAt: daysAgo(1),
      sectorFocus: ["Technology"],
      geographicFocus: ["EastAfrica"],
      contacts: {
        create: {
          id: IDS.pendingInvestorPerson,
          firstName: "Pending",
          lastName: "Contact",
          email: "zz-pending-contact@e2e.noblestride.test",
          isPrimaryContact: true,
        },
      },
      documents: {
        create: {
          id: IDS.pendingCriteriaDoc,
          name: "zz-E2E investment-criteria.pdf",
          type: "InvestmentCriteria",
          accessLevel: "Internal",
          status: "UnderReview",
        },
      },
    },
  });

  await prisma.person.upsert({
    where: { id: IDS.investorPerson },
    update: {},
    create: {
      id: IDS.investorPerson,
      firstName: "zz-E2E",
      lastName: "Investor Contact",
      email: EMAILS.investor,
      investorId: IDS.investor,
      isPrimaryContact: true,
      portalRole: "Editor",
    },
  });
  await prisma.authAccount.upsert({
    where: { email: EMAILS.investor },
    update: { status: "ACTIVE", passwordHash, kind: "INVESTOR", personId: IDS.investorPerson },
    create: { email: EMAILS.investor, kind: "INVESTOR", status: "ACTIVE", passwordHash, personId: IDS.investorPerson },
  });

  // F6b.4 fixtures: an onboarded colleague, and one who was never invited.
  await prisma.person.upsert({
    where: { id: IDS.investorColleague },
    update: {},
    create: {
      id: IDS.investorColleague,
      firstName: "zz-E2E",
      lastName: "Colleague",
      email: EMAILS.investorColleague,
      investorId: IDS.investor,
      portalRole: "Viewer",
    },
  });
  await prisma.authAccount.upsert({
    where: { email: EMAILS.investorColleague },
    update: { status: "ACTIVE", passwordHash, kind: "INVESTOR", personId: IDS.investorColleague },
    create: {
      email: EMAILS.investorColleague,
      kind: "INVESTOR",
      status: "ACTIVE",
      passwordHash,
      personId: IDS.investorColleague,
    },
  });
  await prisma.person.upsert({
    where: { id: IDS.investorNoAccount },
    update: {},
    create: {
      id: IDS.investorNoAccount,
      firstName: "zz-E2E",
      lastName: "Not Onboarded",
      email: "zz-e2e-not-onboarded@e2e.noblestride.test",
      investorId: IDS.investor,
      portalRole: "Viewer",
    },
  });
  await prisma.engagement.upsert({
    where: { id: IDS.engagement },
    update: {},
    create: {
      id: IDS.engagement,
      name: "zz-E2E Engagement",
      transactionId: IDS.transaction,
      investorId: IDS.investor,
      status: "Interested",
      engagementStage: "Shared",
    },
  });
}

// CLI entry. Deliberately NOT an `import.meta.url` check: Playwright loads
// these TS modules as CJS (globalSetup/globalTeardown), where import.meta is a
// syntax error. Comparing the invoked script path works in both loaders.
const invokedDirectly = process.argv[1]?.endsWith("seed.ts") ?? false;
if (invokedDirectly) {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(".env");
    } catch {
      /* handled below */
    }
  }
  seedE2E()
    .then(() => console.log("e2e fixtures seeded"))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
