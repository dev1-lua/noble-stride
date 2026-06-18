import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import type PrismaTypes from "@/generated/pothos-types";
import { prisma } from "@/lib/db";
import {
  ActorSource,
  DealType,
  DocStatus,
  EngagementStatus,
  FounderGender,
  Geography,
  Instrument,
  InteractionType,
  InvestmentStage,
  InvestorStatus,
  InvestorType,
  MandateStage,
  PartnerStatus,
  PartnerType,
  Sector,
  Source,
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
  prisma: { client: prisma },
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
