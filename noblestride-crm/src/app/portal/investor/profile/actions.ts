// Fund-profile save action. SECURITY: the investor id comes from the
// viewpoint cookie read SERVER-SIDE — a client-passed id is never trusted.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { requirePortalEditor } from "@/server/auth/portal-authz";
import { updateInvestor } from "@/server/services/investors";
import type { InvestorUpdateInput } from "@/lib/schemas/investor";
import { optionalPhone } from "@/lib/schemas/phone";
import { requestEmailChangeSelfService, EmailChangeError } from "@/server/auth/change-email";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : undefined;
}

function num(fd: FormData, key: string): number | undefined {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function list(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string");
}

/**
 * Client-serialized ticket band rows (item 4). Blank rows are dropped;
 * malformed JSON degrades to undefined (bands untouched). Numbers are
 * validated properly by updateInvestor's Zod schema.
 */
function parseBands(
  fd: FormData,
): { min: number; max: number | null; currency: string }[] | undefined {
  const raw = fd.get("ticketBandsJson");
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const bands: { min: number; max: number | null; currency: string }[] = [];
    for (const row of parsed) {
      const min = Number(row?.min);
      const maxRaw = typeof row?.max === "string" ? row.max.trim() : row?.max;
      if (row?.min === "" || !Number.isFinite(min)) continue; // blank/garbage row
      const max = maxRaw === "" || maxRaw == null ? null : Number(maxRaw);
      bands.push({
        min,
        max: max != null && Number.isFinite(max) ? max : null,
        currency: typeof row?.currency === "string" && row.currency ? row.currency : "USD",
      });
    }
    return bands;
  } catch {
    return undefined;
  }
}

export async function saveFundProfile(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");
  const investorId = vp.recordId as string;
  // Seat gate (action points 2026-07 item 3): profile edits are Editors-only.
  const member = await requirePortalEditor("/portal/investor/profile");

  // Validate the contact phone BEFORE any write — a bad phone must not leave
  // the §1–§7 fields below partially saved while the error banner implies
  // nothing happened.
  const contactPhoneRaw = str(formData, "contactPhone");
  const contactPhoneCheck = optionalPhone.safeParse(contactPhoneRaw);
  if (!contactPhoneCheck.success) {
    redirect("/portal/investor/profile?error=phone");
  }
  const contactPhone = contactPhoneCheck.data;

  // ── §1–§7 profile fields — validated by updateInvestor's Zod schema ──────
  const input = {
    // §1 Fund Strategy & Preferences
    investmentMandate: str(formData, "investmentMandate"),
    sectorFocus: list(formData, "sectorFocus"),
    investmentStages: list(formData, "investmentStages"),
    // Ticket bands (item 4) — replaces the old single ticketMin/ticketMax
    // inputs; band #0 mirrors into the legacy columns inside updateInvestor.
    ticketBands: parseBands(formData),
    instruments: list(formData, "instruments"),
    targetIrr: num(formData, "targetIrr"),
    // §2 Geographic Focus
    geographicFocus: list(formData, "geographicFocus"),
    countryRestrictions: str(formData, "countryRestrictions"),
    // §3 Track Record & Portfolio
    notableInvestments: str(formData, "notableInvestments"),
    portfolioComposition: str(formData, "portfolioComposition"),
    caseStudies: str(formData, "caseStudies"),
    // §4 Fund Life Cycle & Capital
    aum: num(formData, "aum"),
    remainingInvestmentPeriod: str(formData, "remainingInvestmentPeriod"),
    reinvestmentPolicy: str(formData, "reinvestmentPolicy"),
    // §5 Decision-Making Process & Timelines
    ddRequirements: str(formData, "ddRequirements"),
    icApprovalProcess: str(formData, "icApprovalProcess"),
    // §6 Engagement Logistics
    teamComposition: str(formData, "teamComposition"),
    collaborationTerms: str(formData, "collaborationTerms"),
    // §7 Ethical & Impact
    esgFocus: str(formData, "esgFocus"),
    impactMetrics: str(formData, "impactMetrics"),
    reputationalRisks: str(formData, "reputationalRisks"),
  } as InvestorUpdateInput;

  await updateInvestor(investorId, input);

  // ── §6 Point of Contact — update or create the primary contact Person ────
  const contactName = str(formData, "contactName") ?? "";
  const contactEmail = str(formData, "contactEmail");

  if (contactName || contactEmail || contactPhone) {
    const existing = await prisma.person.findFirst({
      where: { investorId },
      // id tiebreaker: seed rows can share createdAt; the page must show the
      // same person this action updates.
      orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    const nameData: { firstName?: string; lastName?: string | null } = {};
    if (contactName) {
      const parts = contactName.split(/\s+/);
      nameData.firstName = parts[0]!;
      nameData.lastName = parts.slice(1).join(" ") || null;
    }

    if (existing) {
      // F3.6: the contact email on this form is a LOGIN email when the contact
      // has an account, so it cannot just be overwritten here.
      //
      //  * Own record → self-service change: park the new address and email it a
      //    confirmation link. Writing it straight through would lock the person
      //    out of their own portal on a typo.
      //  * A colleague who can sign in → refuse. One member must not be able to
      //    move another member's login address; that is an account takeover.
      //  * A colleague with no account → unchanged behaviour, it is just a
      //    contact detail.
      const accountOfExisting = await prisma.authAccount.findUnique({
        where: { personId: existing.id },
        select: { id: true, email: true },
      });
      const wantsEmailChange =
        contactEmail !== undefined &&
        !!contactEmail &&
        !!accountOfExisting &&
        contactEmail.trim().toLowerCase() !== accountOfExisting.email;

      if (wantsEmailChange && existing.id !== member.personId) {
        redirect("/portal/investor/profile?error=email-owned");
      }

      await prisma.person.update({
        where: { id: existing.id },
        data: {
          ...nameData,
          // Held back while a confirmation is pending — confirmEmailChange
          // writes Person.email itself once the new address is proven.
          email: wantsEmailChange
            ? undefined
            : contactEmail !== undefined
              ? contactEmail || null
              : undefined,
          phone: contactPhone !== undefined ? contactPhone || null : undefined,
          isPrimaryContact: true,
        },
      });

      if (wantsEmailChange && accountOfExisting) {
        try {
          await requestEmailChangeSelfService(accountOfExisting.id, contactEmail);
        } catch (err) {
          if (err instanceof EmailChangeError) {
            console.error("[profile] email change refused:", err.message);
            redirect("/portal/investor/profile?error=email-change");
          }
          throw err;
        }
        revalidatePath("/portal/investor/profile");
        redirect("/portal/investor/profile?notice=email-change-requested");
      }
    } else {
      await prisma.person.create({
        data: {
          firstName: nameData.firstName ?? "Primary",
          lastName: nameData.lastName ?? (nameData.firstName ? null : "Contact"),
          email: contactEmail || null,
          phone: contactPhone || null,
          isPrimaryContact: true,
          investorId,
        },
      });
    }
  }

  revalidatePath("/portal/investor/profile");
  redirect("/portal/investor/profile?saved=1");
}
