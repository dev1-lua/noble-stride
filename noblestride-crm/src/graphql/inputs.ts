// Pothos input types for entity create/update mutations.
// Field optionality mirrors the Zod schemas in src/lib/schemas/*. Only `name`
// (and clientId on Mandate/Transaction) is required; everything else is optional
// so the same input type serves both create and (partial) update.

import {
  builder,
  SectorEnum, InvestorTypeEnum, InvestorStatusEnum, InstrumentEnum, InvestmentStageEnum,
  GeographyEnum, SourceEnum, DocStatusEnum, DealTypeEnum, PartnerTypeEnum, PartnerStatusEnum,
  FounderGenderEnum,
  EngagementStageEnum, InterestLevelEnum, NdaTypeEnum, DisbursementStatusEnum, MilestoneKeyEnum,
  ServiceProviderTypeEnum,
  DocumentTypeEnum, DocumentAccessLevelEnum, DocumentStatusEnum,
  InvestorEngagementClassificationEnum, InvestorNdaStatusEnum,
  AdvisorTypeEnum, PartnerAgreementStatusEnum,
  DealStatusEnum, DealMilestoneEnum, DealFinancingTypeEnum, MaxSellingStakeEnum,
  ImpactFlagEnum, ClientStatusEnum, ProfitabilityEnum,
  TaskStatusEnum, TaskSourceEnum,
  InteractionTypeEnum, CommChannelEnum, CommDirectionEnum,
} from "./builder";

export const InvestorInput = builder.inputType("InvestorInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    investorType: t.field({ type: InvestorTypeEnum, required: false }),
    website: t.string({ required: false }),
    status: t.field({ type: InvestorStatusEnum, required: false }),
    sectorFocus: t.field({ type: [SectorEnum], required: false }),
    geographicFocus: t.field({ type: [GeographyEnum], required: false }),
    instruments: t.field({ type: [InstrumentEnum], required: false }),
    investmentStages: t.field({ type: [InvestmentStageEnum], required: false }),
    aum: t.float({ required: false }),
    ticketMin: t.float({ required: false }),
    ticketMax: t.float({ required: false }),
    currency: t.string({ required: false }),
    targetIrr: t.float({ required: false }),
    countryRestrictions: t.string({ required: false }),
    esgFocus: t.string({ required: false }),
    decisionProcess: t.string({ required: false }),
    notes: t.string({ required: false }),
    // Task 5: engagement classification, NDA status, profile fields
    engagementClassification: t.field({ type: InvestorEngagementClassificationEnum, required: false }),
    ndaStatus: t.field({ type: InvestorNdaStatusEnum, required: false }),
    shareholdingPreference: t.string({ required: false }),
    minRevenue: t.float({ required: false }),
    minEbitda: t.float({ required: false }),
    minLoanBook: t.float({ required: false }),
    pricingPreference: t.string({ required: false }),
    remainingInvestmentPeriod: t.string({ required: false }),
    ddRequirements: t.string({ required: false }),
    icApprovalProcess: t.string({ required: false }),
    trackRecord: t.string({ required: false }),
    investmentMandate: t.string({ required: false }),
    notableInvestments: t.string({ required: false }),
    portfolioComposition: t.string({ required: false }),
    caseStudies: t.string({ required: false }),
    reinvestmentPolicy: t.string({ required: false }),
    teamComposition: t.string({ required: false }),
    collaborationTerms: t.string({ required: false }),
    impactMetrics: t.string({ required: false }),
    reputationalRisks: t.string({ required: false }),
    nextActionDate: t.field({ type: "DateTime", required: false }),
    feedback: t.string({ required: false }),
    ssaRegionContactId: t.id({ required: false }),
  }),
});

export const ClientInput = builder.inputType("ClientInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    yearFounded: t.int({ required: false }),
    hqCity: t.string({ required: false }),
    countries: t.field({ type: [GeographyEnum], required: false }),
    website: t.string({ required: false }),
    sector: t.field({ type: [SectorEnum], required: false }),
    coreProduct: t.string({ required: false }),
    description: t.string({ required: false }),
    founders: t.string({ required: false }),
    founderGenders: t.field({ type: [FounderGenderEnum], required: false }),
    revenueLastYear: t.float({ required: false }),
    revenueForecast: t.float({ required: false }),
    currency: t.string({ required: false }),
    profitability: t.field({ type: ProfitabilityEnum, required: false }),
    existingInvestors: t.string({ required: false }),
    source: t.field({ type: SourceEnum, required: false }),
    pitchDeckUrl: t.string({ required: false }),
    // Spec-gap: company profile fields (spec §3.1/§3.2)
    codename: t.string({ required: false }),
    registrationNo: t.string({ required: false }),
    hqCountry: t.string({ required: false }),
    businessModel: t.string({ required: false }),
    foundersNationality: t.string({ required: false }),
    ownershipStructure: t.string({ required: false }),
    directorsManagement: t.string({ required: false }),
    targetClients: t.string({ required: false }),
    staffCount: t.int({ required: false }),
    branchCount: t.int({ required: false }),
    ebitda: t.float({ required: false }),
    netProfit: t.float({ required: false }),
    existingDebt: t.float({ required: false }),
    loanBook: t.float({ required: false }),
    totalAssets: t.float({ required: false }),
    impactFlags: t.field({ type: [ImpactFlagEnum], required: false }),
    status: t.field({ type: ClientStatusEnum, required: false }),
  }),
});

