import { z } from "zod";
import { Sector, Instrument, InvestorType } from "@prisma/client";
import { isCorporateEmail } from "@/lib/corporate-email";
import { TICKET_BANDS } from "@/lib/ticket-bands";

const bandKeys = TICKET_BANDS.map((b) => b.key) as [string, ...string[]];

/** Step-1 registration fields — ALL mandatory (design spec §2). */
export const registrationSchema = z.object({
  fundName: z.string().trim().min(1, "Name of the fund is required"),
  contactPerson: z.string().trim().min(1, "Contact person is required"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .refine(isCorporateEmail, "Please use your corporate email address — free providers (Gmail, Yahoo, …) are not accepted"),
  phone: z.string().trim().min(7, "Telephone number is required (used for OTP verification)"),
  investorType: z.nativeEnum(InvestorType),
  sectorPreference: z.array(z.nativeEnum(Sector)).min(1, "Select at least one sector"),
  dealType: z.nativeEnum(Instrument),
  dealSizeBand: z.enum(bandKeys),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
