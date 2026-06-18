// GraphQL object types for the NobleStride Capital CRM.
// One `builder.prismaObject` per Prisma model (9 total).
// Task is OUT OF SCOPE — do NOT expose it or any `tasks` relation.

import { builder } from "./builder";
import {
  SectorEnum,
  InvestorTypeEnum,
  InvestorStatusEnum,
  InstrumentEnum,
  InvestmentStageEnum,
  GeographyEnum,
  MandateStageEnum,
  TransactionStageEnum,
  EngagementStatusEnum,
  SourceEnum,
  DocStatusEnum,
  DealTypeEnum,
  PartnerTypeEnum,
  PartnerStatusEnum,
  FounderGenderEnum,
  InteractionTypeEnum,
  ActorSourceEnum,
} from "./builder";
import { daysInStage } from "@/server/domain/metrics";
import { ACTIVE_CONVERSATION_STATUSES } from "@/server/domain/types";

// ─── User ────────────────────────────────────────────────────────────────────

builder.prismaObject("User", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    email: t.exposeString("email"),
    jobTitle: t.exposeString("jobTitle", { nullable: true }),
    avatarColor: t.exposeString("avatarColor", { nullable: true }),
    isActive: t.exposeBoolean("isActive"),
    createdAt: t.field({ type: "DateTime", resolve: (u) => u.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (u) => u.updatedAt }),
    // Relations — tasks excluded per brief
    ledMandates: t.relation("ledMandates"),
    ownedTransactions: t.relation("ownedTransactions"),
    ownedEngagements: t.relation("ownedEngagements"),
    activities: t.relation("activities"),
  }),
});

// ─── Person ──────────────────────────────────────────────────────────────────

builder.prismaObject("Person", {
  fields: (t) => ({
    id: t.exposeID("id"),
    firstName: t.exposeString("firstName"),
    lastName: t.exposeString("lastName", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    phone: t.exposeString("phone", { nullable: true }),
    jobTitle: t.exposeString("jobTitle", { nullable: true }),
    linkedinUrl: t.exposeString("linkedinUrl", { nullable: true }),
    createdAt: t.field({ type: "DateTime", resolve: (p) => p.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (p) => p.updatedAt }),
    // FK scalars
    investorId: t.exposeString("investorId", { nullable: true }),
    clientId: t.exposeString("clientId", { nullable: true }),
    partnerId: t.exposeString("partnerId", { nullable: true }),
    // Relations
    investor: t.relation("investor", { nullable: true }),
    client: t.relation("client", { nullable: true }),
    partner: t.relation("partner", { nullable: true }),
  }),
});

// ─── Investor ────────────────────────────────────────────────────────────────

builder.prismaObject("Investor", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    investorType: t.field({ type: InvestorTypeEnum, resolve: (i) => i.investorType }),
    website: t.exposeString("website", { nullable: true }),
    status: t.field({ type: InvestorStatusEnum, nullable: true, resolve: (i) => i.status }),
    // Enum arrays
    sectorFocus: t.field({ type: [SectorEnum], resolve: (i) => i.sectorFocus }),
    geographicFocus: t.field({ type: [GeographyEnum], resolve: (i) => i.geographicFocus }),
    instruments: t.field({ type: [InstrumentEnum], resolve: (i) => i.instruments }),
    investmentStages: t.field({ type: [InvestmentStageEnum], resolve: (i) => i.investmentStages }),
    // Money (Decimal → Float)
    aum: t.float({ nullable: true, resolve: (i) => (i.aum == null ? null : Number(i.aum)) }),
    ticketMin: t.float({ nullable: true, resolve: (i) => (i.ticketMin == null ? null : Number(i.ticketMin)) }),
    ticketMax: t.float({ nullable: true, resolve: (i) => (i.ticketMax == null ? null : Number(i.ticketMax)) }),
    currency: t.exposeString("currency"),
    targetIrr: t.exposeFloat("targetIrr", { nullable: true }),
    countryRestrictions: t.exposeString("countryRestrictions", { nullable: true }),
    esgFocus: t.exposeString("esgFocus", { nullable: true }),
    decisionProcess: t.exposeString("decisionProcess", { nullable: true }),
    notes: t.exposeString("notes", { nullable: true }),
    createdAt: t.field({ type: "DateTime", resolve: (i) => i.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (i) => i.updatedAt }),
    // Relations — tasks excluded per brief
    contacts: t.relation("contacts"),
    engagements: t.relation("engagements"),
    activities: t.relation("activities"),
    // Counts
    engagementCount: t.relationCount("engagements"),
  }),
});

