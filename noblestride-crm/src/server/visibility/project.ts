// Visibility engine — projectors (design spec §5.2–§5.4, build-spec §11).
// Pure functions: they take already-loaded records and return external-safe
// DTOs. Nothing here touches the DB; see load.ts for the fetch + project glue.

import type {
  DealType,
  DocumentAccessLevel,
  DocumentStatus,
  DocumentType,
  EngagementStage,
  Geography,
  ImpactFlag,
  Instrument,
  InvestorEngagementClassification,
  MandateStage,
  MilestoneKey,
  OnboardingStatus,
  PartnerAgreementStatus,
  AdvisorType,
  Profitability,
  Sector,
  TransactionStage,
} from "@prisma/client";
import { effectiveMilestones, MILESTONE_ORDER } from "@/lib/milestones";
import type { Tier } from "./tiers";
import { isBlockedClassification, isOnboardingBlocked } from "./tiers";
import { fieldAccess, isFieldVisible } from "./matrix";
import { dealCodename } from "./codename";
import { label } from "@/lib/vocab";

// ─── Numeric helpers ─────────────────────────────────────────────────────────

/** Prisma Decimal, plain number, or numeric string. */
export type DecimalLike = number | string | { toString(): string };

/** Normalise a Decimal-like value to a number (null-safe). */
export function toNum(value: DecimalLike | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

/**
 * Coarse currency band for `limited` financial disclosure (§5.2 row 3).
 * Amounts are absolute currency units (seed data stores raw USD).
 */
export function bandCurrency(amount: DecimalLike | null | undefined): string | null {
  const n = toNum(amount);
  if (n == null) return null;
  const M = 1_000_000;
  if (n < 1 * M) return "< $1M";
  if (n < 5 * M) return "$1M–$5M";
  if (n < 10 * M) return "$5M–$10M";
  if (n < 25 * M) return "$10M–$25M";
  if (n < 50 * M) return "$25M–$50M";
  if (n < 100 * M) return "$50M–$100M";
  return "$100M+";
}

// ─── Input shapes (structural subsets of loaded Prisma records) ──────────────

export interface PersonInput {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
}

export interface DocumentInput {
  id: string;
  name: string;
  type: DocumentType;
  version?: string | null;
  accessLevel: DocumentAccessLevel;
  status?: DocumentStatus | null;
  fileUrl?: string | null;
}

export interface EngagementInput {
  id?: string;
  investorId: string;
  engagementStage: EngagementStage;
  investor?: { id?: string; name?: string } | null;
  notes?: string | null;
  feedback?: string | null;
}

export interface DealClientInput {
  name: string;
  sector?: Sector[];
  description?: string | null;
  coreProduct?: string | null;
  hqCity?: string | null;
  countries?: Geography[];
  yearFounded?: number | null;
  revenueLastYear?: DecimalLike | null;
  revenueForecast?: DecimalLike | null;
  profitability?: Profitability | null;
  /** §3.1 impact flags — projected as booleans in companyProfile, visible at all tiers. */
  impactFlags?: ImpactFlag[];
  contacts?: PersonInput[];
  // Present on loaded records but NEVER projected at any tier (they belong to
  // the fullFinancials group, which stays internal for now):
  ebitda?: DecimalLike | null;
  existingDebt?: DecimalLike | null;
  totalAssets?: DecimalLike | null;
}

/** A transaction loaded with its relations, as the portal loaders fetch it. */
export interface DealInput {
  id: string;
  name: string;
  stage: TransactionStage;
  dealType?: DealType | null;
  instrument?: Instrument[];
  targetRaise?: DecimalLike | null;
  currency?: string;
  sector?: Sector[];
  client?: DealClientInput | null;
  mandate?: { stage: MandateStage } | null;
  engagements?: EngagementInput[];
  documents?: DocumentInput[];
  // Present on loaded records but NEVER projected (hard rules):
  serviceProviders?: unknown[];
  activities?: unknown[];
  owner?: unknown;
  ddTracks?: unknown[];
  icFirstApprovalDate?: unknown;
  icSecondApprovalDate?: unknown;
  cakComesaStatus?: unknown;
  cakComesaFiledDate?: unknown;
  cakComesaApprovedDate?: unknown;
}

// ─── Projected (external-safe) shapes ────────────────────────────────────────

export interface ProjectedDocument {
  id: string;
  name: string;
  type: DocumentType;
  version: string | null;
  status: DocumentStatus | null;
  fileUrl: string | null;
}

export interface ProjectedContact {
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
}

export interface ProjectedDeal {
  id: string;
  name: string;
  tier: Exclude<Tier, "NONE">;
  companyProfile: {
    clientName: string;
    sector: Sector[];
    description: string | null;
    coreProduct: string | null;
    hqCity: string | null;
    countries: Geography[];
    yearFounded: number | null;
    womenLed: boolean;
    youthLed: boolean;
  };
  dealTypeTicket: {
    dealType: DealType | null;
    instrument: Instrument[];
    targetRaise: number | null;
    currency: string;
  };
  /** limited → coarse bands (strings); full → raw numbers. */
  financialsSummary: {
    disclosure: "limited" | "full";
    revenueLastYear: string | number | null;
    revenueForecast: string | number | null;
    profitability: Profitability | null;
  };
  matchingMandateStatus: MandateStage | null;
  documents: ProjectedDocument[];
  /** Client-side contacts — DD tier only, otherwise null. */
  advisorClientContacts: ProjectedContact[] | null;
  /** Generic advisor contact line — never a named team member. */
  contact: string;
}

/** The only advisor contact external roles ever see (no User identities). */
export const GENERIC_CONTACT_LINE = "NobleStride Advisory — deals@noblestride.com";

// ─── Document gating ─────────────────────────────────────────────────────────

/** Doc types an investor may see before signing an NDA (teaser-level only). */
const PRE_INTEREST_DOC_TYPES: readonly DocumentType[] = ["Teaser", "PitchDeck"];

/** Hard rule: engagement contracts never leave the building (§5.2). */
const NEVER_SHARED_DOC_TYPES: readonly DocumentType[] = ["EngagementContract"];

function projectDocuments(
  documents: DocumentInput[],
  tier: Exclude<Tier, "NONE">,
  ndaSatisfied: boolean,
  codename: string,
): ProjectedDocument[] {
  const masked = tier === "PRE_INTEREST";
  return documents
    .filter((doc) => {
      if (NEVER_SHARED_DOC_TYPES.includes(doc.type)) return false;
      // Internal and ClientShared documents are never investor-visible.
      if (doc.accessLevel === "Internal" || doc.accessLevel === "ClientShared") return false;
      // VDR files: hidden until tier DD ("on request" → hidden, spec §10) AND
      // the correct signed NDA (SOW §06).
      if (doc.accessLevel === "VDR") return fieldAccess("vdrFiles", tier) === "full" && ndaSatisfied;
      // InvestorShared: teaser-level only before NDA; everything after.
      if (tier === "PRE_INTEREST") return PRE_INTEREST_DOC_TYPES.includes(doc.type);
      return true;
    })
    .map((doc) => ({
      id: doc.id,
      // §11: at PRE_INTEREST the document title must not carry the real client
      // identity — replace it with the doc-type label + deal codename, and drop
      // fileUrl (a path could embed the real name).
      name: masked ? `${label("DocumentType", doc.type)} — ${codename}` : doc.name,
      type: doc.type,
      version: doc.version ?? null,
      status: doc.status ?? null,
      fileUrl: masked ? null : (doc.fileUrl ?? null),
    }));
}

// ─── Deal projection ─────────────────────────────────────────────────────────

export interface ProjectDealOptions {
  /** Open NDA on the investor, or a Closed NDA on THIS deal's engagement. */
  ndaSatisfied?: boolean;
}

/**
 * Project one deal for an external investor at a resolved tier (§5.2).
 * Returns null at tier NONE. The output NEVER contains: other investors'
 * engagements or identities, partner/provider identities, internal notes or
 * feedback, engagement contracts, Internal/ClientShared documents, or named
 * team members — regardless of tier (hard rules).
 *
 * At PRE_INTEREST the deal and client identity are masked with a
 * deterministic codename (design spec §5); they unmask once the investor
 * moves past PRE_INTEREST (AFTER_NDA/DD). VDR documents additionally require
 * a satisfied NDA — see `opts.ndaSatisfied` (secure default: false).
 */
export function projectDealForInvestor(
  deal: DealInput,
  tier: Tier,
  opts: ProjectDealOptions = {},
): ProjectedDeal | null {
  if (tier === "NONE") return null;
  const ndaSatisfied = opts.ndaSatisfied ?? false;

  const client = deal.client ?? null;
  const sectors = [...new Set([...(deal.sector ?? []), ...(client?.sector ?? [])])];

  const financialsFull = fieldAccess("financialsSummary", tier) === "full";
  const revenueLastYear = client?.revenueLastYear ?? null;
  const revenueForecast = client?.revenueForecast ?? null;

  const masked = tier === "PRE_INTEREST";
  const displayName = masked ? dealCodename(deal.id) : deal.name;

  return {
    id: deal.id,
    name: displayName,
    tier,
    companyProfile: {
      clientName: masked ? displayName : (client?.name ?? deal.name),
      sector: sectors,
      description: client?.description ?? null,
      coreProduct: client?.coreProduct ?? null,
      hqCity: client?.hqCity ?? null,
      countries: client?.countries ?? [],
      yearFounded: client?.yearFounded ?? null,
      womenLed: (client?.impactFlags ?? []).includes("WomenLed"),
      youthLed: (client?.impactFlags ?? []).includes("YouthLed"),
    },
    dealTypeTicket: {
      dealType: deal.dealType ?? null,
      instrument: deal.instrument ?? [],
      targetRaise: toNum(deal.targetRaise),
      currency: deal.currency ?? "USD",
    },
    financialsSummary: financialsFull
      ? {
          disclosure: "full",
          revenueLastYear: toNum(revenueLastYear),
          revenueForecast: toNum(revenueForecast),
          profitability: client?.profitability ?? null,
        }
      : {
          disclosure: "limited",
          revenueLastYear: bandCurrency(revenueLastYear),
          revenueForecast: bandCurrency(revenueForecast),
          profitability: client?.profitability ?? null,
        },
    matchingMandateStatus: deal.mandate?.stage ?? null,
    documents: projectDocuments(deal.documents ?? [], tier, ndaSatisfied, displayName),
    advisorClientContacts: isFieldVisible("advisorClientContacts", tier)
      ? (client?.contacts ?? []).map((c) => ({
          name: [c.firstName, c.lastName ?? ""].join(" ").trim(),
          jobTitle: c.jobTitle ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
        }))
      : null,
    contact: GENERIC_CONTACT_LINE,
  };
}

// ─── Own-engagement projection (investor's own journey) ─────────────────────
// The milestone docs are explicitly the investor's own perspective: an
// investor may see their OWN stage, milestones, last contact and term-sheet
// status. They must NEVER see internal feedback, probability, notes,
// disbursement amounts, owner/team identities, or anything about other
// investors — this projector maps an explicit allowlist and drops the rest.

/** An engagement row as loaded for the OWNING investor. Extra (internal-only)
 *  fields may be present on the input; they are never projected. */
export interface OwnEngagementInput {
  transactionId: string;
  engagementStage: EngagementStage;
  lastContact?: Date | null;
  termSheetIssued?: boolean;
  termSheetDate?: Date | null;
  // Present on loaded records but NEVER projected (hard rules):
  notes?: string | null;
  feedback?: string | null;
  probability?: number | null;
  totalAmount?: unknown;
  amountDisbursed?: unknown;
  amountPending?: unknown;
  disbursementStatus?: unknown;
  ownerId?: string | null;
  owner?: unknown;
}

export interface OwnMilestoneInput {
  key: MilestoneKey;
}

export interface ProjectedOwnEngagement {
  dealId: string;
  stage: EngagementStage;
  lastContact: Date | null;
  termSheetIssued: boolean;
  termSheetDate: Date | null;
  /** Completed milestones (stage-implied ∪ recorded), in MILESTONE_ORDER. */
  milestoneKeys: MilestoneKey[];
}

/**
 * Project an investor's OWN engagement on a deal (their own journey only).
 * Output contains ONLY: dealId, stage, lastContact, termSheetIssued,
 * termSheetDate, milestoneKeys. Never feedback/probability/notes/amounts/
 * owner or other-investor data.
 */
export function projectOwnEngagement(
  engagement: OwnEngagementInput,
  milestones: OwnMilestoneInput[],
): ProjectedOwnEngagement {
  const done = effectiveMilestones(
    engagement.engagementStage,
    milestones.map((m) => m.key),
  );
  return {
    dealId: engagement.transactionId,
    stage: engagement.engagementStage,
    lastContact: engagement.lastContact ?? null,
    termSheetIssued: engagement.termSheetIssued ?? false,
    termSheetDate: engagement.termSheetDate ?? null,
    milestoneKeys: MILESTONE_ORDER.filter((k) => done.has(k)),
  };
}

// ─── Discovery (§5.3) ────────────────────────────────────────────────────────

export interface DiscoveryInvestor {
  engagementClassification: InvestorEngagementClassification;
  onboardingStatus: OnboardingStatus;
  sectorFocus?: Sector[];
  geographicFocus?: Geography[];
  ticketMin?: DecimalLike | null;
  ticketMax?: DecimalLike | null;
}

const CLOSED_STAGES: readonly TransactionStage[] = ["ClosedWon", "ClosedLost"];

function overlaps<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.some((v) => b.includes(v));
}

