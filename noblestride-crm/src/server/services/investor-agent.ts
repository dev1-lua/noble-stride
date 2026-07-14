// Investor Agent (spec 2026-07-14) — agent-facing reads.
// Thin layer: Prisma + the visibility projector. No GraphQL, no React.
// SECURITY: transactionTeaserContext is the agent's ONLY deal read and always
// projects at PRE_INTEREST, so confidential fields are unreachable by construction.
import { prisma } from "@/lib/db";
import { CrudError } from "./crud";
import { investorTier } from "@/server/visibility/tiers";
import {
  projectDealForInvestor,
  bandCurrency,
  type DealInput,
} from "@/server/visibility/project";
import { logActivity } from "./engagements";
import { updateInvestor } from "./investors";
import { updatePerson } from "./persons";
import { assertCan } from "@/server/rbac/enforce";
import type { Actor } from "@/graphql/context";
import type { InteractionType } from "@prisma/client";

function personName(p: { firstName: string; lastName: string | null }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

export async function investorByEmail(email: string): Promise<{
  matched: boolean;
  investorId?: string;
  investorName?: string;
  contactName?: string;
}> {
  const trimmed = email.trim();
  if (!trimmed) return { matched: false };
  const person = await prisma.person.findFirst({
    where: { email: { equals: trimmed, mode: "insensitive" }, investorId: { not: null } },
    include: { investor: true },
  });
  const investor = person?.investor;
  if (!person || !investor) return { matched: false };
  // Blocked or unapproved investors are indistinguishable from unknown senders.
  if (investorTier(investor, null) === "NONE") return { matched: false };
  return {
    matched: true,
    investorId: investor.id,
    investorName: investor.name,
    contactName: personName(person),
  };
}

export interface InvestorMatch {
  investorId: string;
  name: string;
  personId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  matchReasons: string[];
  hasExistingEngagement: boolean;
}

export async function matchInvestorsForTransaction(transactionId: string): Promise<InvestorMatch[]> {
  const txn = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { client: true, engagements: { select: { investorId: true } } },
  });
  if (!txn) throw new CrudError("Transaction not found");
  const engaged = new Set(txn.engagements.map((e) => e.investorId));
  const dealCountries = txn.client?.countries ?? [];
  const raise = txn.targetRaise == null ? null : Number(txn.targetRaise);

  const candidates = await prisma.investor.findMany({
    where: { onboardingStatus: "Approved", engagementClassification: "Active" },
    include: { contacts: { orderBy: { isPrimaryContact: "desc" } } },
  });

  const out: InvestorMatch[] = [];
  for (const inv of candidates) {
    const reasons: string[] = [];
    const sectorHit = inv.sectorFocus.filter((s) => txn.sector.includes(s));
    if (sectorHit.length === 0) continue;
    reasons.push(`Sector match: ${sectorHit.join(", ")}`);

    const geoHit =
      inv.geographicFocus.includes("Global") ||
      inv.geographicFocus.some(
        (g) => dealCountries.includes(g) || g === "PanAfrica" || g === "SubSaharanAfrica",
      );
    if (dealCountries.length > 0 && inv.geographicFocus.length > 0 && !geoHit) continue;
    if (geoHit) reasons.push(`Geography match: ${inv.geographicFocus.join(", ")}`);

    if (txn.instrument.length > 0 && inv.instruments.length > 0) {
      const instHit = inv.instruments.filter((i) => txn.instrument.includes(i));
      if (instHit.length === 0) continue;
      reasons.push(`Instrument match: ${instHit.join(", ")}`);
    }

    if (raise != null) {
      const min = inv.ticketMin == null ? null : Number(inv.ticketMin);
      const max = inv.ticketMax == null ? null : Number(inv.ticketMax);
      if (min != null && raise < min) continue;
      if (max != null && raise > max) continue;
      if (min != null || max != null) reasons.push("Ticket size in range");
    }

    if (inv.status && inv.status !== "ActivelyDeploying") continue;
    if (!inv.status) reasons.push("Warning: deployment status unknown");

    const contact = inv.contacts.find((c) => c.email) ?? inv.contacts[0] ?? null;
    out.push({
      investorId: inv.id,
      name: inv.name,
      personId: contact?.id ?? null,
      contactName: contact ? personName(contact) : null,
      contactEmail: contact?.email ?? null,
      matchReasons: reasons,
      hasExistingEngagement: engaged.has(inv.id),
    });
  }
  return out;
}

export interface TeaserContext {
  codename: string;
  sectors: string[];
  geographies: string[];
  dealType: string | null;
  instruments: string[];
  targetRaiseBand: string | null;
  revenueBand: string | null;
  revenueForecastBand: string | null;
  description: string | null;
  contact: string;
}