// ─── Client ──────────────────────────────────────────────────────────────────

builder.prismaObject("Client", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    yearFounded: t.exposeInt("yearFounded", { nullable: true }),
    hqCity: t.exposeString("hqCity", { nullable: true }),
    // Enum arrays
    countries: t.field({ type: [GeographyEnum], resolve: (c) => c.countries }),
    website: t.exposeString("website", { nullable: true }),
    sector: t.field({ type: [SectorEnum], resolve: (c) => c.sector }),
    coreProduct: t.exposeString("coreProduct", { nullable: true }),
    description: t.exposeString("description", { nullable: true }),
    founders: t.exposeString("founders", { nullable: true }),
    founderGender: t.field({ type: FounderGenderEnum, nullable: true, resolve: (c) => c.founderGender }),
    // Money
    revenueLastYear: t.float({ nullable: true, resolve: (c) => (c.revenueLastYear == null ? null : Number(c.revenueLastYear)) }),
    revenueForecast: t.float({ nullable: true, resolve: (c) => (c.revenueForecast == null ? null : Number(c.revenueForecast)) }),
    currency: t.exposeString("currency"),
    profitable: t.exposeBoolean("profitable", { nullable: true }),
    existingInvestors: t.exposeString("existingInvestors", { nullable: true }),
    source: t.field({ type: SourceEnum, nullable: true, resolve: (c) => c.source }),
    pitchDeckUrl: t.exposeString("pitchDeckUrl", { nullable: true }),
    createdAt: t.field({ type: "DateTime", resolve: (c) => c.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (c) => c.updatedAt }),
    // Relations — tasks excluded per brief
    contacts: t.relation("contacts"),
    mandates: t.relation("mandates"),
    transactions: t.relation("transactions"),
  }),
});

// ─── Mandate ─────────────────────────────────────────────────────────────────

builder.prismaObject("Mandate", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    stage: t.field({ type: MandateStageEnum, resolve: (m) => m.stage }),
    stageEnteredAt: t.field({ type: "DateTime", resolve: (m) => m.stageEnteredAt }),
    // Derived: whole days elapsed in current stage
    daysInStage: t.int({ resolve: (m) => daysInStage(m.stageEnteredAt) }),
    // Money
    dealSize: t.float({ nullable: true, resolve: (m) => (m.dealSize == null ? null : Number(m.dealSize)) }),
    currency: t.exposeString("currency"),
    // Enum arrays
    sector: t.field({ type: [SectorEnum], resolve: (m) => m.sector }),
    source: t.field({ type: SourceEnum, nullable: true, resolve: (m) => m.source }),
    dateOpened: t.field({ type: "DateTime", nullable: true, resolve: (m) => m.dateOpened }),
    ndaStatus: t.field({ type: DocStatusEnum, resolve: (m) => m.ndaStatus }),
    ndaSentDate: t.field({ type: "DateTime", nullable: true, resolve: (m) => m.ndaSentDate }),
    ndaSignedDate: t.field({ type: "DateTime", nullable: true, resolve: (m) => m.ndaSignedDate }),
    eaStatus: t.field({ type: DocStatusEnum, resolve: (m) => m.eaStatus }),
    eaSentDate: t.field({ type: "DateTime", nullable: true, resolve: (m) => m.eaSentDate }),
    eaSignedDate: t.field({ type: "DateTime", nullable: true, resolve: (m) => m.eaSignedDate }),
    nextAction: t.exposeString("nextAction", { nullable: true }),
    notes: t.exposeString("notes", { nullable: true }),
    createdAt: t.field({ type: "DateTime", resolve: (m) => m.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (m) => m.updatedAt }),
    // FK scalars
    clientId: t.exposeString("clientId"),
    leadId: t.exposeString("leadId", { nullable: true }),
    referredById: t.exposeString("referredById", { nullable: true }),
    // Relations — tasks excluded per brief
    client: t.relation("client"),
    lead: t.relation("lead", { nullable: true }),
    referredBy: t.relation("referredBy", { nullable: true }),
    transactions: t.relation("transactions"),
    activities: t.relation("activities"),
  }),
});

// ─── Transaction ─────────────────────────────────────────────────────────────

