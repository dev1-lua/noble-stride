// DB-backed smoke tests for the two-way conversation thread service (action
// points 2026-07 item 1) + its notification fan-out (item 2). Follows the
// zztest setup/teardown convention of agent-delegation.smoke.test.ts.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  getThreadForEngagement,
  postInvestorMessage,
  postStaffReply,
  seedInvestorThreadMessage,
  setConversationStatus,
  staffRecipientsForEngagementId,
} from "@/server/services/conversations";

const PREFIX = "zztest.convo";

describe("conversations service", () => {
  let engagementId: string;
  let investorId: string;
  let personId: string;
  let adminId: string;
  let leadId: string;
  let assistId: string;

  beforeAll(async () => {
    await cleanup();
    adminId = (
      await prisma.user.create({ data: { name: "ZZ Convo Admin", email: `${PREFIX}.admin@noblestride.co.ke`, role: "Admin" } })
    ).id;
    leadId = (
      await prisma.user.create({ data: { name: "ZZ Convo Lead", email: `${PREFIX}.lead@noblestride.co.ke`, role: "DealLead" } })
    ).id;
    assistId = (
      await prisma.user.create({ data: { name: "ZZ Convo Assist", email: `${PREFIX}.assist@noblestride.co.ke`, role: "TeamMember" } })
    ).id;
    const investor = await prisma.investor.create({
      data: { name: "ZZ Convo Capital", investorType: "PrivateEquity" },
    });
    investorId = investor.id;
    personId = (
      await prisma.person.create({
        data: { firstName: "Zia", lastName: "Tester", email: `${PREFIX}.zia@fund.com`, investorId },
      })
    ).id;
    const client = await prisma.client.create({ data: { name: "ZZ Convo Client" } });
    const txn = await prisma.transaction.create({
      data: {
        name: "ZZ Convo Deal",
        clientId: client.id,
        ownerId: leadId,
        assists: { connect: [{ id: assistId }] },
      },
    });
    engagementId = (
      await prisma.engagement.create({
        data: { name: "ZZ Convo Engagement", transactionId: txn.id, investorId },
      })
    ).id;
  });

  afterAll(cleanup);

  async function cleanup() {
    await prisma.engagement.deleteMany({ where: { name: { startsWith: "ZZ Convo" } } });
    await prisma.transaction.deleteMany({ where: { name: { startsWith: "ZZ Convo" } } });
    await prisma.client.deleteMany({ where: { name: { startsWith: "ZZ Convo" } } });
    await prisma.person.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.investor.deleteMany({ where: { name: { startsWith: "ZZ Convo" } } });
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  }

  it("routes staff recipients to admins + deal lead + assists + engagement owner", async () => {
    const recipients = await staffRecipientsForEngagementId(engagementId);
    expect(recipients).toEqual(expect.arrayContaining([adminId, leadId, assistId]));
  });

  it("investor message creates the thread as Pending, logs an Activity, and notifies staff", async () => {
    const thread = await postInvestorMessage({ engagementId, personId, body: "Please share the data room." });
    expect(thread.status).toBe("Pending");
    expect(thread.messages).toHaveLength(1);
    expect(thread.messages[0]).toMatchObject({ senderKind: "INVESTOR", senderName: "Zia Tester" });

    const activity = await prisma.activity.findFirst({
      where: { engagementId, channel: "Portal", direction: "Inbound" },
    });
    expect(activity?.body).toBe("Please share the data room.");

    const bells = await prisma.notification.findMany({ where: { kind: "investor_message", userId: { in: [adminId, leadId, assistId] } } });
    expect(bells.map((b) => b.userId).sort()).toEqual([adminId, leadId, assistId].sort());

    const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } });
    expect(engagement.lastContact).not.toBeNull();
  });

  it("staff reply moves Pending → Open and notifies the investor's portal bell", async () => {
    const thread = await postStaffReply({ engagementId, userId: leadId, body: "Data room link on its way." });
    expect(thread.status).toBe("Open");
    expect(thread.messages).toHaveLength(2);
    expect(thread.messages[1]).toMatchObject({ senderKind: "STAFF", senderName: "ZZ Convo Lead" });

    const portalBell = await prisma.notification.findFirst({ where: { kind: "message_reply", investorId } });
    expect(portalBell).not.toBeNull();
  });

  it("walks the full status lifecycle and reopens Closed → Pending on a new investor message", async () => {
    const thread = (await getThreadForEngagement(engagementId))!;
    const inProgress = await setConversationStatus(thread.id, "InProgress");
    expect(inProgress.status).toBe("InProgress");

    // An investor message while InProgress leaves the status alone.
    const still = await postInvestorMessage({ engagementId, personId, body: "Any update?" });
    expect(still.status).toBe("InProgress");

    const closed = await setConversationStatus(thread.id, "Closed");
    expect(closed.status).toBe("Closed");

    const reopened = await postInvestorMessage({ engagementId, personId, body: "One more thing…" });
    expect(reopened.status).toBe("Pending");
  });

  it("staff reply to a Closed thread reopens it as Open", async () => {
    const thread = (await getThreadForEngagement(engagementId))!;
    await setConversationStatus(thread.id, "Closed");
    const reopened = await postStaffReply({ engagementId, userId: adminId, body: "Following up." });
    expect(reopened.status).toBe("Open");
  });

  it("seedInvestorThreadMessage appends without Activity or notification", async () => {
    const before = await prisma.activity.count({ where: { engagementId } });
    const bellsBefore = await prisma.notification.count({ where: { kind: "investor_message" } });
    await seedInvestorThreadMessage(engagementId, personId, "Seeded via express-interest.");
    const after = await prisma.activity.count({ where: { engagementId } });
    const bellsAfter = await prisma.notification.count({ where: { kind: "investor_message" } });
    expect(after).toBe(before);
    expect(bellsAfter).toBe(bellsBefore);
    const thread = (await getThreadForEngagement(engagementId))!;
    expect(thread.messages.at(-1)?.body).toBe("Seeded via express-interest.");
  });

  it("rejects empty and oversized bodies", async () => {
    await expect(postInvestorMessage({ engagementId, personId, body: "   " })).rejects.toThrow(/empty/i);
    await expect(
      postStaffReply({ engagementId, userId: adminId, body: "x".repeat(5001) }),
    ).rejects.toThrow(/too long/i);
  });
});
