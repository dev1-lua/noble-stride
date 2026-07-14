import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  saveOutreachDrafts,
  listOutreachQueue,
  updateOutreachDraft,
  rejectOutreachDraft,
  sendOutreachDraft,
} from "@/server/services/outreach";

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
let investorId = "";
let personId = "";
let investor2Id = "";
let person2Id = "";
let investor3Id = "";
let person3Id = "";
let investor4Id = "";
let person4Id = "";
let investor5Id = "";
let person5Id = "";
let investor6Id = "";
let person6Id = "";
let investor7Id = "";
let person7Id = "";
let adminId = "";
let dealLeadId = "";
let otherLeadId = "";
let teamMemberId = "";

beforeAll(async () => {
  await checkDb();
  if (!dbUp) return;

  adminId = (
    await prisma.user.create({ data: { name: "ZZTest Admin", email: "zzadmin@outreach.test.local", role: "Admin" } })
  ).id;
  dealLeadId = (
    await prisma.user.create({
      data: { name: "ZZTest DealLead", email: "zzlead@outreach.test.local", role: "DealLead" },
    })
  ).id;
  otherLeadId = (
    await prisma.user.create({
      data: { name: "ZZTest OtherLead", email: "zzotherlead@outreach.test.local", role: "DealLead" },
    })
  ).id;
  teamMemberId = (
    await prisma.user.create({
      data: { name: "ZZTest TeamMember", email: "zzteam@outreach.test.local", role: "TeamMember" },
    })
  ).id;

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
      ownerId: dealLeadId,
    },
  });
  txnId = txn.id;

  const mkInvestor = (name: string) =>
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
      },
    });

  const inv1 = await mkInvestor("ZZTest Outreach Fund 1");
  investorId = inv1.id;
  personId = (
    await prisma.person.create({
      data: { firstName: "Ivy", lastName: "ZZTest", email: "ivy@zztest-outreach.fund", investorId, isPrimaryContact: true },
    })
  ).id;

  const inv2 = await mkInvestor("ZZTest Outreach Fund 2");
  investor2Id = inv2.id;
  person2Id = (
    await prisma.person.create({
      data: {
        firstName: "Jo",
        lastName: "ZZTest",
        email: "jo@zztest-outreach.fund",
        investorId: investor2Id,
        isPrimaryContact: true,
      },
    })
  ).id;

  const inv3 = await mkInvestor("ZZTest Outreach Fund 3");
  investor3Id = inv3.id;
  person3Id = (
    await prisma.person.create({
      data: {
        firstName: "Kim",
        lastName: "ZZTest",
        email: "kim@zztest-outreach.fund",
        investorId: investor3Id,
        isPrimaryContact: true,
      },
    })
  ).id;

  const inv4 = await mkInvestor("ZZTest Outreach Fund 4");
  investor4Id = inv4.id;
  person4Id = (
    await prisma.person.create({
      data: {
        firstName: "Lee",
        lastName: "ZZTest",
        email: "lee@zztest-outreach.fund",
        investorId: investor4Id,
        isPrimaryContact: true,
      },
    })
  ).id;

  const inv5 = await mkInvestor("ZZTest Outreach Fund 5");
  investor5Id = inv5.id;
  person5Id = (
    await prisma.person.create({
      data: {
        firstName: "Mo",
        lastName: "ZZTest",
        email: "mo@zztest-outreach.fund",
        investorId: investor5Id,
        isPrimaryContact: true,
      },
    })
  ).id;

  const inv6 = await mkInvestor("ZZTest Outreach Fund 6");
  investor6Id = inv6.id;
  person6Id = (
    await prisma.person.create({
      data: {
        firstName: "Nia",
        lastName: "ZZTest",
        email: "nia@zztest-outreach.fund",
        investorId: investor6Id,
        isPrimaryContact: true,
      },
    })
  ).id;

  const inv7 = await mkInvestor("ZZTest Outreach Fund 7");
  investor7Id = inv7.id;
  person7Id = (
    await prisma.person.create({
      data: {
        firstName: "Omar",
        lastName: "ZZTest",
        email: "omar@zztest-outreach.fund",
        investorId: investor7Id,
        isPrimaryContact: true,
      },
    })
  ).id;
});

