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

/** Reverse of SEARCH_TYPE: backend `type` string → the agent's RecordType. */
export const RECORD_TYPE_BY_SEARCH: Record<string, RecordType> = Object.fromEntries(
  Object.entries(SEARCH_TYPE).map(([rt, t]) => [t, rt as RecordType]),
) as Record<string, RecordType>;

export type AnyResolution =
  | { kind: "match"; result: SearchResult; recordType: RecordType }
  | { kind: "ambiguous"; candidates: SearchResult[] }
  | { kind: "none" };

/**
 * Resolve a record by name WITHOUT knowing its type — for "check everything on X"
 * where the model shouldn't have to guess client vs mandate vs transaction. Only
 * considers hits whose type maps to a summarizable RecordType (ignores Task,
 * Person, Document, ServiceProvider). Mirrors resolveRecord's tolerance: exact
 * title wins, else a single summarizable hit is accepted verbatim.
 */
export function resolveAnyRecord(results: SearchResult[], query: string): AnyResolution {
  const summarizable = results.filter((r) => r.type in RECORD_TYPE_BY_SEARCH);
  if (summarizable.length === 0) return { kind: "none" };

  const rt = (r: SearchResult) => RECORD_TYPE_BY_SEARCH[r.type];

  const byId = summarizable.find((r) => r.id === query);
  if (byId) return { kind: "match", result: byId, recordType: rt(byId) };

  const q = query.trim().toLowerCase();
  const exact = summarizable.filter((r) => r.title.trim().toLowerCase() === q);
  if (exact.length === 1) return { kind: "match", result: exact[0], recordType: rt(exact[0]) };

  if (summarizable.length === 1) return { kind: "match", result: summarizable[0], recordType: rt(summarizable[0]) };
  return { kind: "ambiguous", candidates: summarizable.slice(0, 5) };
}
