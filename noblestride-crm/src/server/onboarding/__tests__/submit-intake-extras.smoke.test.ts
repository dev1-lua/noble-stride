import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { submitIntake } from "../submit-intake";

const BASE = {
  legalName: "ZZTest Webchat Farms Ltd",
  registrationNo: "ZZT-001",
  country: "EastAfrica",
  sectors: ["Agribusiness"],
  yearFounded: 2015,
  contactName: "Amos Tester",
  role: "CEO",
  email: "amos@zztestwebchatfarms.example",
  phone: "+254700000001",
  revenueUsd: 2_000_000,
  ebitdaUsd: 250_000,
  netProfitUsd: 150_000,
  totalAssetsUsd: 3_000_000,
  auditedYears: "3",
  raiseUsd: 1_500_000,
  instrument: "Debt",
  useOfFunds: "Working capital",
  proposedTimeline: "Q4 2026",
  ownershipSummary: "Founders 100%",
  pepExposure: "no",
  governmentOwned: "no",
};

async function cleanup() {
  const clients = await prisma.client.findMany({ where: { name: { startsWith: "ZZTest Webchat" } }, select: { id: true } });
  const ids = clients.map((c) => c.id);
  await prisma.task.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.document.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.activity.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.mandate.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.person.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.client.deleteMany({ where: { id: { in: ids } } });
}
beforeAll(cleanup);
afterAll(cleanup);

describe("submitIntake webchat extras", () => {
  it("webchat intake also writes Task + Documents and an AGENT-sourced summary Activity", async () => {
    const mandate = await submitIntake(BASE, {
      via: "webchat",
      conversationSummary: "Prospect wants USD 1.5M debt.\nNext steps: intro call.",
      qualificationNotes: "Revenue > $1M; 3y audited.",
      attachmentUrls: ["https://files.example/deck.pdf", "https://files.example/financials.xlsx"],
    });
    expect(mandate.stage).toBe("NewLead");
    expect(mandate.qualificationVerdict).toBeTruthy();

    const activity = await prisma.activity.findFirst({ where: { mandateId: mandate.id, channel: "WebChat" } });
    expect(activity?.subject).toBe("Web chat intake received");
    expect(activity?.body).toContain("intro call");
    expect(activity?.body).toContain("Qualification signals");
    expect(activity?.createdSource).toBe("AGENT");

    const task = await prisma.task.findFirst({ where: { mandateId: mandate.id } });
    expect(task?.title).toBe("Review web-chat intake: ZZTest Webchat Farms Ltd");
    expect(task?.assigneeId).toBeNull();

    const docs = await prisma.document.findMany({ where: { mandateId: mandate.id }, orderBy: { createdAt: "asc" } });
    expect(docs).toHaveLength(2);
    expect(docs[0]?.type).toBe("PitchDeck");
    expect(docs[0]?.fileUrl).toBe("https://files.example/deck.pdf");
    expect(docs[1]?.type).toBe("Other");

    const client = await prisma.client.findUnique({ where: { id: mandate.clientId } });
    expect(client?.pitchDeckUrl).toBe("https://files.example/deck.pdf");
    expect(client?.createdSource).toBe("AGENT");
  });

  it("default (wizard) call is unchanged: no Task, no Documents, subject 'Website intake received'", async () => {
    const mandate = await submitIntake({ ...BASE, legalName: "ZZTest Webchat Wizard Ltd", email: "w@zztestwebchatwizard.example" });
    const activity = await prisma.activity.findFirst({ where: { mandateId: mandate.id } });
    expect(activity?.subject).toBe("Website intake received");
    expect(await prisma.task.count({ where: { mandateId: mandate.id } })).toBe(0);
    expect(await prisma.document.count({ where: { mandateId: mandate.id } })).toBe(0);
  });
});
