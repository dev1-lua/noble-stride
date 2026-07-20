import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { submitWebsiteIntake } from "../submit-website-intake";
import { submitWebsiteClientIntake } from "@/server/services/client-intake";

// §10.1 required fields only — every optional (financials included) omitted.
const REQUIRED_ONLY = {
  legalName: "ZZTest WebsiteAgent Required Ltd",
  yearFounded: 2015,
  hqCity: "Nairobi",
  countries: ["EastAfrica"],
  sectors: ["Agribusiness"],
  coreProduct: "Macadamia processing and export",
  description: "Processes and exports macadamia nuts to EU buyers.",
  founderGenders: ["Mixed"],
  foundersNationality: "Kenyan",
  targetClients: "EU wholesale food importers",
  contactName: "Amos Tester",
  role: "CEO",
  email: "amos@zztestwebsiteagent.example",
  ndaAccepted: true,
  raiseUsd: 1_500_000,
  instruments: ["Debt", "Mezzanine"],
};

const FULL = {
  ...REQUIRED_ONLY,
  legalName: "ZZTest WebsiteAgent Full Ltd",
  email: "full@zztestwebsiteagent.example",
  revenueUsd: 2_000_000,
  revenueForecastUsd: 2_600_000,
  profitability: "Profitable",
  ebitdaUsd: 250_000,
  auditedYears: "3",
  postMoneyValuationUsd: 10_000_000,
  raisedToDateRoundUsd: 400_000,
  raisedToDateTotalUsd: 900_000,
  existingInvestors: "Acumen Fund (grant)",
  pepExposure: "no",
  governmentOwned: "no",
  useOfFunds: "Working capital",
  proposedTimeline: "Q4 2026",
  originationSource: "LinkedIn campaign",
  applicantNotes: "Prefers to close before harvest season.",
  phone: "+254700000009",
};

