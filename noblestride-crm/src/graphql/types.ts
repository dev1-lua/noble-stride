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
  EngagementStageEnum,
  InterestLevelEnum,
  NdaTypeEnum,
  DisbursementStatusEnum,
  SourceEnum,
  DocStatusEnum,
  DealTypeEnum,
  PartnerTypeEnum,
  PartnerStatusEnum,
  FounderGenderEnum,
  InteractionTypeEnum,
  ActorSourceEnum,
  ServiceProviderTypeEnum,
  DocumentTypeEnum,
  DocumentAccessLevelEnum,
  DocumentStatusEnum,
  InvestorEngagementClassificationEnum,
  InvestorNdaStatusEnum,
  AdvisorTypeEnum,
  PartnerAgreementStatusEnum,
  DealStatusEnum,
  DealMilestoneEnum,
  DealFinancingTypeEnum,
  MaxSellingStakeEnum,
  ImpactFlagEnum,
  ClientStatusEnum,
  CommChannelEnum,
  CommDirectionEnum,
} from "./builder";
import { daysInStage } from "@/server/domain/metrics";
import { ACTIVE_CONVERSATION_STATUSES } from "@/server/domain/types";

// ─── User ────────────────────────────────────────────────────────────────────

export const UserRef = builder.prismaObject("User", {
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

export const PersonRef = builder.prismaObject("Person", {
  fields: (t) => ({
    id: t.exposeID("id"),
    firstName: t.exposeString("firstName"),
    lastName: t.exposeString("lastName", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    phone: t.exposeString("phone", { nullable: true }),
    jobTitle: t.exposeString("jobTitle", { nullable: true }),
    linkedinUrl: t.exposeString("linkedinUrl", { nullable: true }),
    isPrimaryContact: t.exposeBoolean("isPrimaryContact"),
    isSSAContact: t.exposeBoolean("isSSAContact"),
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

export const InvestorRef = builder.prismaObject("Investor", {
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
    // Task 5: engagement classification, NDA status, profile fields
    engagementClassification: t.field({ type: InvestorEngagementClassificationEnum, resolve: (i) => i.engagementClassification }),
    ndaStatus: t.field({ type: InvestorNdaStatusEnum, resolve: (i) => i.ndaStatus }),
    shareholdingPreference: t.exposeString("shareholdingPreference", { nullable: true }),
    minRevenue: t.float({ nullable: true, resolve: (i) => (i.minRevenue == null ? null : Number(i.minRevenue)) }),
    minEbitda: t.float({ nullable: true, resolve: (i) => (i.minEbitda == null ? null : Number(i.minEbitda)) }),
    minLoanBook: t.float({ nullable: true, resolve: (i) => (i.minLoanBook == null ? null : Number(i.minLoanBook)) }),
    pricingPreference: t.exposeString("pricingPreference", { nullable: true }),
    remainingInvestmentPeriod: t.exposeString("remainingInvestmentPeriod", { nullable: true }),
    ddRequirements: t.exposeString("ddRequirements", { nullable: true }),
    icApprovalProcess: t.exposeString("icApprovalProcess", { nullable: true }),
    trackRecord: t.exposeString("trackRecord", { nullable: true }),
    investmentMandate: t.exposeString("investmentMandate", { nullable: true }),
    notableInvestments: t.exposeString("notableInvestments", { nullable: true }),
    portfolioComposition: t.exposeString("portfolioComposition", { nullable: true }),
    caseStudies: t.exposeString("caseStudies", { nullable: true }),
    reinvestmentPolicy: t.exposeString("reinvestmentPolicy", { nullable: true }),
    teamComposition: t.exposeString("teamComposition", { nullable: true }),
    collaborationTerms: t.exposeString("collaborationTerms", { nullable: true }),
    impactMetrics: t.exposeString("impactMetrics", { nullable: true }),
    reputationalRisks: t.exposeString("reputationalRisks", { nullable: true }),
    nextActionDate: t.field({ type: "DateTime", nullable: true, resolve: (i) => i.nextActionDate }),
    feedback: t.exposeString("feedback", { nullable: true }),
    ssaRegionContactId: t.exposeString("ssaRegionContactId", { nullable: true }),
    ssaRegionContact: t.relation("ssaRegionContact", { nullable: true }),
    createdSource: t.field({ type: ActorSourceEnum, resolve: (r) => r.createdSource }),
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

export const ClientRef = builder.prismaObject("Client", {
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
    // Spec-gap: company profile fields (spec §3.1/§3.2)
    codename: t.exposeString("codename", { nullable: true }),
    registrationNo: t.exposeString("registrationNo", { nullable: true }),
    hqCountry: t.exposeString("hqCountry", { nullable: true }),
    businessModel: t.exposeString("businessModel", { nullable: true }),
    foundersNationality: t.exposeString("foundersNationality", { nullable: true }),
    ownershipStructure: t.exposeString("ownershipStructure", { nullable: true }),
    directorsManagement: t.exposeString("directorsManagement", { nullable: true }),
    targetClients: t.exposeString("targetClients", { nullable: true }),
    staffCount: t.exposeInt("staffCount", { nullable: true }),
    branchCount: t.exposeInt("branchCount", { nullable: true }),
    ebitda: t.float({ nullable: true, resolve: (c) => (c.ebitda == null ? null : Number(c.ebitda)) }),
    netProfit: t.float({ nullable: true, resolve: (c) => (c.netProfit == null ? null : Number(c.netProfit)) }),
    existingDebt: t.float({ nullable: true, resolve: (c) => (c.existingDebt == null ? null : Number(c.existingDebt)) }),
    loanBook: t.float({ nullable: true, resolve: (c) => (c.loanBook == null ? null : Number(c.loanBook)) }),
    totalAssets: t.float({ nullable: true, resolve: (c) => (c.totalAssets == null ? null : Number(c.totalAssets)) }),
    impactFlags: t.field({ type: [ImpactFlagEnum], resolve: (c) => c.impactFlags }),
    status: t.field({ type: ClientStatusEnum, resolve: (c) => c.status }),
    createdSource: t.field({ type: ActorSourceEnum, resolve: (r) => r.createdSource }),
    createdAt: t.field({ type: "DateTime", resolve: (c) => c.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (c) => c.updatedAt }),
    // Relations — tasks excluded per brief
    contacts: t.relation("contacts"),
    mandates: t.relation("mandates"),
    transactions: t.relation("transactions"),
    activities: t.relation("activities"),
  }),
});

// ─── Mandate ─────────────────────────────────────────────────────────────────

export const MandateRef = builder.prismaObject("Mandate", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    stage: t.field({ type: MandateStageEnum, resolve: (m) => m.stage }),
    stageEnteredAt: t.field({ type: "DateTime", resolve: (m) => m.stageEnteredAt }),
    dealStatus: t.field({ type: DealStatusEnum, resolve: (m) => m.dealStatus }),
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
    createdSource: t.field({ type: ActorSourceEnum, resolve: (r) => r.createdSource }),
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

export const TransactionRef = builder.prismaObject("Transaction", {
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
    successFeeAmount: t.float({ nullable: true, resolve: (tx) => (tx.successFeeAmount == null ? null : Number(tx.successFeeAmount)) }),
    successFeeInvoicedDate: t.field({ type: "DateTime", nullable: true, resolve: (tx) => tx.successFeeInvoicedDate }),
    successFeePaidDate: t.field({ type: "DateTime", nullable: true, resolve: (tx) => tx.successFeePaidDate }),
    // Spec-gap: deal status/milestone/financing fields (spec §4.1/§4.3/§4.5/§4.7)
    dealStatus: t.field({ type: DealStatusEnum, resolve: (tx) => tx.dealStatus }),
    dealMilestone: t.field({ type: DealMilestoneEnum, nullable: true, resolve: (tx) => tx.dealMilestone }),
    financingType: t.field({ type: DealFinancingTypeEnum, nullable: true, resolve: (tx) => tx.financingType }),
    maxSellingStake: t.field({ type: MaxSellingStakeEnum, nullable: true, resolve: (tx) => tx.maxSellingStake }),
    targetProfile: t.exposeString("targetProfile", { nullable: true }),
    useOfFunds: t.exposeString("useOfFunds", { nullable: true }),
    vdrLink: t.exposeString("vdrLink", { nullable: true }),
    probability: t.exposeInt("probability", { nullable: true }),
    notes: t.exposeString("notes", { nullable: true }),
    createdSource: t.field({ type: ActorSourceEnum, resolve: (r) => r.createdSource }),
    createdAt: t.field({ type: "DateTime", resolve: (tx) => tx.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (tx) => tx.updatedAt }),
    // FK scalars
    clientId: t.exposeString("clientId"),
    mandateId: t.exposeString("mandateId", { nullable: true }),
    ownerId: t.exposeString("ownerId", { nullable: true }),
    assistantId: t.exposeString("assistantId", { nullable: true }),
    // Relations — tasks excluded per brief
    client: t.relation("client"),
    mandate: t.relation("mandate", { nullable: true }),
    owner: t.relation("owner", { nullable: true }),
    assistant: t.relation("assistant", { nullable: true }),
    engagements: t.relation("engagements"),
    activities: t.relation("activities"),
    serviceProviders: t.relation("serviceProviders"),
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

export const EngagementRef = builder.prismaObject("Engagement", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    status: t.field({ type: EngagementStatusEnum, resolve: (e) => e.status }),
    lastContact: t.field({ type: "DateTime", nullable: true, resolve: (e) => e.lastContact }),
    notes: t.exposeString("notes", { nullable: true }),
    engagementStage: t.field({ type: EngagementStageEnum, resolve: (e) => e.engagementStage }),
    interestLevel: t.field({ type: InterestLevelEnum, nullable: true, resolve: (e) => e.interestLevel }),
    ndaType: t.field({ type: NdaTypeEnum, nullable: true, resolve: (e) => e.ndaType }),
    termSheetIssued: t.exposeBoolean("termSheetIssued"),
    termSheetDate: t.field({ type: "DateTime", nullable: true, resolve: (e) => e.termSheetDate }),
    totalAmount: t.float({ nullable: true, resolve: (e) => (e.totalAmount == null ? null : Number(e.totalAmount)) }),
    amountDisbursed: t.float({ nullable: true, resolve: (e) => (e.amountDisbursed == null ? null : Number(e.amountDisbursed)) }),
    amountPending: t.float({ nullable: true, resolve: (e) => (e.amountPending == null ? null : Number(e.amountPending)) }),
    disbursementStatus: t.field({ type: DisbursementStatusEnum, nullable: true, resolve: (e) => e.disbursementStatus }),
    dateReceived: t.field({ type: "DateTime", nullable: true, resolve: (e) => e.dateReceived }),
    year: t.exposeInt("year", { nullable: true }),
    quarter: t.exposeInt("quarter", { nullable: true }),
    probability: t.exposeInt("probability", { nullable: true }),
    feedback: t.exposeString("feedback", { nullable: true }),
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

export const PartnerRef = builder.prismaObject("Partner", {
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
    // Task 6: advisor type, fee-sharing, partner agreement, internal-only, direct contact
    advisorType: t.field({ type: AdvisorTypeEnum, nullable: true, resolve: (p) => p.advisorType }),
    organization: t.exposeString("organization", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    phone: t.exposeString("phone", { nullable: true }),
    feeSharingAgreement: t.exposeBoolean("feeSharingAgreement"),
    feeSharingTerms: t.exposeString("feeSharingTerms", { nullable: true }),
    partnerAgreementStatus: t.field({ type: PartnerAgreementStatusEnum, resolve: (p) => p.partnerAgreementStatus }),
    internalOnly: t.exposeBoolean("internalOnly"),
    createdSource: t.field({ type: ActorSourceEnum, resolve: (r) => r.createdSource }),
    createdAt: t.field({ type: "DateTime", resolve: (p) => p.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (p) => p.updatedAt }),
    // Relations
    contacts: t.relation("contacts"),
    referredMandates: t.relation("referredMandates"),
    referredMandateCount: t.relationCount("referredMandates"),
  }),
});

// ─── ServiceProvider ─────────────────────────────────────────────────────────

export const ServiceProviderRef = builder.prismaObject("ServiceProvider", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    type: t.field({ type: ServiceProviderTypeEnum, resolve: (sp) => sp.type }),
    contactPerson: t.exposeString("contactPerson", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    phone: t.exposeString("phone", { nullable: true }),
    profile: t.exposeString("profile", { nullable: true }),
    // Money (Decimal → Float)
    fee: t.float({ nullable: true, resolve: (sp) => (sp.fee == null ? null : Number(sp.fee)) }),
    currency: t.exposeString("currency"),
    status: t.exposeString("status", { nullable: true }),
    createdSource: t.field({ type: ActorSourceEnum, resolve: (sp) => sp.createdSource }),
    createdAt: t.field({ type: "DateTime", resolve: (sp) => sp.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (sp) => sp.updatedAt }),
    // Relations
    engagedOn: t.relation("engagedOn"),
  }),
});

// ─── Activity ────────────────────────────────────────────────────────────────

export const ActivityRef = builder.prismaObject("Activity", {
  fields: (t) => ({
    id: t.exposeID("id"),
    type: t.field({ type: InteractionTypeEnum, resolve: (a) => a.type }),
    subject: t.exposeString("subject", { nullable: true }),
    body: t.exposeString("body", { nullable: true }),
    occurredAt: t.field({ type: "DateTime", resolve: (a) => a.occurredAt }),
    createdSource: t.field({ type: ActorSourceEnum, resolve: (a) => a.createdSource }),
    createdAt: t.field({ type: "DateTime", resolve: (a) => a.createdAt }),
    // Spec-gap: communication channel/direction (spec §3.10)
    channel: t.field({ type: CommChannelEnum, nullable: true, resolve: (a) => a.channel }),
    direction: t.field({ type: CommDirectionEnum, nullable: true, resolve: (a) => a.direction }),
    // FK scalars
    engagementId: t.exposeString("engagementId", { nullable: true }),
    transactionId: t.exposeString("transactionId", { nullable: true }),
    investorId: t.exposeString("investorId", { nullable: true }),
    mandateId: t.exposeString("mandateId", { nullable: true }),
    clientId: t.exposeString("clientId", { nullable: true }),
    createdById: t.exposeString("createdById", { nullable: true }),
    // Relations — tasks excluded per brief
    engagement: t.relation("engagement", { nullable: true }),
    transaction: t.relation("transaction", { nullable: true }),
    investor: t.relation("investor", { nullable: true }),
    mandate: t.relation("mandate", { nullable: true }),
    client: t.relation("client", { nullable: true }),
    createdBy: t.relation("createdBy", { nullable: true }),
  }),
});

// ─── Document ────────────────────────────────────────────────────────────────

export const DocumentRef = builder.prismaObject("Document", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    type: t.field({ type: DocumentTypeEnum, resolve: (d) => d.type }),
    version: t.exposeString("version", { nullable: true }),
    accessLevel: t.field({ type: DocumentAccessLevelEnum, resolve: (d) => d.accessLevel }),
    status: t.field({ type: DocumentStatusEnum, nullable: true, resolve: (d) => d.status }),
    fileUrl: t.exposeString("fileUrl", { nullable: true }),
    uploadedAt: t.field({ type: "DateTime", resolve: (d) => d.uploadedAt }),
    createdSource: t.field({ type: ActorSourceEnum, resolve: (d) => d.createdSource }),
    createdAt: t.field({ type: "DateTime", resolve: (d) => d.createdAt }),
    reviewedAt: t.field({ type: "DateTime", nullable: true, resolve: (d) => d.reviewedAt }),
    approvedAt: t.field({ type: "DateTime", nullable: true, resolve: (d) => d.approvedAt }),
    clientReviewedAt: t.field({ type: "DateTime", nullable: true, resolve: (d) => d.clientReviewedAt }),
    // FK scalars
    uploadedById: t.exposeString("uploadedById", { nullable: true }),
    reviewerId: t.exposeString("reviewerId", { nullable: true }),
    approverId: t.exposeString("approverId", { nullable: true }),
    transactionId: t.exposeString("transactionId", { nullable: true }),
    clientId: t.exposeString("clientId", { nullable: true }),
    investorId: t.exposeString("investorId", { nullable: true }),
    // Relations
    uploadedBy: t.relation("uploadedBy", { nullable: true }),
    reviewer: t.relation("reviewer", { nullable: true }),
    approver: t.relation("approver", { nullable: true }),
    transaction: t.relation("transaction", { nullable: true }),
    client: t.relation("client", { nullable: true }),
    investor: t.relation("investor", { nullable: true }),
  }),
});