builder.prismaObject("Transaction", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    stage: t.field({ type: TransactionStageEnum, resolve: (tx) => tx.stage }),
    stageEnteredAt: t.field({ type: "DateTime", resolve: (tx) => tx.stageEnteredAt }),
    dealType: t.field({ type: DealTypeEnum, nullable: true, resolve: (tx) => tx.dealType }),
    // Enum arrays
    instrument: t.field({ type: [InstrumentEnum], resolve: (tx) => tx.instrument }),
    // Money
    targetRaise: t.float({ nullable: true, resolve: (tx) => (tx.targetRaise == null ? null : Number(tx.targetRaise)) }),
    currency: t.exposeString("currency"),
    sector: t.field({ type: [SectorEnum], resolve: (tx) => tx.sector }),
    dateOpened: t.field({ type: "DateTime", nullable: true, resolve: (tx) => tx.dateOpened }),
    closedAt: t.field({ type: "DateTime", nullable: true, resolve: (tx) => tx.closedAt }),
    createdAt: t.field({ type: "DateTime", resolve: (tx) => tx.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (tx) => tx.updatedAt }),
    // FK scalars
    clientId: t.exposeString("clientId"),
    mandateId: t.exposeString("mandateId", { nullable: true }),
    ownerId: t.exposeString("ownerId", { nullable: true }),
    // Relations — tasks excluded per brief
    client: t.relation("client"),
    mandate: t.relation("mandate", { nullable: true }),
    owner: t.relation("owner", { nullable: true }),
    engagements: t.relation("engagements"),
    activities: t.relation("activities"),
    // Derived counts
    investorsContacted: t.relationCount("engagements"),
    activeConversations: t.int({
      resolve: async (txn, _args, ctx) =>
        ctx.prisma.engagement.count({
          where: { transactionId: txn.id, status: { in: ACTIVE_CONVERSATION_STATUSES } },
        }),
    }),
  }),
});

// ─── Engagement ───────────────────────────────────────────────────────────────

builder.prismaObject("Engagement", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    status: t.field({ type: EngagementStatusEnum, resolve: (e) => e.status }),
    lastContact: t.field({ type: "DateTime", nullable: true, resolve: (e) => e.lastContact }),
    notes: t.exposeString("notes", { nullable: true }),
    createdSource: t.field({ type: ActorSourceEnum, resolve: (e) => e.createdSource }),
    createdAt: t.field({ type: "DateTime", resolve: (e) => e.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (e) => e.updatedAt }),
    // FK scalars
    transactionId: t.exposeString("transactionId"),
    investorId: t.exposeString("investorId"),
    ownerId: t.exposeString("ownerId", { nullable: true }),
    // Relations
    transaction: t.relation("transaction"),
    investor: t.relation("investor"),
    owner: t.relation("owner", { nullable: true }),
    activities: t.relation("activities"),
  }),
});

// ─── Partner ─────────────────────────────────────────────────────────────────

builder.prismaObject("Partner", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    partnerType: t.field({ type: PartnerTypeEnum, nullable: true, resolve: (p) => p.partnerType }),
    profile: t.exposeString("profile", { nullable: true }),
    status: t.field({ type: PartnerStatusEnum, resolve: (p) => p.status }),
    location: t.exposeString("location", { nullable: true }),
    // Money
    amount: t.float({ nullable: true, resolve: (p) => (p.amount == null ? null : Number(p.amount)) }),
    currency: t.exposeString("currency"),
    createdAt: t.field({ type: "DateTime", resolve: (p) => p.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (p) => p.updatedAt }),
    // Relations
    contacts: t.relation("contacts"),
    referredMandates: t.relation("referredMandates"),
    referredMandateCount: t.relationCount("referredMandates"),
  }),
});

// ─── Activity ────────────────────────────────────────────────────────────────

builder.prismaObject("Activity", {
  fields: (t) => ({
    id: t.exposeID("id"),
    type: t.field({ type: InteractionTypeEnum, resolve: (a) => a.type }),
    subject: t.exposeString("subject", { nullable: true }),
    body: t.exposeString("body", { nullable: true }),
    occurredAt: t.field({ type: "DateTime", resolve: (a) => a.occurredAt }),
    createdSource: t.field({ type: ActorSourceEnum, resolve: (a) => a.createdSource }),
    createdAt: t.field({ type: "DateTime", resolve: (a) => a.createdAt }),
    // FK scalars
    engagementId: t.exposeString("engagementId", { nullable: true }),
    transactionId: t.exposeString("transactionId", { nullable: true }),
    investorId: t.exposeString("investorId", { nullable: true }),
    mandateId: t.exposeString("mandateId", { nullable: true }),
    createdById: t.exposeString("createdById", { nullable: true }),
    // Relations
    engagement: t.relation("engagement", { nullable: true }),
    transaction: t.relation("transaction", { nullable: true }),
    investor: t.relation("investor", { nullable: true }),
    mandate: t.relation("mandate", { nullable: true }),
    createdBy: t.relation("createdBy", { nullable: true }),
  }),
});
