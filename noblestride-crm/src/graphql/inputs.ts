// Pothos input types for entity create/update mutations.
// Field optionality mirrors the Zod schemas in src/lib/schemas/*. Only `name`
// (and clientId on Mandate/Transaction) is required; everything else is optional
// so the same input type serves both create and (partial) update.

import {
  builder,
  SectorEnum, InvestorTypeEnum, InvestorStatusEnum, InstrumentEnum, InvestmentStageEnum,
  GeographyEnum, SourceEnum, DocStatusEnum, DealTypeEnum, PartnerTypeEnum, PartnerStatusEnum,
  FounderGenderEnum,
  EngagementStageEnum, InterestLevelEnum, NdaTypeEnum, DisbursementStatusEnum,
  ServiceProviderTypeEnum,
  DocumentTypeEnum, DocumentAccessLevelEnum, DocumentStatusEnum,
  InvestorEngagementClassificationEnum, InvestorNdaStatusEnum,
  AdvisorTypeEnum, PartnerAgreementStatusEnum,
  RegulatoryStatusEnum, DDTrackEnum, DDStatusEnum,
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
    founderGender: t.field({ type: FounderGenderEnum, required: false }),
    revenueLastYear: t.float({ required: false }),
    revenueForecast: t.float({ required: false }),
    currency: t.string({ required: false }),
    profitable: t.boolean({ required: false }),
    existingInvestors: t.string({ required: false }),
    source: t.field({ type: SourceEnum, required: false }),
    pitchDeckUrl: t.string({ required: false }),
    // §3.1 financial + impact fields
    projectCodename: t.string({ required: false }),
    ebitda: t.float({ required: false }),
    existingDebt: t.float({ required: false }),
    totalAssets: t.float({ required: false }),
    womenLed: t.boolean({ required: false }),
    youthLed: t.boolean({ required: false }),
  }),
});

export const MandateInput = builder.inputType("MandateInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    clientId: t.id({ required: true }),
    leadId: t.id({ required: false }),
    referredById: t.id({ required: false }),
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
    dealType: t.field({ type: DealTypeEnum, required: false }),
    instrument: t.field({ type: [InstrumentEnum], required: false }),
    targetRaise: t.float({ required: false }),
    currency: t.string({ required: false }),
    sector: t.field({ type: [SectorEnum], required: false }),
    dateOpened: t.field({ type: "DateTime", required: false }),
    successFeeAmount: t.float({ required: false }),
    successFeeInvoicedDate: t.field({ type: "DateTime", required: false }),
    successFeePaidDate: t.field({ type: "DateTime", required: false }),
    // §3.2 IC approvals + CAK/COMESA regulatory tracking
    icFirstApprovalDate: t.field({ type: "DateTime", required: false }),
    icSecondApprovalDate: t.field({ type: "DateTime", required: false }),
    cakComesaStatus: t.field({ type: RegulatoryStatusEnum, required: false }),
    cakComesaFiledDate: t.field({ type: "DateTime", required: false }),
    cakComesaApprovedDate: t.field({ type: "DateTime", required: false }),
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
