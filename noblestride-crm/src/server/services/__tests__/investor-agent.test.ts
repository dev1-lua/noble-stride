import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  investorByEmail,
  matchInvestorsForTransaction,
  transactionTeaserContext,
  submitInvestorUpdate,
  logInvestorCommunication,
  confirmProposedChange,
  rejectProposedChange,
} from "@/server/services/investor-agent";

let dbUp = true;
async function checkDb() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbUp = false;
  }
}

// Fixture ids filled in beforeAll
let clientId = "";
let txnId = "";
let matchInvestorId = "";
let excludedInvestorId = "";
let pendingInvestorId = "";
let adminId = "";

beforeAll(async () => {
  await checkDb();
  if (!dbUp) return;
  const client = await prisma.client.create({
    data: { name: "ZZTest OutreachCo", sector: ["Healthcare"], countries: ["EastAfrica"] },
  });
  clientId = client.id;
  const txn = await prisma.transaction.create({
    data: {
      name: "ZZTest Outreach Deal",
      clientId,
      sector: ["Healthcare"],
      instrument: ["Equity"],
      targetRaise: 3_000_000,
    },
  });
  txnId = txn.id;
  const mk = (name: string, extra: object) =>
    prisma.investor.create({
      data: {
        name,
        investorType: "PrivateEquity",
        sectorFocus: ["Healthcare"],
        geographicFocus: ["EastAfrica"],
        instruments: ["Equity"],
        ticketMin: 1_000_000,
        ticketMax: 10_000_000,
        status: "ActivelyDeploying",
        ...extra,
      },
    });
  const inv = await mk("ZZTest Match Fund", {});
  matchInvestorId = inv.id;
  await prisma.person.create({
    data: { firstName: "Zara", lastName: "ZZTest", email: "zara@zztest-match.fund", investorId: inv.id, isPrimaryContact: true },
  });
  excludedInvestorId = (await mk("ZZTest Excluded Fund", { engagementClassification: "Excluded" })).id;
  pendingInvestorId = (await mk("ZZTest Pending Fund", { onboardingStatus: "PendingReview" })).id;
  adminId = (await prisma.user.create({ data: { name: "ZZTest Admin", email: "zzadmin@test.local", role: "Admin" } })).id;
});

afterAll(async () => {
  if (!dbUp) return;
  await prisma.investorProposedChange.deleteMany({ where: { summary: { startsWith: "ZZTest" } } });
  await prisma.task.deleteMany({ where: { title: { contains: "ZZTest" } } });
  await prisma.activity.deleteMany({ where: { subject: { contains: "ZZTest" } } });
  await prisma.person.deleteMany({ where: { lastName: "ZZTest" } });
  await prisma.transaction.deleteMany({ where: { name: { startsWith: "ZZTest" } } });
  await prisma.investor.deleteMany({ where: { name: { startsWith: "ZZTest" } } });
  await prisma.client.deleteMany({ where: { name: { startsWith: "ZZTest" } } });
  await prisma.user.deleteMany({ where: { email: "zzadmin@test.local" } });
});

describe("investorByEmail", () => {
  it("matches a contact email to its investor", async () => {
    if (!dbUp) return;
    const r = await investorByEmail("ZARA@zztest-match.fund");
    expect(r.matched).toBe(true);
    expect(r.investorId).toBe(matchInvestorId);
    expect(r.investorName).toBe("ZZTest Match Fund");
    expect(r.contactName).toBe("Zara ZZTest");
  });
  it("returns matched:false for unknown emails", async () => {
    if (!dbUp) return;
    expect((await investorByEmail("nobody@nowhere.example")).matched).toBe(false);
  });
  it("treats blocked/unapproved investors as unmatched", async () => {
    if (!dbUp) return;
    await prisma.person.create({
      data: { firstName: "Ex", lastName: "ZZTest", email: "ex@zztest-excluded.fund", investorId: excludedInvestorId },
    });
    expect((await investorByEmail("ex@zztest-excluded.fund")).matched).toBe(false);
  });
});

describe("matchInvestorsForTransaction", () => {
  it("returns eligible investors with reasons and never the blocked/unapproved ones", async () => {
    if (!dbUp) return;
    const matches = await matchInvestorsForTransaction(txnId);
    const ids = matches.map((m) => m.investorId);
    expect(ids).toContain(matchInvestorId);
    expect(ids).not.toContain(excludedInvestorId);
    expect(ids).not.toContain(pendingInvestorId);
    const m = matches.find((x) => x.investorId === matchInvestorId)!;
    expect(m.contactEmail).toBe("zara@zztest-match.fund");
    expect(m.matchReasons.length).toBeGreaterThan(0);
    expect(m.hasExistingEngagement).toBe(false);
  });
});

