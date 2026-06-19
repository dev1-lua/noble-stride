import { PrismaClient } from "@prisma/client";
import type {
  InvestorType,
  InvestorStatus,
  Sector,
  Geography,
  Instrument,
  MandateStage,
  DocStatus,
  Source,
  TransactionStage,
  DealType,
  EngagementStatus,
  PartnerType,
  PartnerStatus,
  InteractionType,
  ActorSource,
} from "@prisma/client";
import seedData from "./seed-data.json";

const prisma = new PrismaClient();

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

// ─── Fixed derivation tables (§5) ───────────────────────────────────────────

const TXN_STAGE: TransactionStage[] = [
  "ClosedWon", "ClosedWon", "ClosedWon", "ClosedWon",
  "Closing", "TermSheet", "DueDiligence", "InvestorOutreach",
  "DealPreparation", "ClosedLost", "DueDiligence", "InvestorOutreach",
];

const DEAL_TYPE: DealType[] = [
  "SeriesA", "Growth", "SeriesB", "Expansion",
  "Growth", "SeriesA", "AcquisitionFinance", "SeriesB",
  "Growth", "Expansion", "SeriesA", "Growth",
];

const INSTRUMENTS: Instrument[][] = [
  ["Equity"],
  ["Debt"],
  ["Equity", "Convertible"],
  ["Mezzanine"],
  ["Equity"],
  ["Debt"],
  ["Equity"],
  ["Debt", "Equity"],
  ["Equity"],
  ["Mezzanine"],
  ["Equity"],
  ["Debt"],
];

const TARGET_RAISE = [
  8_000_000, 5_000_000, 12_000_000, 3_000_000, 6_000_000, 10_000_000,
  4_000_000, 7_500_000, 2_500_000, 9_000_000, 5_500_000, 3_500_000,
];

const DATE_OPENED = [165, 150, 135, 120, 100, 85, 70, 55, 40, 160, 30, 20];

const CLOSED_WON_DAYS = [45, 30, 18, 8];

const DEAL_TYPE_LABEL: Record<DealType, string> = {
  SeriesA: "Series A",
  SeriesB: "Series B",
  Growth: "Growth",
  Expansion: "Expansion",
  AcquisitionFinance: "Acquisition Finance",
};

// ─── Interaction types for activities (§7) ───────────────────────────────────

const TYPES: InteractionType[] = [
  "Outreach", "NDASent", "NDASigned", "DataRoomAccess", "Meeting",
  "Call", "Email", "Feedback", "TermSheet", "Note", "Other",
];

// ─── Stage rank for sorting deal mandates (§4) ────────────────────────────

const STAGE_RANK: Partial<Record<MandateStage, number>> = {
  Signed: 0,
  Negotiation: 1,
  Proposal: 2,
  PitchPresentation: 3,
};

