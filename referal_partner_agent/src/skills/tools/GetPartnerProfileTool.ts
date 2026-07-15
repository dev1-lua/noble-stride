import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { PARTNER_REFERRAL_DETAIL } from "../../lib/queries";
import { resolveByNameOrId } from "../../lib/record-lookup";
import { hasRecordedAgreement } from "../../lib/guards";

const inputSchema = z.object({
  partner: z
    .string()
    .min(1)
    .describe("Partner name as the user said it, or an exact id from a previous candidates list"),
});

interface PartnerDetail {
  partner: {
    id: string;
    name: string;
    partnerType?: string | null;
    status: string;
    location?: string | null;
    organization?: string | null;
    email?: string | null;
    phone?: string | null;
    profile?: string | null;
    feeSharingAgreement: boolean;
    feeSharingTerms?: string | null;
    partnerAgreementStatus: string;
    internalOnly: boolean;
    feedbackNotes?: string | null;
    createdAt: string;
    updatedAt: string;
    contacts: Array<{ firstName: string; lastName?: string | null; email?: string | null; jobTitle?: string | null; isPrimaryContact: boolean }>;
    referredMandates: Array<{
      id: string;
      name: string;
      stage: string;
      dealStatus: string;
      dealSize?: number | null;
      currency?: string | null;
      stageEnteredAt?: string | null;
      updatedAt: string;
      client: { id: string; name: string } | null;
      transactions: Array<{ id: string; name: string; stage: string; dealStatus: string; targetRaise?: number | null; currency?: string | null; partnerFeeStatus?: string | null; partnerFeeAmount?: number | null }>;
    }>;
    referredTransactions: Array<{
      id: string;
      name: string;
      stage: string;
      dealStatus: string;
      targetRaise?: number | null;
      currency?: string | null;
      partnerFeeStatus?: string | null;
      partnerFeeAmount?: number | null;
      mandateId?: string | null;
      client: { id: string; name: string } | null;
    }>;
    stageChanges: Array<{ field: string; fromValue?: string | null; toValue: string; changedAt: string; createdSource: string; changedBy?: { name: string } | null }>;
  } | null;
}

export class GetPartnerProfileTool implements LuaTool {
  name = "get_partner_profile";
  description =
    "Full referral profile of ONE partner: contact details, fee-sharing agreement state, every deal they introduced (mandates and transactions, with stages and conversion), fee statuses, change history, and a deep link. Identify the partner by name or by an exact id from a previous candidates list.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();

    const resolution = await resolveByNameOrId(crm, "partner", input.partner);
    if (resolution.kind === "none") {
      return { status: "not_found" as const, message: `No partner matching "${input.partner}" was found in the CRM.` };
    }
    if (resolution.kind === "ambiguous") {
      return {
        status: "ambiguous" as const,
        message: "Multiple partners match — ask the user to pick one, then call again with the chosen id.",
        candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    const detail = await crm.query<PartnerDetail>(PARTNER_REFERRAL_DETAIL, { id: resolution.result.id });
    const p = detail.partner;
    if (!p) return { status: "not_found" as const, message: "The partner could not be loaded from the CRM." };

    const ownMandateIds = new Set(p.referredMandates.map((m) => m.id));
    const directTransactions = p.referredTransactions.filter(
      (t) => t.mandateId == null || !ownMandateIds.has(t.mandateId),
    );

    const convertedMandates = p.referredMandates.filter((m) => m.stage === "Signed").length;
    const convertedTransactions = directTransactions.filter((t) => t.stage === "ClosedWon").length;

    return {
      status: "ok" as const,
      partner: {
        id: p.id,
        name: p.name,
        type: p.partnerType ?? null,
        status: p.status,
        location: p.location ?? null,
        organization: p.organization ?? null,
        email: p.email ?? null,
        phone: p.phone ?? null,
        profile: p.profile ?? null,
        internalOnly: p.internalOnly,
        feedbackNotes: p.feedbackNotes ?? null,
        contacts: p.contacts,
        agreement: {
          feeSharingAgreement: p.feeSharingAgreement,
          status: p.partnerAgreementStatus,
          terms: p.feeSharingTerms ?? null,
          recorded: hasRecordedAgreement(p),
        },
      },
      referrals: {
        mandates: p.referredMandates.map((m) => ({
          id: m.id,
          name: m.name,
          client: m.client?.name ?? null,
          stage: m.stage,
          dealStatus: m.dealStatus,
          dealSize: m.dealSize ?? null,
          currency: m.currency ?? null,
          converted: m.stage === "Signed",
          lost: m.stage === "Lost",
          transactions: m.transactions,
          link: `${crm.baseUrl}/mandates/${m.id}`,
        })),
        directTransactions: directTransactions.map((t) => ({
          id: t.id,
          name: t.name,
          client: t.client?.name ?? null,
          stage: t.stage,
          dealStatus: t.dealStatus,
          targetRaise: t.targetRaise ?? null,
          currency: t.currency ?? null,
          converted: t.stage === "ClosedWon",
          lost: t.stage === "ClosedLost",
          fee: { status: t.partnerFeeStatus ?? null, amount: t.partnerFeeAmount ?? null },
          link: `${crm.baseUrl}/transactions/${t.id}`,
        })),
        totals: {
          referred: p.referredMandates.length + directTransactions.length,
          converted: convertedMandates + convertedTransactions,
        },
      },
      history: p.stageChanges.slice(0, 20),
      link: `${crm.baseUrl}/partners/${p.id}`,
    };
  }
}