afterAll(async () => {
  if (!dbUp) return;
  await prisma.outreachDraft.deleteMany({ where: { transactionId: txnId } });
  await prisma.activity.deleteMany({ where: { transactionId: txnId } });
  await prisma.engagement.deleteMany({ where: { transactionId: txnId } });
  await prisma.person.deleteMany({ where: { lastName: "ZZTest" } });
  await prisma.transaction.deleteMany({ where: { name: { startsWith: "ZZTest" } } });
  await prisma.investor.deleteMany({ where: { name: { startsWith: "ZZTest" } } });
  await prisma.client.deleteMany({ where: { name: { startsWith: "ZZTest" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "outreach.test.local" } } });
  delete process.env.LUA_AGENT_ID;
  delete process.env.LUA_API_KEY;
  delete process.env.LUA_EMAIL_CHANNEL_ID;
  delete process.env.LUA_API_BASE_URL;
});

const okFetch = vi.fn(async (_url?: string | URL | Request, _init?: RequestInit) =>
  new Response(JSON.stringify({ ok: true }), { status: 200 }),
);
const failFetch = vi.fn(async (_url?: string | URL | Request, _init?: RequestInit) =>
  new Response("boom", { status: 502 }),
);

describe("saveOutreachDrafts", () => {
  it("creates drafts and skips duplicates on re-run", async () => {
    if (!dbUp) return;
    const drafts = [{ investorId, personId, subject: "ZZTest intro", body: "Hello", matchRationale: "sector" }];
    const first = await saveOutreachDrafts(txnId, drafts);
    expect(first).toMatchObject({ ok: true, created: 1, skipped: 0 });
    const second = await saveOutreachDrafts(txnId, drafts);
    expect(second).toMatchObject({ ok: true, created: 0, skipped: 1 });
  });

  it("lists queued drafts via listOutreachQueue", async () => {
    if (!dbUp) return;
    const queue = await listOutreachQueue();
    const item = queue.find((q) => q.investorId === investorId);
    expect(item).toBeTruthy();
    expect(item!.status).toBe("Draft");
  });

  it("a Failed draft blocks a duplicate save for the same deal x investor pair", async () => {
    if (!dbUp) return;
    // Self-contained: uses investor2Id but cleans up after itself so the later
    // "HTTP failure marks the draft Failed and allows retry" test (which also
    // uses investor2Id) starts from a clean slate.
    await prisma.outreachDraft.deleteMany({ where: { investorId: investor2Id } });
    const drafts = [
      { investorId: investor2Id, personId: person2Id, subject: "ZZTest failed-dedup", body: "Hi", matchRationale: "geo" },
    ];
    const first = await saveOutreachDrafts(txnId, drafts);
    expect(first).toMatchObject({ ok: true, created: 1, skipped: 0 });
    const created = await prisma.outreachDraft.findFirst({ where: { investorId: investor2Id, transactionId: txnId } });
    expect(created).toBeTruthy();
    await prisma.outreachDraft.update({ where: { id: created!.id }, data: { status: "Failed", error: "simulated failure" } });

    const second = await saveOutreachDrafts(txnId, drafts);
    expect(second).toMatchObject({ ok: true, created: 0, skipped: 1 });

    await prisma.outreachDraft.deleteMany({ where: { investorId: investor2Id } });
  });
});

