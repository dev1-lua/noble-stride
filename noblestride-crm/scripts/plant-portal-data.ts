// plant-portal-data.ts — make the investor & partner portals demo-dense,
// per spec §3.5/§3.6/§5.3: every Active investor gets engagements across
// active deals at varied stages; every partner gets referred mandates and
// fee-sharing terms; every active deal gets investor-facing documents.
// Idempotent: checks before creating. Run: npx tsx scripts/plant-portal-data.ts
import {
  PrismaClient,
  EngagementStage,
  EngagementStatus,
  InteractionType,
  TransactionStage,
  DealType,
  Instrument,
  PartnerAgreementStatus,
  AdvisorType,
} from "@prisma/client";

const prisma = new PrismaClient();

// Mid-funnel-weighted stage spread so boards and portals show a live pipeline.
const STAGE_SPREAD: EngagementStage[] = [
  "Shared", "TeaserSent", "TeaserSent", "NDASigned", "NDASigned", "IMShared",
  "IMShared", "Meeting", "InfoRequest", "VDRAccess", "DueDiligence",
  "DueDiligence", "TermSheet", "Offer", "Invested", "Declined",
];

const STAGE_TO_LEGACY: Record<EngagementStage, EngagementStatus> = {
  Shared: "NotContacted", TeaserSent: "Contacted", NDASigned: "InConversation",
  IMShared: "InConversation", VDRAccess: "Interested", Meeting: "InConversation",
  InfoRequest: "Interested", DueDiligence: "Interested", TermSheet: "Interested",
  Offer: "Committed", Invested: "Committed", Declined: "Passed",
};

const STAGE_TO_ACTIVITY: Partial<Record<EngagementStage, InteractionType>> = {
  Shared: "Outreach", TeaserSent: "Outreach", NDASigned: "NDASigned",
  IMShared: "Email", VDRAccess: "DataRoomAccess", Meeting: "Meeting",
  InfoRequest: "Email", DueDiligence: "Meeting", TermSheet: "TermSheet",
  Offer: "TermSheet", Invested: "Note", Declined: "Feedback",
};

const POST_NDA: EngagementStage[] = [
  "NDASigned", "IMShared", "VDRAccess", "Meeting", "InfoRequest",
  "DueDiligence", "TermSheet", "Offer", "Invested",
];

const NEW_TXN_TABLE: {
  stage: TransactionStage; dealType: DealType; instrument: Instrument[]; raise: number;
}[] = [
  { stage: "InvestorOutreach", dealType: "Growth", instrument: ["Equity"], raise: 4_000_000 },
  { stage: "DueDiligence", dealType: "Expansion", instrument: ["Debt"], raise: 7_500_000 },
  { stage: "InvestorOutreach", dealType: "SeriesA", instrument: ["Equity", "Convertible"], raise: 3_000_000 },
  { stage: "TermSheet", dealType: "Growth", instrument: ["Mezzanine"], raise: 12_000_000 },
  { stage: "DealPreparation", dealType: "Expansion", instrument: ["Debt", "Equity"], raise: 9_000_000 },
  { stage: "DueDiligence", dealType: "AcquisitionFinance", instrument: ["Debt"], raise: 15_000_000 },
];

