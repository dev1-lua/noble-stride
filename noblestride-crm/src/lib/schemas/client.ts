import { z } from "zod";
import { Sector, Geography, FounderGender, Source } from "@prisma/client";

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
  founderGender: z.nativeEnum(FounderGender).optional(),
  revenueLastYear: z.number().nonnegative().optional(),
  revenueForecast: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  profitable: z.boolean().optional(),
  existingInvestors: z.string().trim().optional(),
  source: z.nativeEnum(Source).optional(),
  pitchDeckUrl: z.string().trim().optional(),
  // §3.1 financial + impact fields (EBITDA may legitimately be negative)
  projectCodename: z.string().trim().optional(),
  ebitda: z.number().optional(),
  existingDebt: z.number().nonnegative().optional(),
  totalAssets: z.number().nonnegative().optional(),
  womenLed: z.boolean().optional(),
  youthLed: z.boolean().optional(),
});
export const clientUpdateSchema = clientCreateSchema.partial();
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
