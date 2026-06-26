import { z } from "zod";
import { InvestorType, InvestorStatus, Sector, Geography, Instrument, InvestmentStage, InvestorEngagementClassification, InvestorNdaStatus } from "@prisma/client";

export const investorCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  investorType: z.nativeEnum(InvestorType),
  website: z.string().trim().optional(),
  status: z.nativeEnum(InvestorStatus).optional(),
  sectorFocus: z.array(z.nativeEnum(Sector)).optional(),
  geographicFocus: z.array(z.nativeEnum(Geography)).optional(),
  instruments: z.array(z.nativeEnum(Instrument)).optional(),
  investmentStages: z.array(z.nativeEnum(InvestmentStage)).optional(),
  aum: z.number().nonnegative().optional(),
  ticketMin: z.number().nonnegative().optional(),
  ticketMax: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  targetIrr: z.number().optional(),
  countryRestrictions: z.string().trim().optional(),
  esgFocus: z.string().trim().optional(),
  decisionProcess: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  // Task 5: engagement classification, NDA status, profile fields
  engagementClassification: z.nativeEnum(InvestorEngagementClassification).optional(),
  ndaStatus: z.nativeEnum(InvestorNdaStatus).optional(),
  shareholdingPreference: z.string().trim().optional(),
  minRevenue: z.number().nonnegative().optional(),
  minEbitda: z.number().nonnegative().optional(),
  minLoanBook: z.number().nonnegative().optional(),
  pricingPreference: z.string().trim().optional(),
  remainingInvestmentPeriod: z.string().trim().optional(),
  ddRequirements: z.string().trim().optional(),
  icApprovalProcess: z.string().trim().optional(),
  trackRecord: z.string().trim().optional(),
  investmentMandate: z.string().trim().optional(),
  nextActionDate: z.date().optional(),
  feedback: z.string().trim().optional(),
  ssaRegionContactId: z.string().trim().optional(),
});
export const investorUpdateSchema = investorCreateSchema.partial();
export type InvestorCreateInput = z.infer<typeof investorCreateSchema>;
export type InvestorUpdateInput = z.infer<typeof investorUpdateSchema>;
