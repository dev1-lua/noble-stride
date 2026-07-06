import { z } from "zod";
import { Sector, Geography, FounderGender, Source, ImpactFlag, ClientStatus, Profitability } from "@prisma/client";

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  yearFounded: z.number().int().optional(),
  hqCity: z.string().trim().optional(),
  countries: z.array(z.nativeEnum(Geography)).optional(),
  website: z.string().trim().optional(),
  sector: z.array(z.nativeEnum(Sector)).optional(),
  coreProduct: z.string().trim().optional(),
  description: z.string().trim().optional(),
  founders: z.string().trim().optional(),
  founderGenders: z.array(z.nativeEnum(FounderGender)).optional(),
  revenueLastYear: z.number().nonnegative().optional(),
  revenueForecast: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  profitability: z.nativeEnum(Profitability).optional(),
  existingInvestors: z.string().trim().optional(),
  source: z.nativeEnum(Source).optional(),
  pitchDeckUrl: z.string().trim().optional(),
  // Spec-gap: company profile fields (spec §3.1/§3.2)
  codename: z.string().trim().optional(),
  registrationNo: z.string().trim().optional(),
  hqCountry: z.string().trim().optional(),
  businessModel: z.string().trim().optional(),
  foundersNationality: z.string().trim().optional(),
  ownershipStructure: z.string().trim().optional(),
  directorsManagement: z.string().trim().optional(),
  targetClients: z.string().trim().optional(),
  staffCount: z.number().int().nonnegative().optional(),
  branchCount: z.number().int().nonnegative().optional(),
  ebitda: z.number().optional(),
  netProfit: z.number().optional(),
  existingDebt: z.number().nonnegative().optional(),
  loanBook: z.number().nonnegative().optional(),
  totalAssets: z.number().nonnegative().optional(),
  impactFlags: z.array(z.nativeEnum(ImpactFlag)).optional(),
  status: z.nativeEnum(ClientStatus).optional(),
});
export const clientUpdateSchema = clientCreateSchema.partial();
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
