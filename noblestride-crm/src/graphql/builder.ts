import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import type PrismaTypes from "@/generated/pothos-types";
import { prisma } from "@/lib/db";
import {
  ActorSource,
  AdvisorType,
  ClientStatus,
  CommChannel,
  CommDirection,
  DealFinancingType,
  DealMilestone,
  DealStatus,
  DDStatus,
  DDTrack,
  DealType,
  DisbursementStatus,
  DocStatus,
  DocumentAccessLevel,
  DocumentStatus,
  DocumentType,
  EngagementStage,
  EngagementStatus,
  FounderGender,
  Geography,
  ImpactFlag,
  Instrument,
  InteractionType,
  InterestLevel,
  InvestmentStage,
  InvestorEngagementClassification,
  InvestorNdaStatus,
  InvestorStatus,
  InvestorType,
  MandateStage,
  MaxSellingStake,
  MilestoneKey,
  NdaType,
  OnboardingStatus,
  OrgRole,
  PartnerAgreementStatus,
  PartnerFeeStatus,
  PartnerStatus,
  PartnerType,
  Prisma,
  Priority,
  Profitability,
  RegulatoryStatus,
  Sector,
  ServiceProviderType,
  Source,
  TaskSource,
  TaskStatus,
  TransactionStage,
} from "@prisma/client";
import type { GraphQLContext } from "./context";

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: GraphQLContext;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
  };
}>({
  plugins: [PrismaPlugin],
  prisma: { client: prisma, dmmf: Prisma.dmmf },
});

builder.queryType({});
builder.mutationType({});

builder.scalarType("DateTime", {
  serialize: (value) => (value instanceof Date ? value.toISOString() : (value as unknown as string)),
  parseValue: (value) => new Date(value as string),
});

// ── Enum registrations (one GraphQL enum per Prisma vocabulary) ───────────────
export const SectorEnum = builder.enumType(Sector, { name: "Sector" });
export const InvestorTypeEnum = builder.enumType(InvestorType, { name: "InvestorType" });
export const InvestorStatusEnum = builder.enumType(InvestorStatus, { name: "InvestorStatus" });
export const InstrumentEnum = builder.enumType(Instrument, { name: "Instrument" });
export const InvestmentStageEnum = builder.enumType(InvestmentStage, { name: "InvestmentStage" });
export const GeographyEnum = builder.enumType(Geography, { name: "Geography" });
export const MandateStageEnum = builder.enumType(MandateStage, { name: "MandateStage" });
export const TransactionStageEnum = builder.enumType(TransactionStage, { name: "TransactionStage" });
export const EngagementStatusEnum = builder.enumType(EngagementStatus, { name: "EngagementStatus" });
export const SourceEnum = builder.enumType(Source, { name: "Source" });
export const DocStatusEnum = builder.enumType(DocStatus, { name: "DocStatus" });
export const DealTypeEnum = builder.enumType(DealType, { name: "DealType" });
export const PartnerTypeEnum = builder.enumType(PartnerType, { name: "PartnerType" });
export const PartnerStatusEnum = builder.enumType(PartnerStatus, { name: "PartnerStatus" });
export const FounderGenderEnum = builder.enumType(FounderGender, { name: "FounderGender" });
export const TaskStatusEnum = builder.enumType(TaskStatus, { name: "TaskStatus" });
export const InteractionTypeEnum = builder.enumType(InteractionType, { name: "InteractionType" });
export const ActorSourceEnum = builder.enumType(ActorSource, { name: "ActorSource" });
export const EngagementStageEnum = builder.enumType(EngagementStage, { name: "EngagementStage" });
export const InterestLevelEnum = builder.enumType(InterestLevel, { name: "InterestLevel" });
export const MilestoneKeyEnum = builder.enumType(MilestoneKey, { name: "MilestoneKey" });
export const NdaTypeEnum = builder.enumType(NdaType, { name: "NdaType" });
export const DisbursementStatusEnum = builder.enumType(DisbursementStatus, { name: "DisbursementStatus" });
export const InvestorEngagementClassificationEnum = builder.enumType(InvestorEngagementClassification, { name: "InvestorEngagementClassification" });
export const InvestorNdaStatusEnum = builder.enumType(InvestorNdaStatus, { name: "InvestorNdaStatus" });
export const AdvisorTypeEnum = builder.enumType(AdvisorType, { name: "AdvisorType" });
export const ServiceProviderTypeEnum = builder.enumType(ServiceProviderType, { name: "ServiceProviderType" });
export const DocumentTypeEnum = builder.enumType(DocumentType, { name: "DocumentType" });
export const DocumentAccessLevelEnum = builder.enumType(DocumentAccessLevel, { name: "DocumentAccessLevel" });
export const DocumentStatusEnum = builder.enumType(DocumentStatus, { name: "DocumentStatus" });
export const PartnerAgreementStatusEnum = builder.enumType(PartnerAgreementStatus, { name: "PartnerAgreementStatus" });
export const OnboardingStatusEnum = builder.enumType(OnboardingStatus, { name: "OnboardingStatus" });
// Spec-gap enums (SPEC §3.1/§3.10/§4.x)
export const DealFinancingTypeEnum = builder.enumType(DealFinancingType, { name: "DealFinancingType" });
export const DealStatusEnum = builder.enumType(DealStatus, { name: "DealStatus" });
export const DealMilestoneEnum = builder.enumType(DealMilestone, { name: "DealMilestone" });
export const MaxSellingStakeEnum = builder.enumType(MaxSellingStake, { name: "MaxSellingStake" });
export const TaskSourceEnum = builder.enumType(TaskSource, { name: "TaskSource" });
export const CommChannelEnum = builder.enumType(CommChannel, { name: "CommChannel" });
export const CommDirectionEnum = builder.enumType(CommDirection, { name: "CommDirection" });
export const ClientStatusEnum = builder.enumType(ClientStatus, { name: "ClientStatus" });
export const ImpactFlagEnum = builder.enumType(ImpactFlag, { name: "ImpactFlag" });
export const ProfitabilityEnum = builder.enumType(Profitability, { name: "Profitability" });
export const RegulatoryStatusEnum = builder.enumType(RegulatoryStatus, { name: "RegulatoryStatus" });
export const DDTrackEnum = builder.enumType(DDTrack, { name: "DDTrack" });
export const DDStatusEnum = builder.enumType(DDStatus, { name: "DDStatus" });
export const OrgRoleEnum = builder.enumType(OrgRole, { name: "OrgRole" });
// Task 8: priority + partner fee status (Task 6 migration)
export const PriorityEnum = builder.enumType(Priority, { name: "Priority" });
export const PartnerFeeStatusEnum = builder.enumType(PartnerFeeStatus, { name: "PartnerFeeStatus" });