export async function transactionTeaserContext(transactionId: string): Promise<TeaserContext> {
  const txn = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { client: true },
  });
  if (!txn) throw new CrudError("Transaction not found");
  const deal: DealInput = {
    id: txn.id,
    name: txn.name,
    stage: txn.stage,
    dealType: txn.dealType,
    instrument: txn.instrument,
    targetRaise: txn.targetRaise,
    currency: txn.currency,
    sector: txn.sector,
    client: txn.client,
    documents: [],
  };
  const projected = projectDealForInvestor(deal, "PRE_INTEREST", { ndaSatisfied: false });
  if (!projected) throw new CrudError("Projection failed");
  const fs = projected.financialsSummary;
  return {
    codename: projected.name,
    sectors: projected.companyProfile.sector.map(String),
    geographies: projected.companyProfile.countries.map(String),
    dealType: projected.dealTypeTicket.dealType ? String(projected.dealTypeTicket.dealType) : null,
    instruments: projected.dealTypeTicket.instrument.map(String),
    targetRaiseBand: bandCurrency(projected.dealTypeTicket.targetRaise),
    revenueBand: typeof fs.revenueLastYear === "string" ? fs.revenueLastYear : bandCurrency(fs.revenueLastYear),
    revenueForecastBand: typeof fs.revenueForecast === "string" ? fs.revenueForecast : bandCurrency(fs.revenueForecast),
    description: projected.companyProfile.description,
    contact: projected.contact,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Write side — proposed changes + communication log (spec 2026-07-14 §4).
// SECURITY: nothing here writes an Investor/Person row on submit — only
// confirmProposedChange (a staff-actor path, RBAC-gated) does.
// ─────────────────────────────────────────────────────────────────────────────

/** Investor criteria/profile fields an investor may propose changing (spec §4). */
export const INVESTOR_CHANGE_FIELDS = [
  "sectorFocus", "geographicFocus", "instruments", "investmentStages",
  "ticketMin", "ticketMax", "targetIrr", "status", "countryRestrictions",
  "esgFocus", "investmentMandate", "shareholdingPreference", "pricingPreference",
  "remainingInvestmentPeriod", "ddRequirements", "icApprovalProcess",
  "trackRecord", "feedback",
] as const;

/** Contact fields an investor may propose changing (requires personId). */
export const PERSON_CHANGE_FIELDS = [
  "firstName", "lastName", "email", "phone", "jobTitle", "isPrimaryContact",
] as const;

function splitProposedFields(
  proposed: Record<string, unknown>,
  hasPerson: boolean,
): { investorFields: Record<string, unknown>; personFields: Record<string, unknown> } {
  const investorFields: Record<string, unknown> = {};
  const personFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(proposed)) {
    if ((INVESTOR_CHANGE_FIELDS as readonly string[]).includes(key)) investorFields[key] = value;
    else if (hasPerson && (PERSON_CHANGE_FIELDS as readonly string[]).includes(key)) personFields[key] = value;
    else throw new CrudError(`Field "${key}" is not allowed in an investor proposed change`);
  }
  return { investorFields, personFields };
}

export async function submitInvestorUpdate(input: {
  investorId: string;
  personId?: string | null;
  proposedFields: Record<string, unknown>;
  summary: string;
  sourceEmail: string;
}): Promise<{ ok: true }> {
  const investor = await prisma.investor.findUnique({ where: { id: input.investorId } });
  if (!investor) throw new CrudError("Investor not found");
  if (input.personId) {
    const person = await prisma.person.findUnique({ where: { id: input.personId } });
    if (!person || person.investorId !== investor.id)
      throw new CrudError("Contact does not belong to this investor");
  }
  if (!input.summary.trim()) throw new CrudError("Summary is required");
  if (Object.keys(input.proposedFields).length === 0) throw new CrudError("No fields proposed");
  splitProposedFields(input.proposedFields, Boolean(input.personId)); // validates whitelist

  await prisma.$transaction(async (tx) => {
    await tx.investorProposedChange.create({
      data: {
        investorId: investor.id,
        personId: input.personId ?? null,
        proposedFields: input.proposedFields as object,
        summary: input.summary,
        sourceEmail: input.sourceEmail,
        createdSource: "AGENT",
      },
    });
    await tx.task.create({
      data: {
        title: `Confirm investor profile update — ${investor.name}`,
        body: input.summary,
        source: "Other",
        investorId: investor.id,
      },
    });
  });
  return { ok: true };
}

export async function logInvestorCommunication(input: {
  investorId: string;
  direction: "Inbound" | "Outbound";
  interactionType: string;
  subject?: string | null;
  summary: string;
}): Promise<{ ok: true }> {
  const investor = await prisma.investor.findUnique({ where: { id: input.investorId } });
  if (!investor) throw new CrudError("Investor not found");
  await logActivity(
    {
      type: input.interactionType as InteractionType,
      channel: "Email",
      direction: input.direction,
      subject: input.subject?.trim() || `Investor email — ${input.interactionType}`,
      body: input.summary,
      investorId: investor.id,
    },
    { type: "AGENT", authenticated: true },
  );
  return { ok: true };
}

export async function confirmProposedChange(id: string, actor: Actor): Promise<{ ok: true }> {
  assertCan(actor, "Investors", "U");
  const row = await prisma.investorProposedChange.findUnique({ where: { id } });
  if (!row || row.status !== "Pending") throw new CrudError("Proposed change not found or already reviewed");
  const proposed = row.proposedFields as Record<string, unknown>;
  const { investorFields, personFields } = splitProposedFields(proposed, Boolean(row.personId));
  if (Object.keys(investorFields).length > 0) await updateInvestor(row.investorId, investorFields, actor);
  if (row.personId && Object.keys(personFields).length > 0) await updatePerson(row.personId, personFields, actor);
  await prisma.investorProposedChange.update({
    where: { id },
    data: { status: "Confirmed", reviewedById: actor.userId ?? null, reviewedAt: new Date() },
  });
  return { ok: true };
}

export async function rejectProposedChange(id: string, actor: Actor): Promise<{ ok: true }> {
  assertCan(actor, "Investors", "U");
  const row = await prisma.investorProposedChange.findUnique({ where: { id } });
  if (!row || row.status !== "Pending") throw new CrudError("Proposed change not found or already reviewed");
  await prisma.investorProposedChange.update({
    where: { id },
    data: { status: "Rejected", reviewedById: actor.userId ?? null, reviewedAt: new Date() },
  });
  return { ok: true };
}