describe("RBAC", () => {
  it("team member cannot send or reject", async () => {
    if (!dbUp) return;
    const draft = await prisma.outreachDraft.findFirst({ where: { transactionId: txnId } });
    await expect(
      sendOutreachDraft(draft!.id, { orgRole: "TeamMember", userId: teamMemberId }),
    ).rejects.toThrow(/not authorized/i);
    await expect(
      rejectOutreachDraft(draft!.id, { orgRole: "TeamMember", userId: teamMemberId }),
    ).rejects.toThrow(/not authorized/i);
  });
  it("a deal lead who does not own the deal cannot send", async () => {
    if (!dbUp) return;
    const draft = await prisma.outreachDraft.findFirst({ where: { transactionId: txnId } });
    await expect(
      sendOutreachDraft(draft!.id, { orgRole: "DealLead", userId: otherLeadId }),
    ).rejects.toThrow(/not authorized/i);
  });
});

describe("sendOutreachDraft", () => {
  it("owner sends: draft -> Sent, Activity logged, Engagement upserted at Shared", async () => {
    if (!dbUp) return;
    process.env.LUA_AGENT_ID = "agent_test";
    process.env.LUA_API_KEY = "key_test";
    process.env.LUA_EMAIL_CHANNEL_ID = "chan-uuid";
    const draft = await prisma.outreachDraft.findFirst({ where: { transactionId: txnId, status: "Draft" } });
    const r = await sendOutreachDraft(
      draft!.id,
      { orgRole: "DealLead", userId: dealLeadId },
      { fetchFn: okFetch as unknown as typeof fetch },
    );
    expect(r.ok).toBe(true);
    const sent = await prisma.outreachDraft.findUnique({ where: { id: draft!.id } });
    expect(sent!.status).toBe("Sent");
    expect(sent!.reviewedById).toBe(dealLeadId);
    const call = okFetch.mock.calls[0];
    expect(String(call[0])).toContain("/developer/agents/agent_test/channels/email/send");
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.to.email).toBeTruthy();
    expect(body.options.channelIdentifier).toBe("chan-uuid@mail.heylua.ai");
    const eng = await prisma.engagement.findUnique({
      where: { transactionId_investorId: { transactionId: txnId, investorId } },
    });
    expect(eng!.engagementStage).toBe("Shared");
    const act = await prisma.activity.findFirst({ where: { transactionId: txnId, type: "Outreach", direction: "Outbound" } });
    expect(act).toBeTruthy();
    // Sent drafts can never send again:
    await expect(
      sendOutreachDraft(draft!.id, { orgRole: "Admin", userId: adminId }, { fetchFn: okFetch as unknown as typeof fetch }),
    ).rejects.toThrow(/cannot be sent/i);
  });

  it("HTTP failure marks the draft Failed and allows retry", async () => {
    if (!dbUp) return;
    await saveOutreachDrafts(txnId, [{ investorId: investor2Id, personId: person2Id, subject: "ZZTest 2", body: "Hi", matchRationale: "geo" }]);
    const draft = await prisma.outreachDraft.findFirst({ where: { investorId: investor2Id, status: "Draft" } });
    const r = await sendOutreachDraft(
      draft!.id,
      { orgRole: "Admin", userId: adminId },
      { fetchFn: failFetch as unknown as typeof fetch },
    );
    expect(r.ok).toBe(false);
    const failed = await prisma.outreachDraft.findUnique({ where: { id: draft!.id } });
    expect(failed!.status).toBe("Failed");
    expect(failed!.error).toContain("502");
    // retry succeeds
    const r2 = await sendOutreachDraft(
      draft!.id,
      { orgRole: "Admin", userId: adminId },
      { fetchFn: okFetch as unknown as typeof fetch },
    );
    expect(r2.ok).toBe(true);
  });

  it("existing engagement stage is never downgraded", async () => {
    if (!dbUp) return;
    // Fresh investor+contact with an engagement PRE-SET at NDASigned before any
    // send, so this exercises the upsert's update path (never the create path)
    // and proves a successful send only touches lastContact, not stage.
    await prisma.engagement.create({
      data: {
        name: "ZZTest Fund 5 x ZZTest Outreach Deal",
        transactionId: txnId,
        investorId: investor5Id,
        engagementStage: "NDASigned",
        status: "Contacted",
        createdSource: "HUMAN",
      },
    });
    await saveOutreachDrafts(txnId, [
      { investorId: investor5Id, personId: person5Id, subject: "ZZTest 5", body: "Hello", matchRationale: "stage-preserved" },
    ]);
    const draft = await prisma.outreachDraft.findFirst({ where: { investorId: investor5Id, status: "Draft" } });
    const before = await prisma.engagement.findUnique({
      where: { transactionId_investorId: { transactionId: txnId, investorId: investor5Id } },
    });
    expect(before!.lastContact).toBeNull();

    const r = await sendOutreachDraft(
      draft!.id,
      { orgRole: "Admin", userId: adminId },
      { fetchFn: okFetch as unknown as typeof fetch },
    );
    expect(r.ok).toBe(true);

    const sent = await prisma.outreachDraft.findUnique({ where: { id: draft!.id } });
    expect(sent!.status).toBe("Sent");
    const after = await prisma.engagement.findUnique({
      where: { transactionId_investorId: { transactionId: txnId, investorId: investor5Id } },
    });
    expect(after!.engagementStage).toBe("NDASigned");
    expect(after!.lastContact).not.toBeNull();
  });

  it("respects the LUA_API_BASE_URL env override", async () => {
    if (!dbUp) return;
    const previousBase = process.env.LUA_API_BASE_URL;
    process.env.LUA_API_BASE_URL = "https://custom.lua.example";
    try {
      await saveOutreachDrafts(txnId, [
        { investorId: investor4Id, personId: person4Id, subject: "ZZTest 4", body: "Hey there", matchRationale: "ticket size" },
      ]);
      const draft = await prisma.outreachDraft.findFirst({ where: { investorId: investor4Id, status: "Draft" } });
      const r = await sendOutreachDraft(
        draft!.id,
        { orgRole: "Admin", userId: adminId },
        { fetchFn: okFetch as unknown as typeof fetch },
      );
      expect(r.ok).toBe(true);
      const call = okFetch.mock.calls[okFetch.mock.calls.length - 1];
      expect(String(call[0])).toBe("https://custom.lua.example/developer/agents/agent_test/channels/email/send");
    } finally {
      if (previousBase === undefined) delete process.env.LUA_API_BASE_URL;
      else process.env.LUA_API_BASE_URL = previousBase;
    }
  });

  it("fails closed when Lua email is not configured", async () => {
    if (!dbUp) return;
    const savedAgentId = process.env.LUA_AGENT_ID;
    const savedApiKey = process.env.LUA_API_KEY;
    delete process.env.LUA_AGENT_ID;
    delete process.env.LUA_API_KEY;
    try {
      await saveOutreachDrafts(txnId, [
        { investorId: investor3Id, personId: person3Id, subject: "ZZTest unconfigured", body: "Hi", matchRationale: "ticket" },
      ]);
      const draft = await prisma.outreachDraft.findFirst({ where: { investorId: investor3Id, status: "Draft" } });
      const r = await sendOutreachDraft(
        draft!.id,
        { orgRole: "Admin", userId: adminId },
        { fetchFn: okFetch as unknown as typeof fetch },
      );
      expect(r.ok).toBe(false);
      const failed = await prisma.outreachDraft.findUnique({ where: { id: draft!.id } });
      expect(failed!.status).toBe("Failed");
      // The next describe block explicitly deletes this Failed draft before
      // re-running saveOutreachDrafts for investor3 — Failed is now an active
      // status (see "blocks a duplicate save" below), so that cleanup is required.
    } finally {
      if (savedAgentId !== undefined) process.env.LUA_AGENT_ID = savedAgentId;
      if (savedApiKey !== undefined) process.env.LUA_API_KEY = savedApiKey;
    }
  });

  it("fails closed when LUA_EMAIL_CHANNEL_ID is not configured (MINOR c)", async () => {
    if (!dbUp) return;
    const savedChannelId = process.env.LUA_EMAIL_CHANNEL_ID;
    delete process.env.LUA_EMAIL_CHANNEL_ID;
    try {
      await prisma.outreachDraft.deleteMany({ where: { investorId: investor3Id, transactionId: txnId } });
      await saveOutreachDrafts(txnId, [
        { investorId: investor3Id, personId: person3Id, subject: "ZZTest no-channel", body: "Hi", matchRationale: "ticket" },
      ]);
      const draft = await prisma.outreachDraft.findFirst({ where: { investorId: investor3Id, status: "Draft" } });
      const r = await sendOutreachDraft(
        draft!.id,
        { orgRole: "Admin", userId: adminId },
        { fetchFn: okFetch as unknown as typeof fetch },
      );
      expect(r.ok).toBe(false);
      const failed = await prisma.outreachDraft.findUnique({ where: { id: draft!.id } });
      expect(failed!.status).toBe("Failed");
      expect(failed!.error).toContain("LUA_EMAIL_CHANNEL_ID");
    } finally {
      if (savedChannelId !== undefined) process.env.LUA_EMAIL_CHANNEL_ID = savedChannelId;
    }
  });
});

