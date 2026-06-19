// Pothos input types for entity create/update mutations.
// Field optionality mirrors the Zod schemas in src/lib/schemas/*. Only `name`
// (and clientId on Mandate/Transaction) is required; everything else is optional
// so the same input type serves both create and (partial) update.

import {
  builder,
  SectorEnum, InvestorTypeEnum, InvestorStatusEnum, InstrumentEnum, InvestmentStageEnum,
  GeographyEnum, SourceEnum, DocStatusEnum, DealTypeEnum, PartnerTypeEnum, PartnerStatusEnum,
  FounderGenderEnum,
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
  }),
});