describe("transactionTeaserContext", () => {
  it("returns codename-level context only", async () => {
    if (!dbUp) return;
    const ctx = await transactionTeaserContext(txnId);
    expect(ctx.codename).toMatch(/^Project /);
    expect(ctx.codename).not.toContain("OutreachCo");
    expect(JSON.stringify(ctx)).not.toContain("ZZTest Outreach Deal");
    expect(JSON.stringify(ctx)).not.toContain("OutreachCo");
    expect(ctx.sectors).toContain("Healthcare");
    expect(ctx.contact).toContain("Noblestride Advisory");
  });
});

describe("submitInvestorUpdate", () => {
  it("creates a Pending proposed change plus a triage task, and never touches the investor row", async () => {
    if (!dbUp) return;
    const before = await prisma.investor.findUnique({ where: { id: matchInvestorId } });
    const r = await submitInvestorUpdate({
      investorId: matchInvestorId,
      proposedFields: { ticketMin: 2_000_000, sectorFocus: ["Healthcare", "Education"] },
      summary: "ZZTest raised minimum ticket to $2M and added Education",
      sourceEmail: "zara@zztest-match.fund",
    });
    expect(r.ok).toBe(true);
    const row = await prisma.investorProposedChange.findFirst({
      where: { investorId: matchInvestorId, status: "Pending" },
    });
    expect(row).toBeTruthy();
    expect(row!.createdSource).toBe("AGENT");
    const after = await prisma.investor.findUnique({ where: { id: matchInvestorId } });
    expect(String(after!.ticketMin)).toBe(String(before!.ticketMin)); // unchanged
    const task = await prisma.task.findFirst({ where: { investorId: matchInvestorId, title: { contains: "ZZTest Match Fund" } } });
    expect(task).toBeTruthy();
  });
  it("rejects non-whitelisted fields", async () => {
    if (!dbUp) return;
    await expect(
      submitInvestorUpdate({
        investorId: matchInvestorId,
        proposedFields: { onboardingStatus: "Approved" },
        summary: "ZZTest sneaky",
        sourceEmail: "zara@zztest-match.fund",
      }),
    ).rejects.toThrow(/not allowed/i);
  });
});

describe("confirm/reject proposed change", () => {
  it("confirm applies whitelisted fields via updateInvestor under the reviewer", async () => {
    if (!dbUp) return;
    const row = await prisma.investorProposedChange.findFirst({
      where: { investorId: matchInvestorId, status: "Pending" },
    });
    const actor = { type: "HUMAN" as const, authenticated: true, userId: adminId, orgRole: "Admin" as const, accountKind: "INTERNAL" as const };
    const r = await confirmProposedChange(row!.id, actor);
    expect(r.ok).toBe(true);
    const inv = await prisma.investor.findUnique({ where: { id: matchInvestorId } });
    expect(Number(inv!.ticketMin)).toBe(2_000_000);
    const updated = await prisma.investorProposedChange.findUnique({ where: { id: row!.id } });
    expect(updated!.status).toBe("Confirmed");
    expect(updated!.reviewedById).toBe(adminId);
  });
  it("reject leaves the investor untouched", async () => {
    if (!dbUp) return;
    await submitInvestorUpdate({
      investorId: matchInvestorId,
      proposedFields: { targetIrr: 25 },
      summary: "ZZTest IRR update",
      sourceEmail: "zara@zztest-match.fund",
    });
    const row = await prisma.investorProposedChange.findFirst({ where: { investorId: matchInvestorId, status: "Pending" } });
    const actor = { type: "HUMAN" as const, authenticated: true, userId: adminId, orgRole: "Admin" as const, accountKind: "INTERNAL" as const };
    await rejectProposedChange(row!.id, actor);
    const inv = await prisma.investor.findUnique({ where: { id: matchInvestorId } });
    expect(inv!.targetIrr).not.toBe(25);
  });
});

describe("logInvestorCommunication", () => {
  it("creates an inbound email Activity attributed to the agent", async () => {
    if (!dbUp) return;
    const r = await logInvestorCommunication({
      investorId: matchInvestorId,
      direction: "Inbound",
      interactionType: "Email",
      subject: "ZZTest criteria update note",
      summary: "Investor emailed an update to their ticket size.",
    });
    expect(r.ok).toBe(true);
    const act = await prisma.activity.findFirst({ where: { investorId: matchInvestorId, subject: "ZZTest criteria update note" } });
    expect(act!.channel).toBe("Email");
    expect(act!.direction).toBe("Inbound");
    expect(act!.createdSource).toBe("AGENT");
  });
});