describe("sendOutreachDraft atomicity (IMPORTANT-1: double-send race)", () => {
  it("two concurrent sends on the same draft: exactly one wins, the other is rejected as already claimed", async () => {
    if (!dbUp) return;
    await saveOutreachDrafts(txnId, [
      { investorId: investor6Id, personId: person6Id, subject: "ZZTest race", body: "Hi", matchRationale: "race" },
    ]);
    const draft = await prisma.outreachDraft.findFirst({ where: { investorId: investor6Id, status: "Draft" } });

    const results = await Promise.allSettled([
      sendOutreachDraft(draft!.id, { orgRole: "Admin", userId: adminId }, { fetchFn: okFetch as unknown as typeof fetch }),
      sendOutreachDraft(draft!.id, { orgRole: "Admin", userId: adminId }, { fetchFn: okFetch as unknown as typeof fetch }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ ok: boolean }>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled.length).toBe(1);
    expect(fulfilled[0].value.ok).toBe(true);
    expect(rejected.length).toBe(1);
    expect(String(rejected[0].reason)).toMatch(/cannot be sent/i);

    const sent = await prisma.outreachDraft.findUnique({ where: { id: draft!.id } });
    expect(sent!.status).toBe("Sent");
  });

  it("after a successful send, a second send throws (already claimed)", async () => {
    if (!dbUp) return;
    await saveOutreachDrafts(txnId, [
      { investorId: investor7Id, personId: person7Id, subject: "ZZTest second-send", body: "Hi", matchRationale: "second-send" },
    ]);
    const draft = await prisma.outreachDraft.findFirst({ where: { investorId: investor7Id, status: "Draft" } });
    const first = await sendOutreachDraft(
      draft!.id,
      { orgRole: "Admin", userId: adminId },
      { fetchFn: okFetch as unknown as typeof fetch },
    );
    expect(first.ok).toBe(true);
    await expect(
      sendOutreachDraft(draft!.id, { orgRole: "Admin", userId: adminId }, { fetchFn: okFetch as unknown as typeof fetch }),
    ).rejects.toThrow(/cannot be sent/i);
  });

  it("a Rejected draft cannot be claimed by sendOutreachDraft", async () => {
    if (!dbUp) return;
    await prisma.outreachDraft.deleteMany({ where: { investorId: investor4Id, transactionId: txnId } });
    await saveOutreachDrafts(txnId, [
      { investorId: investor4Id, personId: person4Id, subject: "ZZTest reject-claim", body: "Hi", matchRationale: "reject" },
    ]);
    const draft = await prisma.outreachDraft.findFirst({ where: { investorId: investor4Id, status: "Draft" } });
    await rejectOutreachDraft(draft!.id, { orgRole: "Admin", userId: adminId });
    await expect(
      sendOutreachDraft(draft!.id, { orgRole: "Admin", userId: adminId }, { fetchFn: okFetch as unknown as typeof fetch }),
    ).rejects.toThrow(/cannot be sent/i);
    const still = await prisma.outreachDraft.findUnique({ where: { id: draft!.id } });
    expect(still!.status).toBe("Rejected");
  });
});

describe("updateOutreachDraft / reject", () => {
  it("owner can edit subject/body while Draft; rejected drafts are terminal", async () => {
    if (!dbUp) return;
    await prisma.outreachDraft.deleteMany({ where: { investorId: investor3Id } });
    await saveOutreachDrafts(txnId, [{ investorId: investor3Id, personId: person3Id, subject: "ZZTest 3", body: "Hey", matchRationale: "ticket" }]);
    const d = await prisma.outreachDraft.findFirst({ where: { investorId: investor3Id, status: "Draft" } });
    await updateOutreachDraft(d!.id, { subject: "ZZTest 3 edited" }, { orgRole: "DealLead", userId: dealLeadId });
    const edited = await prisma.outreachDraft.findUnique({ where: { id: d!.id } });
    expect(edited!.subject).toBe("ZZTest 3 edited");
    await rejectOutreachDraft(d!.id, { orgRole: "DealLead", userId: dealLeadId });
    const rejected = await prisma.outreachDraft.findUnique({ where: { id: d!.id } });
    expect(rejected!.status).toBe("Rejected");
    await expect(
      sendOutreachDraft(d!.id, { orgRole: "Admin", userId: adminId }, { fetchFn: okFetch as unknown as typeof fetch }),
    ).rejects.toThrow(/cannot be sent/i);
  });
});

describe("IMPORTANT-3: DB-level dedup for active drafts (partial unique index)", () => {
  it("a direct second Draft insert for the same deal x investor pair is rejected with P2002", async () => {
    if (!dbUp) return;
    await prisma.outreachDraft.deleteMany({ where: { investorId: investor6Id, transactionId: txnId } });
    await prisma.outreachDraft.create({
      data: {
        transactionId: txnId,
        investorId: investor6Id,
        personId: person6Id,
        subject: "ZZTest active-pair 1",
        body: "Hi",
        matchRationale: "dedup-index",
        createdSource: "AGENT",
      },
    });
    await expect(
      prisma.outreachDraft.create({
        data: {
          transactionId: txnId,
          investorId: investor6Id,
          personId: person6Id,
          subject: "ZZTest active-pair 2",
          body: "Hi again",
          matchRationale: "dedup-index",
          createdSource: "AGENT",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await prisma.outreachDraft.deleteMany({ where: { investorId: investor6Id, transactionId: txnId } });
  });

  it("saveOutreachDrafts still returns skipped for an existing pair when a concurrent create races past the app-level dedup check", async () => {
    if (!dbUp) return;
    await prisma.outreachDraft.deleteMany({ where: { investorId: investor7Id, transactionId: txnId } });
    const drafts = [
      { investorId: investor7Id, personId: person7Id, subject: "ZZTest race-save", body: "Hi", matchRationale: "race-save" },
    ];
    const [r1, r2] = await Promise.all([saveOutreachDrafts(txnId, drafts), saveOutreachDrafts(txnId, drafts)]);
    expect(r1.created + r2.created).toBe(1);
    expect(r1.skipped + r2.skipped).toBe(1);
    const rows = await prisma.outreachDraft.findMany({ where: { investorId: investor7Id, transactionId: txnId } });
    expect(rows.length).toBe(1);
    await prisma.outreachDraft.deleteMany({ where: { investorId: investor7Id, transactionId: txnId } });
  });
});
