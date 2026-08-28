// Deal-awareness resolver (WS-H.4, client question: "will this agent be smart
// enough to know the deal I'm looking at?"). Kept as a small, pure helper over
// tool OUTPUT rather than baked into a tool: it classifies whatever list of
// engaged deals get_engaged_deals (the READ-ONLY B2 tool) returns into the
// none/one/many shapes the correspondence skill answers differently.
//
// B2 update: deal-awareness is now answered by get_engaged_deals
// (investorEngagedDeals query — engagementId/codename/status/stagePhrase, no
// portal link minted) instead of express_deal_interest (which stays reserved
// for recording explicit interest and DOES mint a one-time portal login link).
// The interface below covers both shapes generically — portalUrl stays optional
// for the express-interest adapter kept below; get_engaged_deals never sets it.

/** An investor-facing engaged deal — codename only, NEVER the real client/deal name. */
export interface EngagedDeal {
  codename: string;
  /** Only ever populated via express_deal_interest's mutation result. */
  portalUrl?: string | null;
  /** Populated via get_engaged_deals (investorEngagedDeals). */
  engagementId?: string | null;
  status?: string | null;
  stagePhrase?: string | null;
}

export type DealResolution =
  | { kind: "none" }
  | { kind: "one"; deal: EngagedDeal }
  | { kind: "many"; deals: EngagedDeal[] };

/** Classify an investor's engaged deals into the none/one/many shapes the
 *  correspondence skill answers differently: exactly one -> answer about it
 *  at their tier; several -> list codenames and ask which; none -> explain
 *  there's no active engagement and how to express interest. */
export function resolveEngagedDeal(deals: EngagedDeal[]): DealResolution {
  const named = deals.filter((d) => d.codename && d.codename.trim().length > 0);
  if (named.length === 0) return { kind: "none" };
  if (named.length === 1) return { kind: "one", deal: named[0]! };
  return { kind: "many", deals: named };
}

/** Adapts express_deal_interest's single-result shape into the resolver's
 *  list input. matched:false or a missing dealName both mean "no engaged
 *  deal to resolve" (the "none" branch). */
export function engagedDealsFromExpressInterestResult(result: {
  matched: boolean;
  dealName?: string | null;
  portalUrl?: string | null;
}): EngagedDeal[] {
  if (!result.matched || !result.dealName) return [];
  return [{ codename: result.dealName, portalUrl: result.portalUrl ?? null }];
}

/** Adapts get_engaged_deals' (investorEngagedDeals) result shape into the resolver's
 *  list input. `matched:false` (unmatched sender, or channel_unverified) means "no
 *  engaged deal to resolve" (the "none" branch) — the caller's persona/skill layer is
 *  responsible for phrasing an unmatched/unverified sender differently from a
 *  genuinely-matched investor with zero engaged deals; this adapter only feeds the
 *  none/one/many classification itself. */
export function engagedDealsFromGetEngagedDealsResult(result: {
  matched: boolean;
  deals?: Array<{ engagementId: string; codename: string; status: string; stagePhrase: string }> | null;
}): EngagedDeal[] {
  if (!result.matched) return [];
  return (result.deals ?? []).map((d) => ({
    codename: d.codename,
    engagementId: d.engagementId,
    status: d.status,
    stagePhrase: d.stagePhrase,
  }));
}