async function main() {
  // ─────────────────────────────────────────────────────────────────────────
  // §1  IDEMPOTENCY — delete child → parent
  // ─────────────────────────────────────────────────────────────────────────
  await prisma.activity.deleteMany();
  await prisma.engagement.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.mandate.deleteMany();
  await prisma.person.deleteMany();
  await prisma.client.deleteMany();
  await prisma.investor.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.user.deleteMany();

  // ─────────────────────────────────────────────────────────────────────────
  // §3  INSERT REAL ENTITIES
  // ─────────────────────────────────────────────────────────────────────────

  // USERS
  const usersByFirst = new Map<string, string>();
  for (const u of seedData.users) {
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        jobTitle: u.jobTitle,
        avatarColor: u.avatarColor,
      },
    });
    usersByFirst.set(u.name.split(" ")[0].toLowerCase(), user.id);
  }

  // INVESTORS
  const investors: Array<{
    id: string;
    sectorFocus: Sector[];
    geographicFocus: Geography[];
    ticketMin: number | null;
    ticketMax: number | null;
  }> = [];

  for (const inv of seedData.investors) {
    const created = await prisma.investor.create({
      data: {
        name: inv.name,
        website: inv.website ?? null,
        investorType: inv.investorType as InvestorType,
        status: (inv.status ?? null) as InvestorStatus | null,
        sectorFocus: inv.sectorFocus as Sector[],
        geographicFocus: inv.geographicFocus as Geography[],
        instruments: inv.instruments as Instrument[],
        ticketMin: inv.ticketMin ?? null,
        ticketMax: inv.ticketMax ?? null,
        notes: inv.notes ?? null,
        contacts: {
          create: inv.contacts.map((c) => ({
            firstName: c.firstName,
            lastName: c.lastName ?? null,
            email: c.email ?? null,
            phone: c.phone ?? null,
            jobTitle: c.jobTitle ?? null,
          })),
        },
      },
    });
    investors.push({
      id: created.id,
      sectorFocus: inv.sectorFocus as Sector[],
      geographicFocus: inv.geographicFocus as Geography[],
      ticketMin: inv.ticketMin ?? null,
      ticketMax: inv.ticketMax ?? null,
    });
  }

  // PARTNERS
  const partners: Array<{ id: string }> = [];

  for (const p of seedData.partners) {
    const created = await prisma.partner.create({
      data: {
        name: p.name,
        partnerType: (p.partnerType ?? null) as PartnerType | null,
        status: p.status as PartnerStatus,
        location: p.location ?? null,
        profile: p.profile ?? null,
        amount: p.amount ?? null,
        contacts: {
          create: p.contacts.map((c) => ({
            firstName: c.firstName,
            lastName: c.lastName ?? null,
            email: c.email ?? null,
            phone: c.phone ?? null,
            jobTitle: c.jobTitle ?? null,
          })),
        },
      },
    });
    partners.push({ id: created.id });
  }

  // CLIENTS
  const clients: Array<{ id: string; sector: Sector[] }> = [];

  for (const cl of seedData.clients) {
    const created = await prisma.client.create({
      data: {
        name: cl.name,
        sector: cl.sector as Sector[],
        countries: cl.countries as Geography[],
      },
    });
    clients.push({ id: created.id, sector: cl.sector as Sector[] });
  }

  // MANDATES
  type MandateRecord = {
    id: string;
    stage: MandateStage;
    clientId: string;
    leadId: string | undefined;
    client: { sector: Sector[] };
    nextAction: string | null;
  };

  const mandates: MandateRecord[] = [];

  for (let i = 0; i < seedData.clients.length; i++) {
    const cl = seedData.clients[i];
    const m = cl.mandate;
    const client = clients[i];
    const leadId = usersByFirst.get(m.leadName.toLowerCase());

    const created = await prisma.mandate.create({
      data: {
        name: m.name,
        stage: m.stage as MandateStage,
        stageEnteredAt: daysAgo(6 + (i * 4) % 80),
        clientId: client.id,
        leadId: leadId ?? null,
        sector: client.sector,
        dateOpened: m.dateOpened ? new Date(m.dateOpened) : null,
        ndaStatus: m.ndaStatus as DocStatus,
        ndaSentDate: m.ndaSentDate ? new Date(m.ndaSentDate) : null,
        ndaSignedDate: m.ndaSignedDate ? new Date(m.ndaSignedDate) : null,
        eaStatus: m.eaStatus as DocStatus,
        eaSentDate: m.eaSentDate ? new Date(m.eaSentDate) : null,
        eaSignedDate: m.eaSignedDate ? new Date(m.eaSignedDate) : null,
        source: (m.source ?? null) as Source | null,
        nextAction: m.nextAction ?? null,
        notes: m.notes ?? null,
      },
    });
    mandates.push({
      id: created.id,
      stage: m.stage as MandateStage,
      clientId: client.id,
      leadId,
      client: { sector: client.sector },
      nextAction: m.nextAction ?? null,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // §4  BUILD DEAL MANDATES
  // ─────────────────────────────────────────────────────────────────────────

  const dealStages: MandateStage[] = ["Signed", "Negotiation", "Proposal", "PitchPresentation"];
  const dealMandatesRaw = mandates
    .filter((m) => dealStages.includes(m.stage))
    .sort((a, b) => (STAGE_RANK[a.stage] ?? 99) - (STAGE_RANK[b.stage] ?? 99));

  const dealMandates = dealMandatesRaw.slice(0, 12);

  // ─────────────────────────────────────────────────────────────────────────
  // §5  TRANSACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  const transactions: Array<{
    id: string;
    stage: TransactionStage;
    ownerId: string | undefined;
  }> = [];

  for (let i = 0; i < dealMandates.length; i++) {
    const dm = dealMandates[i];
    const stage = TXN_STAGE[i];
    const dealType = DEAL_TYPE[i];
    const label = DEAL_TYPE_LABEL[dealType];

    // client name via mandate — we need to look up clients by clientId
    const clientEntry = clients.find((c) => c.id === dm.clientId);
    const clientData = seedData.clients.find(
      (_, idx) => clients[idx].id === dm.clientId
    );
    const clientName = clientData?.name ?? dm.clientId;

    let closedAt: Date | null = null;
    if (stage === "ClosedWon") {
      closedAt = daysAgo(CLOSED_WON_DAYS[i]);
    } else if (stage === "ClosedLost") {
      closedAt = daysAgo(25);
    }

    const created = await prisma.transaction.create({
      data: {
        name: `${clientName} – ${label}`,
        clientId: dm.clientId,
        mandateId: dm.id,
        ownerId: dm.leadId ?? null,
        stage,
        dealType,
        instrument: INSTRUMENTS[i],
        sector: clientEntry?.sector ?? [],
        targetRaise: TARGET_RAISE[i],
        dateOpened: daysAgo(DATE_OPENED[i]),
        stageEnteredAt: daysAgo(4 + i * 3),
        closedAt,
      },
    });
    transactions.push({
      id: created.id,
      stage,
      ownerId: dm.leadId,
    });
  }

  // Link partner referrals (§5 — after transactions)
  // 2 deal mandates (ClosedWon) → partner referrals
  await prisma.mandate.update({
    where: { id: dealMandates[0].id },
    data: { referredById: partners[0].id },
  });
  await prisma.mandate.update({
    where: { id: dealMandates[2].id },
    data: { referredById: partners[1].id },
  });

  // 2 non-deal mandates → partner referrals
  const nonDealMandates = mandates.filter(
    (m) => !dealMandates.find((dm) => dm.id === m.id)
  );
  if (nonDealMandates.length >= 2) {
    await prisma.mandate.update({
      where: { id: nonDealMandates[0].id },
      data: { referredById: partners[2].id },
    });
    await prisma.mandate.update({
      where: { id: nonDealMandates[1].id },
      data: { referredById: partners[3].id },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // §6  ENGAGEMENTS (60 total — 5 per transaction)
  // ─────────────────────────────────────────────────────────────────────────

  const ACTIVE_STATUSES: EngagementStatus[] = [
    "InConversation", "Interested", "Contacted", "InConversation", "NotContacted",
  ];
  const CLOSED_WON_STATUSES: EngagementStatus[] = [
    "Committed", "Committed", "Interested", "Passed", "Contacted",
  ];
  const CLOSED_LOST_STATUSES: EngagementStatus[] = [
    "Passed", "Passed", "Contacted", "NotContacted", "Passed",
  ];

  const engagements: Array<{ id: string; transactionId: string; investorId: string }> = [];

  for (let ti = 0; ti < transactions.length; ti++) {
    const t = transactions[ti];
    const isActive = !["ClosedWon", "ClosedLost"].includes(t.stage);

    for (let j = 0; j < 5; j++) {
      const inv = investors[(ti * 5 + j) % investors.length];
      let status: EngagementStatus;
      if (t.stage === "ClosedWon") {
        status = CLOSED_WON_STATUSES[j];
      } else if (t.stage === "ClosedLost") {
        status = CLOSED_LOST_STATUSES[j];
      } else {
        status = ACTIVE_STATUSES[j];
      }

      // For engagement name, we need the transaction name
      // Let's build a map from transaction id to name
      const dm = dealMandates[ti];
      const clientData2 = seedData.clients.find(
        (_, idx) => clients[idx].id === dm.clientId
      );
      const clientName2 = clientData2?.name ?? "";
      const label2 = DEAL_TYPE_LABEL[DEAL_TYPE[ti]];
      const txnName = `${clientName2} – ${label2}`;

      const created = await prisma.engagement.create({
        data: {
          name: `${seedData.investors[(ti * 5 + j) % investors.length].name} – ${txnName}`,
          transactionId: t.id,
          investorId: inv.id,
          ownerId: t.ownerId ?? null,
          status,
          lastContact: daysAgo(3 + j * 2 + ti),
          createdSource: "HUMAN" as ActorSource,
        },
      });
      engagements.push({
        id: created.id,
        transactionId: t.id,
        investorId: inv.id,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // §7  ACTIVITIES (≈120 from engagements + 10 mandate activities)
  // ─────────────────────────────────────────────────────────────────────────

  const activeTxns = transactions.filter(
    (t) => !["ClosedWon", "ClosedLost"].includes(t.stage)
  );
  const staleTxnId = activeTxns[activeTxns.length - 1].id;

  let k = 0;

  for (let ti = 0; ti < transactions.length; ti++) {
    const t = transactions[ti];
    const txnEngagements = engagements.filter((e) => e.transactionId === t.id);
    const isActive = !["ClosedWon", "ClosedLost"].includes(t.stage);
    const isStale = t.id === staleTxnId;

    for (let j = 0; j < txnEngagements.length; j++) {
      const e = txnEngagements[j];
      const invData = seedData.investors[(ti * 5 + j) % investors.length];

      // Activity #1
      let off1: number;
      if (isStale) {
        off1 = 25 + j * 15;
      } else if (isActive && j === 0) {
        off1 = 2 + (k % 10);
      } else {
        off1 = 18 + (k % 150);
      }
      const type1 = TYPES[k % 11];
      await prisma.activity.create({
        data: {
          type: type1,
          subject: `${type1} — ${invData.name}`,
          engagementId: e.id,
          transactionId: t.id,
          investorId: e.investorId,
          createdById: t.ownerId ?? null,
          createdSource: "HUMAN" as ActorSource,
          occurredAt: daysAgo(off1),
        },
      });
      k++;

      // Activity #2
      let off2: number;
      if (isStale) {
        off2 = 30 + j * 12;
      } else {
        off2 = 5 + (k % 55);
      }
      const type2 = TYPES[(k + 5) % 11];
      await prisma.activity.create({
        data: {
          type: type2,
          subject: `${type2} — ${invData.name}`,
          engagementId: e.id,
          transactionId: t.id,
          investorId: e.investorId,
          createdById: t.ownerId ?? null,
          createdSource: "HUMAN" as ActorSource,
          occurredAt: daysAgo(off2),
        },
      });
      k++;
    }
  }

  // ~10 mandate-linked activities (§7 — mandate detail timeline)
  for (let idx = 0; idx < Math.min(10, mandates.length); idx++) {
    const mandate = mandates[idx];
    const actType: InteractionType = idx % 2 === 0 ? "Note" : "Meeting";
    await prisma.activity.create({
      data: {
        type: actType,
        subject: mandate.nextAction ?? `Mandate update — ${mandate.id}`,
        mandateId: mandate.id,
        investorId: null,
        createdById: mandate.leadId ?? null,
        createdSource: "HUMAN" as ActorSource,
        occurredAt: daysAgo(8 + idx * 3),
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // §8  SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  const [uCount, iCount, cCount, pCount, peCount, mCount, tCount, eCount, aCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.investor.count(),
      prisma.client.count(),
      prisma.partner.count(),
      prisma.person.count(),
      prisma.mandate.count(),
      prisma.transaction.count(),
      prisma.engagement.count(),
      prisma.activity.count(),
    ]);

  console.log(
    `Seeded: ${uCount} users, ${iCount} investors, ${cCount} clients, ${pCount} partners, ${peCount} persons, ${mCount} mandates, ${tCount} transactions, ${eCount} engagements, ${aCount} activities`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