const FEE_TERMS = [
  "20% of Noblestride advisory success fee on closed transactions.",
  "25% of success fee on referred deals closing within 18 months.",
  "Flat referral fee: 1% of capital raised on introduced mandates.",
  "15% of advisory fee, payable on disbursement.",
];

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function main() {
  const users = await prisma.user.findMany({ where: { isActive: true } });

  // ── 1. Promote real signed mandates without a transaction into deals ──────
  const signedMandates = await prisma.mandate.findMany({
    where: { stage: "Signed", transactions: { none: {} } },
    include: { client: true },
    orderBy: { eaSignedDate: "desc" },
    take: NEW_TXN_TABLE.length,
  });
  let txnsCreated = 0;
  for (const [i, m] of signedMandates.entries()) {
    const cfg = NEW_TXN_TABLE[i];
    const name = `${m.client.name} – ${cfg.dealType === "AcquisitionFinance" ? "Acquisition Finance" : cfg.dealType}`;
    const exists = await prisma.transaction.findFirst({ where: { name } });
    if (exists) continue;
    await prisma.transaction.create({
      data: {
        name, stage: cfg.stage, dealType: cfg.dealType, instrument: cfg.instrument,
        targetRaise: cfg.raise, sector: m.client.sector,
        dateOpened: m.eaSignedDate ?? daysAgo(90 + i * 10),
        clientId: m.clientId, mandateId: m.id,
        ownerId: users[i % users.length]?.id, createdSource: "IMPORT",
      },
    });
    txnsCreated++;
  }

  const activeTxns = await prisma.transaction.findMany({
    where: { stage: { notIn: ["ClosedWon", "ClosedLost"] } },
    include: { client: true },
    orderBy: { createdAt: "asc" },
  });

  // ── 2. Engagements: every Active investor works 2–4 active deals ──────────
  const investors = await prisma.investor.findMany({
    where: { engagementClassification: "Active" },
    include: { engagements: { select: { transactionId: true, engagementStage: true } } },
    orderBy: { name: "asc" },
  });
  let engCreated = 0;
  for (const [i, inv] of investors.entries()) {
    const engagedTxnIds = new Set(inv.engagements.map((e) => e.transactionId));
    const activeCount = inv.engagements.filter((e) =>
      activeTxns.some((t) => t.id === e.transactionId),
    ).length;
    const want = 2 + (i % 3); // 2–4 engagements on active deals
    let need = Math.max(0, want - activeCount);
    for (let k = 0; k < activeTxns.length && need > 0; k++) {
      const txn = activeTxns[(i + k) % activeTxns.length];
      if (engagedTxnIds.has(txn.id)) continue;
      const stage = STAGE_SPREAD[(i * 3 + k * 5) % STAGE_SPREAD.length];
      const postNda = POST_NDA.includes(stage);
      const invested = stage === "Invested";
      const total = invested ? [1.5, 2.5, 4, 6][(i + k) % 4] * 1_000_000 : null;
      const disbursed = total != null ? total * [0.4, 0.6, 1][(i + k) % 3] : null;
      const lastContact = daysAgo(((i * 7 + k * 11) % 45) + 1);
      const eng = await prisma.engagement.create({
        data: {
          name: `${inv.name} × ${txn.name}`,
          transactionId: txn.id, investorId: inv.id,
          status: STAGE_TO_LEGACY[stage], engagementStage: stage,
          interestLevel: (["Low", "Medium", "High"] as const)[(i + k) % 3],
          ndaType: postNda ? ((i + k) % 2 ? "Closed" : "Open") : null,
          termSheetIssued: ["TermSheet", "Offer", "Invested"].includes(stage),
          termSheetDate: ["TermSheet", "Offer", "Invested"].includes(stage)
            ? daysAgo(((i + k) % 30) + 5) : null,
          totalAmount: total, amountDisbursed: disbursed,
          amountPending: total != null && disbursed != null ? total - disbursed : null,
          disbursementStatus: invested ? (disbursed === total ? "Disbursed" : "Ongoing") : null,
          dateReceived: invested ? daysAgo(((i + k) % 60) + 10) : null,
          probability: stage === "Declined" ? 0 : 20 + ((i * 13 + k * 17) % 70),
          lastContact, ownerId: users[(i + k) % users.length]?.id,
          createdSource: "IMPORT",
        },
      });
      const actType = STAGE_TO_ACTIVITY[stage];
      if (actType) {
        await prisma.activity.create({
          data: {
            type: actType,
            subject: `${inv.name} — ${txn.name}`,
            occurredAt: lastContact,
            engagementId: eng.id, transactionId: txn.id, investorId: inv.id,
            createdById: users[(i + k) % users.length]?.id, createdSource: "IMPORT",
          },
        });
      }
      engagedTxnIds.add(txn.id);
      engCreated++;
      need--;
    }
  }

  // ── 3. Partners: referred mandates + fee-sharing terms ────────────────────
  const partners = await prisma.partner.findMany({
    include: { referredMandates: { select: { id: true } } },
    orderBy: { name: "asc" },
  });
  const pool = await prisma.mandate.findMany({
    where: { referredById: null },
    orderBy: { dateOpened: "desc" },
  });
  let poolIdx = 0;
  let referralsAssigned = 0;
  let partnersUpdated = 0;
  for (const [i, p] of partners.entries()) {
    if (p.referredMandates.length === 0) {
      const take = 2 + (i % 4); // 2–5 referrals each
      const ids = pool.slice(poolIdx, poolIdx + take).map((m) => m.id);
      poolIdx += take;
      if (ids.length) {
        await prisma.mandate.updateMany({
          where: { id: { in: ids } },
          data: { referredById: p.id, source: "Referral" },
        });
        referralsAssigned += ids.length;
      }
    }
    const fee = i % 3 !== 2; // two thirds get fee-sharing
    await prisma.partner.update({
      where: { id: p.id },
      data: {
        feeSharingAgreement: p.feeSharingAgreement || fee,
        feeSharingTerms: p.feeSharingTerms ?? (fee ? FEE_TERMS[i % FEE_TERMS.length] : null),
        partnerAgreementStatus:
          p.partnerAgreementStatus === "None"
            ? ((fee ? "Signed" : i % 2 ? "Sent" : "None") as PartnerAgreementStatus)
            : p.partnerAgreementStatus,
        advisorType:
          p.advisorType ??
          ((["Lawyer", "TransactionAdvisor", "Consultant", "AdvisoryFirm"] as AdvisorType[])[i % 4]),
      },
    });
    partnersUpdated++;
  }

  // ── 4. Investor-facing documents per active deal (teaser / IM / VDR) ──────
  let docsCreated = 0;
  for (const [i, txn] of activeTxns.entries()) {
    const wanted = [
      { name: `Teaser — ${txn.client.name}`, type: "Teaser", accessLevel: "InvestorShared", status: "Shared", version: "1.2" },
      { name: `Information Memorandum — ${txn.client.name}`, type: "IM", accessLevel: "InvestorShared", status: "Approved", version: "2.0" },
      { name: `Financial Model — ${txn.client.name}`, type: "FinancialModel", accessLevel: "VDR", status: "Approved", version: "3.1" },
      { name: `Audited Accounts FY2025 — ${txn.client.name}`, type: "AuditedAccounts", accessLevel: "VDR", status: "Shared", version: null },
    ] as const;
    for (const [j, d] of wanted.entries()) {
      const exists = await prisma.document.findFirst({ where: { name: d.name } });
      if (exists) continue;
      await prisma.document.create({
        data: {
          name: d.name, type: d.type, version: d.version ?? undefined,
          accessLevel: d.accessLevel, status: d.status,
          uploadedAt: daysAgo(((i * 5 + j * 3) % 90) + 3),
          uploadedById: users[(i + j) % users.length]?.id,
          transactionId: txn.id, clientId: txn.clientId, createdSource: "IMPORT",
        },
      });
      docsCreated++;
    }
  }

  console.log({
    txnsCreated,
    engagementsCreated: engCreated,
    referralsAssigned,
    partnersUpdated,
    docsCreated,
    activeDeals: activeTxns.length,
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
