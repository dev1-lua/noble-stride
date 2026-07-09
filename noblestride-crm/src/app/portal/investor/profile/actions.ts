// Fund-profile save action. SECURITY: the investor id comes from the
// viewpoint cookie read SERVER-SIDE — a client-passed id is never trusted.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { updateInvestor } from "@/server/services/investors";
import type { InvestorUpdateInput } from "@/lib/schemas/investor";

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

export async function saveFundProfile(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");
  const investorId = vp.recordId as string;

  // ── §1–§7 profile fields — validated by updateInvestor's Zod schema ──────
  const input = {
    // §1 Fund Strategy & Preferences
    investmentMandate: str(formData, "investmentMandate"),
    sectorFocus: list(formData, "sectorFocus"),
    investmentStages: list(formData, "investmentStages"),
    ticketMin: num(formData, "ticketMin"),
    ticketMax: num(formData, "ticketMax"),
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
  const contactPhone = str(formData, "contactPhone");

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
      await prisma.person.update({
        where: { id: existing.id },
        data: {
          ...nameData,
          email: contactEmail !== undefined ? contactEmail || null : undefined,
          phone: contactPhone !== undefined ? contactPhone || null : undefined,
          isPrimaryContact: true,
        },
      });
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