export const MandateInput = builder.inputType("MandateInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    clientId: t.id({ required: true }),
    leadId: t.id({ required: false }),
    referredById: t.id({ required: false }),
    dealStatus: t.field({ type: DealStatusEnum, required: false }),
    dealSize: t.float({ required: false }),
    currency: t.string({ required: false }),
    sector: t.field({ type: [SectorEnum], required: false }),
    source: t.field({ type: SourceEnum, required: false }),
    dateOpened: t.field({ type: "DateTime", required: false }),
    ndaStatus: t.field({ type: DocStatusEnum, required: false }),
    ndaSentDate: t.field({ type: "DateTime", required: false }),
    ndaSignedDate: t.field({ type: "DateTime", required: false }),
    eaStatus: t.field({ type: DocStatusEnum, required: false }),
    eaSentDate: t.field({ type: "DateTime", required: false }),
    eaSignedDate: t.field({ type: "DateTime", required: false }),
    nextAction: t.string({ required: false }),
    notes: t.string({ required: false }),
  }),
});

export const TransactionInput = builder.inputType("TransactionInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    clientId: t.id({ required: true }),
    mandateId: t.id({ required: false }),
    ownerId: t.id({ required: false }),
    assistantId: t.id({ required: false }),
    dealType: t.field({ type: DealTypeEnum, required: false }),
    instrument: t.field({ type: [InstrumentEnum], required: false }),
    targetRaise: t.float({ required: false }),
    currency: t.string({ required: false }),
    sector: t.field({ type: [SectorEnum], required: false }),
    dateOpened: t.field({ type: "DateTime", required: false }),
    successFeeAmount: t.float({ required: false }),
    successFeeInvoicedDate: t.field({ type: "DateTime", required: false }),
    successFeePaidDate: t.field({ type: "DateTime", required: false }),
    // Spec-gap: deal status/milestone/financing fields (spec §4.1/§4.3/§4.5/§4.7)
    dealStatus: t.field({ type: DealStatusEnum, required: false }),
    dealMilestone: t.field({ type: DealMilestoneEnum, required: false }),
    financingType: t.field({ type: DealFinancingTypeEnum, required: false }),
    maxSellingStake: t.field({ type: MaxSellingStakeEnum, required: false }),
    targetProfile: t.string({ required: false }),
    useOfFunds: t.string({ required: false }),
    vdrLink: t.string({ required: false }),
    probability: t.int({ required: false }),
    notes: t.string({ required: false }),
    referredById: t.id({ required: false }),
    serviceProviderIds: t.field({ type: ["ID"], required: false }),
  }),
});

export const PartnerInput = builder.inputType("PartnerInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    partnerType: t.field({ type: PartnerTypeEnum, required: false }),
    profile: t.string({ required: false }),
    status: t.field({ type: PartnerStatusEnum, required: false }),
    location: t.string({ required: false }),
    amount: t.float({ required: false }),
    currency: t.string({ required: false }),
    // Task 6: advisor type, fee-sharing, partner agreement, internal-only, direct contact
    advisorType: t.field({ type: AdvisorTypeEnum, required: false }),
    organization: t.string({ required: false }),
    email: t.string({ required: false }),
    phone: t.string({ required: false }),
    feeSharingAgreement: t.boolean({ required: false }),
    feeSharingTerms: t.string({ required: false }),
    partnerAgreementStatus: t.field({ type: PartnerAgreementStatusEnum, required: false }),
    internalOnly: t.boolean({ required: false }),
  }),
});

export const ServiceProviderInput = builder.inputType("ServiceProviderInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    type: t.field({ type: ServiceProviderTypeEnum, required: false }),
    contactPerson: t.string({ required: false }),
    email: t.string({ required: false }),
    phone: t.string({ required: false }),
    profile: t.string({ required: false }),
    fee: t.float({ required: false }),
    currency: t.string({ required: false }),
    status: t.string({ required: false }),
  }),
});

