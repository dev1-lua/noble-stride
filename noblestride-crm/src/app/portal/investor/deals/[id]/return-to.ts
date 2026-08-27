// Where express-interest sends the investor back to (F6b.1).
//
// A separate module because `actions.ts` is a "use server" file, and those may
// only export async functions — a synchronous helper exported from there is a
// build error, not a lint nit.

/**
 * Interest can now be registered from the browse grid, the pipeline or the deal
 * page, so the action takes a returnTo. It is allow-listed rather than
 * validated by shape: an open redirect out of a signed-in portal form is
 * exactly what a phishing link wants, and there are only three legitimate
 * destinations.
 */
export function safeReturnTo(raw: unknown, dealId: string): string {
  const dealPath = `/portal/investor/deals/${dealId}`;
  const allowed = new Set(["/portal/investor", "/portal/investor/pipeline", dealPath]);
  return typeof raw === "string" && allowed.has(raw) ? raw : dealPath;
}
