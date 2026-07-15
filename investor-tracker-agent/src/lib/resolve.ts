export type RecordType = "client" | "investor" | "mandate" | "transaction" | "engagement" | "partner";

/** globalSearch returns these `type` strings (see CRM global-search.ts). */
export const SEARCH_TYPE: Record<RecordType, string> = {
  client: "Client",
  investor: "Investor",
  mandate: "Mandate",
  transaction: "Transaction",
  engagement: "Engagement",
  partner: "Partner",
};

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  href: string;
}

export type Resolution =
  | { kind: "match"; result: SearchResult }
  | { kind: "ambiguous"; candidates: SearchResult[] }
  | { kind: "none" };

export function resolveRecord(results: SearchResult[], recordType: RecordType, query: string): Resolution {
  const wanted = SEARCH_TYPE[recordType];
  const ofType = results.filter((r) => r.type === wanted);
  if (ofType.length === 0) return { kind: "none" };

  const byId = ofType.find((r) => r.id === query);
  if (byId) return { kind: "match", result: byId };

  const q = query.trim().toLowerCase();
  const exact = ofType.filter((r) => r.title.trim().toLowerCase() === q);
  if (exact.length === 1) return { kind: "match", result: exact[0] };

  if (ofType.length === 1) return { kind: "match", result: ofType[0] };
  return { kind: "ambiguous", candidates: ofType.slice(0, 5) };
}
