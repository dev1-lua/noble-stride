import type { CrmClient } from "./crm-client";
import { DETAIL_QUERIES } from "./queries";
import type { SearchResult } from "./resolve";
import { resolveByNameOrId } from "./record-lookup";

/**
 * (investor name, deal name) → the engagement joining them. Deliberately never
 * creates an engagement: sharing a deal with a new investor is the Investor
 * Agent's job, and the excluded-investor rule applies there.
 */
export interface ResolvedParty {
  id: string;
  name: string;
}

export interface ResolutionCandidate {
  id: string;
  title: string;
  subtitle: string | null;
}

export type EngagementResolution =
  | { kind: "ok"; engagementId: string; investor: ResolvedParty; transaction: ResolvedParty }
  | { kind: "ambiguous_investor"; candidates: ResolutionCandidate[] }
  | { kind: "ambiguous_deal"; candidates: ResolutionCandidate[] }
  | { kind: "investor_not_found" }
  | { kind: "deal_not_found" }
  | { kind: "no_engagement"; investor: ResolvedParty; transaction: ResolvedParty };

interface TransactionEngagements {
  transaction: {
    id: string;
    name: string;
    engagements: Array<{ id: string; investor: { id: string; name: string } }>;
  } | null;
}

export async function resolveEngagement(
  crm: CrmClient,
  investorQuery: string,
  dealQuery: string,
): Promise<EngagementResolution> {
  const [investorRes, dealRes] = await Promise.all([
    resolveByNameOrId(crm, "investor", investorQuery),
    resolveByNameOrId(crm, "transaction", dealQuery),
  ]);

  if (investorRes.kind === "none") return { kind: "investor_not_found" };
  if (investorRes.kind === "ambiguous") {
    return { kind: "ambiguous_investor", candidates: shortlist(investorRes.candidates) };
  }

  if (dealRes.kind === "none") return { kind: "deal_not_found" };
  if (dealRes.kind === "ambiguous") {
    return { kind: "ambiguous_deal", candidates: shortlist(dealRes.candidates) };
  }

  const detail = await crm.query<TransactionEngagements>(DETAIL_QUERIES.transaction.document, {
    id: dealRes.result.id,
  });
  const transaction = detail.transaction;
  if (!transaction) return { kind: "deal_not_found" };

  const investor = { id: investorRes.result.id, name: investorRes.result.title };
  const txn = { id: transaction.id, name: transaction.name };
  const engagement = transaction.engagements.find((e) => e.investor.id === investor.id);
  if (!engagement) return { kind: "no_engagement", investor, transaction: txn };

  return { kind: "ok", engagementId: engagement.id, investor, transaction: txn };
}

function shortlist(candidates: SearchResult[]): ResolutionCandidate[] {
  return candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null }));
}
