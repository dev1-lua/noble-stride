import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { staffRefusal, type StaffCheck } from "../../lib/staff-mode";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { MANDATE_REFERRAL_STATUS, TRANSACTION_REFERRAL_STATUS } from "../../lib/queries";
import { resolveByNameOrId } from "../../lib/record-lookup";
import { hasRecordedAgreement, type PartnerAgreementFields } from "../../lib/guards";
import type { Resolution } from "../../lib/resolve";

const inputSchema = z.object({
  deal: z
    .string()
    .min(1)
    .describe("Deal (mandate or transaction) name as the user said it, or an exact id from a previous candidates list"),
  dealType: z
    .enum(["mandate", "transaction"])
    .optional()
    .describe("Narrow the lookup when the user said which pipeline the deal is in"),
});

interface OriginatorPartner extends PartnerAgreementFields {
  id: string;
  partnerType?: string | null;
  status: string;
}

interface StageChange {
  field: string;
  fromValue?: string | null;
  toValue: string;
  changedAt: string;
  createdSource: string;
  changedBy?: { name: string } | null;
}

interface MandateStatus {
  mandate: {
    id: string;
    name: string;
    stage: string;
    stageEnteredAt?: string | null;
    daysInStage: number;
    dealStatus: string;
    dealSize?: number | null;
    currency?: string | null;
    dateOpened?: string | null;
    createdAt: string;
    updatedAt: string;
    client: { id: string; name: string } | null;
    referredBy: OriginatorPartner | null;
    transactions: Array<{ id: string; name: string; stage: string; dealStatus: string; targetRaise?: number | null; currency?: string | null; partnerFeeStatus?: string | null; partnerFeeAmount?: number | null }>;
    stageChanges: StageChange[];
  } | null;
}

interface TransactionStatus {
  transaction: {
    id: string;
    name: string;
    stage: string;
    stageEnteredAt?: string | null;
    dealStatus: string;
    targetRaise?: number | null;
    currency?: string | null;
    partnerFeeStatus?: string | null;
    partnerFeeAmount?: number | null;
    dateOpened?: string | null;
    closedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    client: { id: string; name: string } | null;
    referredBy: OriginatorPartner | null;
    mandate: { id: string; name: string; stage: string; referredBy: OriginatorPartner | null } | null;
    stageChanges: StageChange[];
  } | null;
}

function originatorView(partner: OriginatorPartner | null, via: "direct" | "mandate") {
  if (!partner) return null;
  return {
    id: partner.id,
    name: partner.name,
    type: partner.partnerType ?? null,
    status: partner.status,
    via,
    agreement: {
      feeSharingAgreement: partner.feeSharingAgreement,
      status: partner.partnerAgreementStatus,
      terms: partner.feeSharingTerms ?? null,
      recorded: hasRecordedAgreement(partner),
    },
  };
}

export class GetReferralStatusTool implements LuaTool {
  name = "get_referral_status";
  description =
    "Referral status of ONE deal (mandate or transaction): who introduced it, the stage timeline since introduction, whether the referral converted, partner fee status, and a deep link. Identify the deal by name or by an exact id from a previous candidates list.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient; isStaff?: StaffCheck }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const refusal = await staffRefusal(this.deps?.isStaff);
    if (refusal) return refusal;
    const crm = this.deps?.crm ?? crmClientFromEnv();

    // Resolve the deal — across both pipelines unless the user named one.
    const types: Array<"mandate" | "transaction"> = input.dealType ? [input.dealType] : ["mandate", "transaction"];
    const resolutions: Array<{ type: "mandate" | "transaction"; resolution: Resolution }> = [];
    for (const type of types) {
      resolutions.push({ type, resolution: await resolveByNameOrId(crm, type, input.deal) });
    }
    const matches = resolutions.filter((r) => r.resolution.kind === "match");
    const ambiguous = resolutions.filter((r) => r.resolution.kind === "ambiguous");

    if (matches.length === 0 && ambiguous.length === 0) {
      return { status: "not_found" as const, message: `No mandate or transaction matching "${input.deal}" was found in the CRM.` };
    }
    if (matches.length > 1 || ambiguous.length > 0) {
      const candidates = [
        ...matches.map((m) => (m.resolution.kind === "match" ? [m.resolution.result] : [])).flat(),
        ...ambiguous.map((a) => (a.resolution.kind === "ambiguous" ? a.resolution.candidates : [])).flat(),
      ];
      return {
        status: "ambiguous" as const,
        message: "Multiple deals match — ask the user to pick one, then call again with the chosen id and its dealType.",
        candidates: candidates.slice(0, 8).map((c) => ({ id: c.id, type: c.type, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    const match = matches[0];
    const dealId = match.resolution.kind === "match" ? match.resolution.result.id : "";

    if (match.type === "mandate") {
      const detail = await crm.query<MandateStatus>(MANDATE_REFERRAL_STATUS, { id: dealId });
      const m = detail.mandate;
      if (!m) return { status: "not_found" as const, message: "The mandate could not be loaded from the CRM." };
      if (!m.referredBy) {
        return {
          status: "not_referred" as const,
          message: `${m.name} has no referring partner on record — it was not introduced via a referral (or the link hasn't been recorded; link_partner_to_deal can record it).`,
          link: `${crm.baseUrl}/mandates/${m.id}`,
        };
      }
      return {
        status: "ok" as const,
        deal: {
          id: m.id,
          name: m.name,
          type: "mandate" as const,
          client: m.client?.name ?? null,
          stage: m.stage,
          daysInStage: m.daysInStage,
          dealStatus: m.dealStatus,
          dealSize: m.dealSize ?? null,
          currency: m.currency ?? null,
          converted: m.stage === "Signed",
          lost: m.stage === "Lost",
          transactions: m.transactions,
        },
        originator: originatorView(m.referredBy, "direct"),
        stageTimeline: m.stageChanges.filter((c) => c.field === "stage" || c.field === "dealStatus").slice(0, 20),
        link: `${crm.baseUrl}/mandates/${m.id}`,
      };
    }

    const detail = await crm.query<TransactionStatus>(TRANSACTION_REFERRAL_STATUS, { id: dealId });
    const t = detail.transaction;
    if (!t) return { status: "not_found" as const, message: "The transaction could not be loaded from the CRM." };
    const originator = t.referredBy
      ? originatorView(t.referredBy, "direct")
      : originatorView(t.mandate?.referredBy ?? null, "mandate");
    if (!originator) {
      return {
        status: "not_referred" as const,
        message: `${t.name} has no referring partner on record (neither directly nor via its mandate) — link_partner_to_deal can record one.`,
        link: `${crm.baseUrl}/transactions/${t.id}`,
      };
    }
    return {
      status: "ok" as const,
      deal: {
        id: t.id,
        name: t.name,
        type: "transaction" as const,
        client: t.client?.name ?? null,
        stage: t.stage,
        dealStatus: t.dealStatus,
        targetRaise: t.targetRaise ?? null,
        currency: t.currency ?? null,
        converted: t.stage === "ClosedWon",
        lost: t.stage === "ClosedLost",
        mandate: t.mandate ? { name: t.mandate.name, stage: t.mandate.stage } : null,
      },
      originator,
      fee: { status: t.partnerFeeStatus ?? null, amount: t.partnerFeeAmount ?? null },
      stageTimeline: t.stageChanges.filter((c) => c.field === "stage" || c.field === "dealStatus").slice(0, 20),
      link: `${crm.baseUrl}/transactions/${t.id}`,
    };
  }
}