export const DocumentInput = builder.inputType("DocumentInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    type: t.field({ type: DocumentTypeEnum, required: true }),
    version: t.string({ required: false }),
    accessLevel: t.field({ type: DocumentAccessLevelEnum, required: false }),
    status: t.field({ type: DocumentStatusEnum, required: false }),
    fileUrl: t.string({ required: false }),
    uploadedById: t.id({ required: false }),
    reviewerId: t.id({ required: false }),
    reviewedAt: t.field({ type: "DateTime", required: false }),
    approverId: t.id({ required: false }),
    approvedAt: t.field({ type: "DateTime", required: false }),
    clientReviewedAt: t.field({ type: "DateTime", required: false }),
    transactionId: t.id({ required: false }),
    clientId: t.id({ required: false }),
    investorId: t.id({ required: false }),
    mandateId: t.id({ required: false }),
  }),
});

export const TaskInput = builder.inputType("TaskInput", {
  fields: (t) => ({
    title: t.string({ required: true }),
    status: t.field({ type: TaskStatusEnum, required: false }),
    source: t.field({ type: TaskSourceEnum, required: false }),
    dueAt: t.field({ type: "DateTime", required: false }),
    body: t.string({ required: false }),
    assigneeId: t.id({ required: false }),
    assistantId: t.id({ required: false }),
    mandateId: t.id({ required: false }),
    transactionId: t.id({ required: false }),
    investorId: t.id({ required: false }),
    clientId: t.id({ required: false }),
    activityId: t.id({ required: false }),
    // Note: no `escalated` field — spec §3.8 marks it Auto; the task service
    // computes it from status/dueAt and never accepts a caller-supplied value.
  }),
});

// Spec-gap: generalized communication logging (spec §3.10). Mirrors the
// TaskInput/DocumentInput free-linking convention — every link is optional
// here at the GraphQL layer; the service enforces "at least one" at runtime.
export const LogActivityInput = builder.inputType("LogActivityInput", {
  fields: (t) => ({
    type: t.field({ type: InteractionTypeEnum, required: true }),
    channel: t.field({ type: CommChannelEnum, required: false }),
    direction: t.field({ type: CommDirectionEnum, required: false }),
    subject: t.string({ required: false }),
    body: t.string({ required: false }),
    occurredAt: t.field({ type: "DateTime", required: false }),
    clientId: t.id({ required: false }),
    mandateId: t.id({ required: false }),
    transactionId: t.id({ required: false }),
    investorId: t.id({ required: false }),
    engagementId: t.id({ required: false }),
  }),
});

export const EngagementInput = builder.inputType("EngagementInput", {
  fields: (t) => ({
    transactionId: t.id({ required: true }),
    investorId: t.id({ required: true }),
    name: t.string({ required: false }),
    engagementStage: t.field({ type: EngagementStageEnum, required: false }),
    interestLevel: t.field({ type: InterestLevelEnum, required: false }),
    ndaType: t.field({ type: NdaTypeEnum, required: false }),
    termSheetIssued: t.boolean({ required: false }),
    termSheetDate: t.field({ type: "DateTime", required: false }),
    totalAmount: t.float({ required: false }),
    amountDisbursed: t.float({ required: false }),
    disbursementStatus: t.field({ type: DisbursementStatusEnum, required: false }),
    dateReceived: t.field({ type: "DateTime", required: false }),
    probability: t.int({ required: false }),
    feedback: t.string({ required: false }),
    notes: t.string({ required: false }),
  }),
});

// Person (contact) CRUD (spec §3.5). The parent FK trio mirrors the Prisma
// model; the service enforces "at least one parent" at runtime.
export const PersonInput = builder.inputType("PersonInput", {
  fields: (t) => ({
    firstName: t.string({ required: true }),
    lastName: t.string({ required: false }),
    email: t.string({ required: false }),
    phone: t.string({ required: false }),
    jobTitle: t.string({ required: false }),
    linkedinUrl: t.string({ required: false }),
    isPrimaryContact: t.boolean({ required: false }),
    isSSAContact: t.boolean({ required: false }),
    investorId: t.id({ required: false }),
    clientId: t.id({ required: false }),
    partnerId: t.id({ required: false }),
  }),
});

export const MilestoneInput = builder.inputType("MilestoneInput", {
  fields: (t) => ({
    engagementId: t.id({ required: true }),
    key: t.field({ type: MilestoneKeyEnum, required: true }),
    completedAt: t.field({ type: "DateTime", required: false }),
    notes: t.string({ required: false }),
  }),
});