/**
 * Filter candidate deals down to what an investor may DISCOVER (§5.3).
 * Pure: pass in candidate transactions (with client). Rules:
 * - blocked classification (Excluded/Greylisted/Inactive/OnHold) → [] (empty portal)
 * - closed deals (ClosedWon/ClosedLost) are never discoverable
 * - sector: match when either side has no sector data, otherwise require overlap
 *   (deal-level OR client-level sector)
 * - geography: match when either side is empty or the investor focus includes
 *   Global, otherwise require overlap with the client's countries
 * - ticket: when the deal has a targetRaise, it must sit inside the investor's
 *   [ticketMin, ticketMax] (missing bounds are open-ended)
 */
export function discoverableDealsForInvestor<T extends DealInput>(
  investor: DiscoveryInvestor,
  deals: T[],
): T[] {
  if (isOnboardingBlocked(investor.onboardingStatus)) return [];
  if (isBlockedClassification(investor.engagementClassification)) return [];

  const sectorFocus = investor.sectorFocus ?? [];
  const geoFocus = investor.geographicFocus ?? [];
  const ticketMin = toNum(investor.ticketMin);
  const ticketMax = toNum(investor.ticketMax);

  return deals.filter((deal) => {
    if (CLOSED_STAGES.includes(deal.stage)) return false;

    const dealSectors = [...new Set([...(deal.sector ?? []), ...(deal.client?.sector ?? [])])];
    if (sectorFocus.length > 0 && dealSectors.length > 0 && !overlaps(sectorFocus, dealSectors)) {
      return false;
    }

    const countries = deal.client?.countries ?? [];
    if (
      geoFocus.length > 0 &&
      countries.length > 0 &&
      !geoFocus.includes("Global") &&
      !overlaps(geoFocus, countries)
    ) {
      return false;
    }

    const raise = toNum(deal.targetRaise);
    if (raise != null) {
      if (ticketMin != null && raise < ticketMin) return false;
      if (ticketMax != null && raise > ticketMax) return false;
    }
    return true;
  });
}

