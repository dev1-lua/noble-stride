import { z } from "zod";
import { Sector, Geography, Instrument, InvestorType } from "@prisma/client";
import { isCorporateEmail } from "@/lib/corporate-email";
import { CURRENCY_CODES } from "@/lib/currencies";
import { validatePassword } from "@/server/auth/policy";

/** Cross-field rule shared by every variant: max ≥ min. */
const ticketRange = { check: (d: { ticketMin: number; ticketMax: number }) => d.ticketMax >= d.ticketMin, opts: { message: "Maximum ticket must be at least the minimum", path: ["ticketMax"] as ["ticketMax"] } };

/** Step-1 registration fields — ALL mandatory (design spec §2).
 * 2026-07 client feedback: multi-select deal types + geography, manual ticket
 * range entry (replacing the fixed dealSizeBand dropdown), currency choice.
 * Kept as a plain object so callers can .pick (per-step validation) and
 * .extend (account variant); apply `registrationSchema` for full parses. */
export const registrationFieldsSchema = z.object({
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
  geographicFocus: z.array(z.nativeEnum(Geography)).min(1, "Select at least one geography"),
  dealTypes: z.array(z.nativeEnum(Instrument)).min(1, "Select at least one deal type"),
  ticketMin: z.coerce.number({ message: "Enter your minimum ticket size" }).positive("Minimum ticket must be greater than zero"),
  ticketMax: z.coerce.number({ message: "Enter your maximum ticket size" }).positive("Maximum ticket must be greater than zero"),
  currency: z.enum(CURRENCY_CODES as [string, ...string[]], { message: "Select a currency" }),
});

export const registrationSchema = registrationFieldsSchema.refine(ticketRange.check, ticketRange.opts);

export type RegistrationInput = z.infer<typeof registrationSchema>;

/** One optional team member collected on the wizard's team step (spec 2026-07-19 §5.2). */
export const teamMemberSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .refine(isCorporateEmail, "Use their corporate email — free providers (Gmail, Yahoo, …) are not accepted"),
  phone: z.string().trim().optional().default(""),
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

/** registration fields + account credentials — used by the new-fund wizard's final step. */
export const registrationAccountSchema = registrationFieldsSchema
  .extend({
    password: z.string(),
    confirmPassword: z.string(),
    members: z.array(teamMemberSchema).max(10, "You can add up to 10 team members").default([]),
  })
  .superRefine((data, ctx) => {
    if (!ticketRange.check(data)) ctx.addIssue({ code: "custom", ...ticketRange.opts });
    const err = validatePassword(data.password, data.email);
    if (err) ctx.addIssue({ code: "custom", message: err, path: ["password"] });
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", message: "Passwords do not match.", path: ["confirmPassword"] });
    }
    const memberEmails = data.members.map((m) => m.email.trim().toLowerCase());
    if (new Set(memberEmails).size !== memberEmails.length) {
      ctx.addIssue({ code: "custom", message: "Each team member needs a different email.", path: ["members"] });
    }
    if (memberEmails.includes(data.email.trim().toLowerCase())) {
      ctx.addIssue({ code: "custom", message: "A team member can't reuse the primary contact's email.", path: ["members"] });
    }
  });

export type RegistrationAccountInput = z.infer<typeof registrationAccountSchema>;