async function cleanup() {
  const clients = await prisma.client.findMany({
    where: { name: { startsWith: "ZZTest WebsiteAgent" } },
    select: { id: true },
  });
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

describe("submitWebsiteIntake (SOW §10)", () => {
  it("required-only submission persists §10.1 fields and lands as NeedsReview", async () => {
    const mandate = await submitWebsiteIntake(REQUIRED_ONLY, {
      conversationSummary: "Prospect raising USD 1.5M debt/mezzanine.",
    });

    expect(mandate.stage).toBe("NewLead");
    expect(mandate.qualificationVerdict).toBe("NeedsReview");
    // Missing optional financials become review reasons, never a rejection.
    expect(mandate.qualificationReasons.join(" ")).toContain("not provided");
    expect(mandate.instrument).toEqual(["Debt", "Mezzanine"]);
    expect(mandate.intakeNdaAccepted).toBe(true);
    expect(mandate.intakeNdaAcceptedAt).toBeInstanceOf(Date);
    expect(Number(mandate.dealSize)).toBe(1_500_000);

    const client = await prisma.client.findUnique({
      where: { id: mandate.clientId },
      include: { contacts: true },
    });
    expect(client?.hqCity).toBe("Nairobi");
    expect(client?.countries).toEqual(["EastAfrica"]);
    expect(client?.coreProduct).toBe("Macadamia processing and export");
    expect(client?.description).toContain("macadamia");
    expect(client?.founderGenders).toEqual(["Mixed"]);
    expect(client?.foundersNationality).toBe("Kenyan");
    expect(client?.targetClients).toBe("EU wholesale food importers");
    expect(client?.status).toBe("Prospect");
    expect(client?.source).toBe("Website");
    expect(client?.createdSource).toBe("AGENT");
    expect(client?.contacts[0]?.email).toBe("amos@zztestwebsiteagent.example");
    expect(client?.contacts[0]?.phone).toBeNull();

    const task = await prisma.task.findFirst({ where: { mandateId: mandate.id } });
    expect(task?.title).toBe("Review website intake: ZZTest WebsiteAgent Required Ltd");
    expect(task?.assigneeId).toBeNull(); // open queue — manual assignment (§10.3)
  });

  it("full submission qualifies cleanly and persists round-level facts + notes", async () => {
    const mandate = await submitWebsiteIntake(FULL, {
      conversationSummary: "Full application.",
      qualificationNotes: "Strong financials, 3y audited.",
      attachmentUrls: ["https://files.example/deck.pdf"],
    });

    expect(mandate.qualificationVerdict).toBe("Qualified");
    expect(mandate.qualificationReasons).toEqual([]);
    expect(Number(mandate.postMoneyValuation)).toBe(10_000_000);
    expect(Number(mandate.raisedToDateRound)).toBe(400_000);
    expect(mandate.notes).toContain("Use of funds: Working capital");
    expect(mandate.notes).toContain("Origination source: LinkedIn campaign");
    expect(mandate.notes).toContain("Applicant notes:");

    const client = await prisma.client.findUnique({ where: { id: mandate.clientId } });
    expect(Number(client?.raisedToDateTotal)).toBe(900_000);
    expect(Number(client?.revenueForecast)).toBe(2_600_000);
    expect(client?.profitability).toBe("Profitable");
    expect(client?.pitchDeckUrl).toBe("https://files.example/deck.pdf");

    const activity = await prisma.activity.findFirst({ where: { mandateId: mandate.id } });
    expect(activity?.subject).toBe("Website intake agent submission");
    expect(activity?.body).toContain("Qualification signals");
    expect(activity?.createdSource).toBe("AGENT");

    const docs = await prisma.document.findMany({ where: { mandateId: mandate.id } });
    expect(docs).toHaveLength(1);
    expect(docs[0]?.type).toBe("PitchDeck");
  });

  it("restricted sector / low raise lands as Deprioritized but still visible to the team", async () => {
    const mandate = await submitWebsiteIntake(
      {
        ...REQUIRED_ONLY,
        legalName: "ZZTest WebsiteAgent Restricted Ltd",
        email: "restricted@zztestwebsiteagent.example",
        sectors: ["Gambling"],
        raiseUsd: 300_000,
      },
      { conversationSummary: "Deprioritised path." },
    );
    expect(mandate.qualificationVerdict).toBe("Deprioritized");
    expect(mandate.qualificationReasons.join(" ")).toContain("restricted sector");
    expect(mandate.qualificationReasons.join(" ")).toContain("below USD 500K");
    // §10.2: never auto-rejected invisibly — the record exists in the NewLead queue.
    expect(mandate.stage).toBe("NewLead");
  });

  it("NDA decline is recorded as false with no timestamp", async () => {
    const mandate = await submitWebsiteIntake(
      {
        ...REQUIRED_ONLY,
        legalName: "ZZTest WebsiteAgent NoNda Ltd",
        email: "nonda@zztestwebsiteagent.example",
        ndaAccepted: false,
      },
      { conversationSummary: "Declined NDA." },
    );
    expect(mandate.intakeNdaAccepted).toBe(false);
    expect(mandate.intakeNdaAcceptedAt).toBeNull();
  });

  it("rejects a submission missing a §10.1 required field", async () => {
    const { ndaAccepted: _omitted, ...missingNda } = REQUIRED_ONLY;
    await expect(
      submitWebsiteIntake({ ...missingNda, legalName: "ZZTest WebsiteAgent Invalid Ltd" }, {}),
    ).rejects.toThrow();
  });
});

describe("submitWebsiteClientIntake dedupe", () => {
  it("same company + email within 24h returns ok without creating a twin", async () => {
    const payload = {
      ...REQUIRED_ONLY,
      legalName: "ZZTest WebsiteAgent Dedupe Ltd",
      email: "dedupe@zztestwebsiteagent.example",
    };
    const first = await submitWebsiteClientIntake(payload, { conversationSummary: "First." });
    expect(first).toEqual({ ok: true });
    const second = await submitWebsiteClientIntake(payload, { conversationSummary: "Retry." });
    expect(second).toEqual({ ok: true });

    const mandates = await prisma.mandate.findMany({
      where: { client: { name: "ZZTest WebsiteAgent Dedupe Ltd" } },
    });
    expect(mandates).toHaveLength(1);
  });
});