// ─── Partner projection (§5.4) ───────────────────────────────────────────────

export interface PartnerInput {
  id: string;
  name: string;
  advisorType?: AdvisorType | null;
  organization?: string | null;
  feeSharingAgreement: boolean;
  feeSharingTerms?: string | null;
  partnerAgreementStatus: PartnerAgreementStatus;
}

export interface ReferredMandateInput {
  name: string;
  stage: MandateStage;
  dealSize?: DecimalLike | null;
  currency?: string;
  client?: { name: string } | null;
}

export interface ProjectedPartnerView {
  profile: {
    name: string;
    advisorType: AdvisorType | null;
    organization: string | null;
    feeSharingAgreement: boolean;
    feeSharingTerms: string | null;
    partnerAgreementStatus: PartnerAgreementStatus;
  };
  referredDeals: {
    mandateName: string;
    clientName: string | null;
    stage: MandateStage;
    dealSize: number | null;
    currency: string;
    converted: boolean;
    feeSharingStatus: string;
  }[];
}

/**
 * Read-only partner view (§5.4): own profile + own referred deals with stage,
 * conversion and fee-sharing status. Never investor identities, never other
 * partners, never internal notes or full deal financials — the projector maps
 * an explicit allowlist of fields and drops everything else.
 */
export function projectForPartner(
  partner: PartnerInput,
  referredMandates: ReferredMandateInput[],
): ProjectedPartnerView {
  const feeSharingStatus = partner.feeSharingAgreement
    ? (partner.feeSharingTerms ?? "Agreed")
    : "None";

  return {
    profile: {
      name: partner.name,
      advisorType: partner.advisorType ?? null,
      organization: partner.organization ?? null,
      feeSharingAgreement: partner.feeSharingAgreement,
      feeSharingTerms: partner.feeSharingTerms ?? null,
      partnerAgreementStatus: partner.partnerAgreementStatus,
    },
    referredDeals: referredMandates.map((mandate) => ({
      mandateName: mandate.name,
      clientName: mandate.client?.name ?? null,
      stage: mandate.stage,
      dealSize: toNum(mandate.dealSize),
      currency: mandate.currency ?? "USD",
      converted: mandate.stage === "Signed",
      feeSharingStatus,
    })),
  };
}
