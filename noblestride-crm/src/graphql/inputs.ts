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
  RegulatoryStatusEnum, DDTrackEnum, DDStatusEnum,
  PriorityEnum, PartnerFeeStatusEnum,
  MandateStageEnum, TransactionStageEnum,
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
    // Task 7: compliance & operations fields (Task 6 migration)
    pepExposure: t.boolean({ required: false }),
    governmentOwned: t.boolean({ required: false }),
    complianceNotes: t.string({ required: false }),
    auditedFinancialsYears: t.int({ required: false }),
    groupStructure: t.string({ required: false }),
    suppliers: t.string({ required: false }),
    competitors: t.string({ required: false }),
    capacityUtilization: t.string({ required: false }),
    repaymentAbilityNotes: t.string({ required: false }),
    pricingExpectations: t.string({ required: false }),
    proposedTimeline: t.string({ required: false }),
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
    stage: t.field({ type: MandateStageEnum, required: false }),
    qualificationVerdict: t.string({ required: false }),
    dateOpened: t.field({ type: "DateTime", required: false }),
    ndaStatus: t.field({ type: DocStatusEnum, required: false }),
    ndaSentDate: t.field({ type: "DateTime", required: false }),
    ndaSignedDate: t.field({ type: "DateTime", required: false }),
    eaStatus: t.field({ type: DocStatusEnum, required: false }),
    eaSentDate: t.field({ type: "DateTime", required: false }),
    eaSignedDate: t.field({ type: "DateTime", required: false }),
    nextAction: t.string({ required: false }),
    notes: t.string({ required: false }),
    // Task 8: retainer tracking + priority + referral-qualification (Task 6 migration)
    retainerAmount: t.float({ required: false }),
    retainerInvoicedDate: t.field({ type: "DateTime", required: false }),
    retainerPaidDate: t.field({ type: "DateTime", required: false }),
    priority: t.field({ type: PriorityEnum, required: false }),
    referralQualified: t.boolean({ required: false }),
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
    stage: t.field({ type: TransactionStageEnum, required: false }),
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
    // §3.2 IC approvals + CAK/COMESA regulatory tracking
    icFirstApprovalDate: t.field({ type: "DateTime", required: false }),
    icSecondApprovalDate: t.field({ type: "DateTime", required: false }),
    cakComesaStatus: t.field({ type: RegulatoryStatusEnum, required: false }),
    cakComesaFiledDate: t.field({ type: "DateTime", required: false }),
    cakComesaApprovedDate: t.field({ type: "DateTime", required: false }),
    // Task 8: priority + partner fee tracking (Task 6 migration)
    priority: t.field({ type: PriorityEnum, required: false }),
    partnerFeeStatus: t.field({ type: PartnerFeeStatusEnum, required: false }),
    partnerFeeAmount: t.float({ required: false }),
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
    // Task 8: internal feedback notes (Task 6 migration)
    feedbackNotes: t.string({ required: false }),
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
    partnerId: t.id({ required: false }),
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
    subject: t.string({ required: true }),
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

// E-sign envelope send (Task 7). `kind` mirrors ESignKind in
// src/server/integrations/esign/provider.ts (OpenNda | ClosedNda | TermSheet);
// left as a plain string here rather than a new Pothos enum since the
// service layer already validates/narrows it.
export const SendEsignInput = builder.inputType("SendEsignInput", {
  fields: (t) => ({
    kind: t.string({ required: true }),
    documentBase64: t.string({ required: true }),
    documentName: t.string({ required: true }),
    signerEmail: t.string({ required: true }),
    signerName: t.string({ required: true }),
    subject: t.string({ required: true }),
    investorId: t.id({ required: false }),
    engagementId: t.id({ required: false }),
    transactionId: t.id({ required: false }),
  }),
});

// Schedule-a-Teams-call (Task 15). `attendeesJson` is a JSON-encoded array of
// `{email, name}` — left as a plain string here (mirroring SendEsignInput's
// documentBase64 convention) so the resolver, not the GraphQL layer, owns
// parsing/validation of attendee shape.
export const ScheduleMeetingInput = builder.inputType("ScheduleMeetingInput", {
  fields: (t) => ({
    subject: t.string({ required: true }),
    startAt: t.string({ required: true }),
    endAt: t.string({ required: true }),
    attendeesJson: t.string({ required: true }),
    engagementId: t.id({ required: false }),
    transactionId: t.id({ required: false }),
    investorId: t.id({ required: false }),
  }),
});

export const DueDiligenceTrackInput = builder.inputType("DueDiligenceTrackInput", {
  fields: (t) => ({
    transactionId: t.id({ required: true }),
    track: t.field({ type: DDTrackEnum, required: true }),
    status: t.field({ type: DDStatusEnum, required: false }),
    ownerId: t.id({ required: false }),
    serviceProviderId: t.id({ required: false }),
    startedAt: t.field({ type: "DateTime", required: false }),
    completedAt: t.field({ type: "DateTime", required: false }),
    notes: t.string({ required: false }),
  }),
});

// Client Agent intake (SOW §8.1) — mirrors src/lib/schemas/intake.ts; zod
// (intakeSubmitSchema) remains the source of validation truth inside the
// service, so keep these loose (strings for the small unions).
export const ClientIntakeInput = builder.inputType("ClientIntakeInput", {
  fields: (t) => ({
    legalName: t.string({ required: true }),
    registrationNo: t.string({ required: true }),
    country: t.field({ type: GeographyEnum, required: true }),
    sectors: t.field({ type: [SectorEnum], required: true }),
    yearFounded: t.int({ required: true }),
    website: t.string({ required: false }),
    pitchDeckUrl: t.string({ required: false }),
    contactName: t.string({ required: true }),
    role: t.string({ required: true }),
    email: t.string({ required: true }),
    phone: t.string({ required: true }),
    revenueUsd: t.float({ required: true }),
    ebitdaUsd: t.float({ required: true }),
    netProfitUsd: t.float({ required: true }),
    totalAssetsUsd: t.float({ required: true }),
    auditedYears: t.string({ required: true }),
    loanBookUsd: t.float({ required: false }),
    raiseUsd: t.float({ required: true }),
    instrument: t.string({ required: true }),
    useOfFunds: t.string({ required: true }),
    proposedTimeline: t.string({ required: true }),
    ownershipSummary: t.string({ required: true }),
    pepExposure: t.string({ required: true }),
    governmentOwned: t.string({ required: true }),
    existingDebtUsd: t.float({ required: false }),
    conversationSummary: t.string({ required: true }),
    qualificationNotes: t.string({ required: false }),
    attachmentUrls: t.stringList({ required: false }),
  }),
});

export const LogClientMessageInput = builder.inputType("LogClientMessageInput", {
  fields: (t) => ({
    companyName: t.string({ required: true }),
    contactEmail: t.string({ required: true }),
    messageSummary: t.string({ required: true }),
    requestType: t.string({ required: true }),
  }),
});
