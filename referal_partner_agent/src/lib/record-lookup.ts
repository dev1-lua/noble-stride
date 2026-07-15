import type { CrmClient } from "./crm-client";
import { GLOBAL_SEARCH, PARTNER_BY_ID, MANDATE_BY_ID, CLIENT_BY_ID, TRANSACTION_BY_ID } from "./queries";
import { resolveRecord, SEARCH_TYPE, type RecordType, type Resolution, type SearchResult } from "./resolve";

/**
 * globalSearch is a case-insensitive name-contains search — record ids never
 * match it. Tools tell the model to re-call with an exact id from a previous
 * candidates list, so name resolution needs a direct by-id fallback.
 */

const ID_LOOKUPS: Partial<Record<RecordType, { document: string; rootField: string; hrefPrefix: string }>> = {
  partner: { document: PARTNER_BY_ID, rootField: "partner", hrefPrefix: "/partners" },
  mandate: { document: MANDATE_BY_ID, rootField: "mandate", hrefPrefix: "/mandates" },
  client: { document: CLIENT_BY_ID, rootField: "client", hrefPrefix: "/clients" },
  transaction: { document: TRANSACTION_BY_ID, rootField: "transaction", hrefPrefix: "/transactions" },
};

export function looksLikeRecordId(query: string): boolean {
  return /^c[a-z0-9]{20,32}$/i.test(query.trim());
}

/** Resolve a user-supplied name OR an exact id to one record of the given type. */
export async function resolveByNameOrId(
  crm: CrmClient,
  recordType: RecordType,
  query: string,
): Promise<Resolution> {
  const search = await crm.query<{ globalSearch: SearchResult[] }>(GLOBAL_SEARCH, { query, limit: 10 });
  const resolution = resolveRecord(search.globalSearch, recordType, query);
  if (resolution.kind !== "none" || !looksLikeRecordId(query)) return resolution;

  const lookup = ID_LOOKUPS[recordType];
  if (!lookup) return resolution;
  try {
    const detail = await crm.query<Record<string, { id: string; name: string } | null>>(lookup.document, {
      id: query.trim(),
    });
    const record = detail[lookup.rootField];
    if (record) {
      return {
        kind: "match",
        result: {
          id: record.id,
          type: SEARCH_TYPE[recordType],
          title: record.name,
          subtitle: null,
          href: `${lookup.hrefPrefix}/${record.id}`,
        },
      };
    }
  } catch {
    // Unknown id (or transient error) — fall through to the search verdict.
  }
  return resolution;
}
