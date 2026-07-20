/**
 * scripts/lib/test-data-guard.ts
 *
 * Pure, DB-free classification logic for `scripts/cleanup-test-data.ts`.
 *
 * WHY THIS EXISTS: `createdSource` on Investor/Client/Mandate/Document/
 * ServiceProvider/Partner is NOT a reliable "is this real client data"
 * filter — the real importer (`scripts/import-real-data.ts`) stamps
 * `IMPORT`, but demo "plant" scripts also stamp `IMPORT`/`API`, imported
 * Tasks default to `HUMAN` (indistinguishable from a human-typed test task),
 * and `Person` has no provenance column at all. The only trustworthy ground
 * truth for "this row came from the client's real excel files" is
 * `prisma/real-data.json`. This module is therefore ALLOW-LIST driven:
 * build a set of protected identifiers from real-data.json (plus the
 * `@noblestride.capital` staff domain), and classify every row as either
 * "protected" (never delete) or "candidate" (safe to propose deleting).
 *
 * No row is ever assumed to be test data by default — everything not
 * affirmatively matched to something protected falls out as a *candidate*
 * for deletion, but nothing here does the deleting. See
 * `scripts/cleanup-test-data.ts` for the transactional delete + rollback
 * safety net that consumes this module's output.
 *
 * Pure module: no `fs`, no `@prisma/client`, no env access. Fully unit
 * testable in isolation — see `scripts/__tests__/test-data-guard.test.ts`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Normalization (behavioral spec §5)
// ─────────────────────────────────────────────────────────────────────────────

/** Any email at this exact domain is protected. Subdomains are NOT covered
 * (e.g. "user@mail.noblestride.capital" is NOT protected by this rule alone) —
 * that is a deliberate, narrow allow-list; broadening it would be a policy
 * change, not a bug fix. */
export const PROTECTED_EMAIL_DOMAIN = "noblestride.capital";

/** Dash characters the client's spreadsheet / our importer might use in the
 * mandate-name pattern "<clientName> – Advisory Mandate". We normalize every
 * variant (en dash, em dash, minus sign, hyphen) to a single "-" before
 * comparing, so "Acme Ltd – Advisory Mandate" (en dash, U+2013 — what the
 * importer actually writes) and "Acme Ltd - Advisory Mandate" (plain hyphen —
 * what a human might type by hand) are recognized as the same mandate name. */
const DASH_VARIANTS = /[‐‑‒–—−]/g;

/** spec §5: trim, lowercase, collapse internal whitespace. NFKC-normalize
 * first so visually-identical Unicode variants (e.g. full-width spaces,
 * combining forms) also collapse — a strict superset of the spec's rule,
 * never a narrower one. */
export function normalizeName(s: string): string {
  return s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

/** normalizeName, but first collapsing every dash variant to "-" — use this
 * (never plain normalizeName) for the mandate-name pattern so the en-dash
 * import format and a hand-typed hyphen compare equal. */
export function normalizeMandateName(s: string): string {
  return normalizeName(s.replace(DASH_VARIANTS, "-"));
}

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

/** Exact-domain match only (see PROTECTED_EMAIL_DOMAIN doc comment above). */
export function isProtectedDomainEmail(email: string): boolean {
  return emailDomain(normalizeEmail(email)) === PROTECTED_EMAIL_DOMAIN;
}

// ─────────────────────────────────────────────────────────────────────────────
// real-data.json shape (mirrors scripts/import-real-data.ts's RealX interfaces)
// ─────────────────────────────────────────────────────────────────────────────

export interface RealDataInvestorContact {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
}

export interface RealDataInvestor {
  name: string;
  contacts?: RealDataInvestorContact[];
}

export interface RealDataMandate {
  clientName: string;
}

export interface RealDataServiceProvider {
  name: string;
  email?: string | null;
  contactPerson?: string | null;
}

export interface RealDataPartner {
  name: string;
}

export interface RealData {
  mandates?: RealDataMandate[];
  tasks?: unknown[];
  investors?: RealDataInvestor[];
  serviceProviders?: RealDataServiceProvider[];
  partners?: RealDataPartner[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Protected sets
// ─────────────────────────────────────────────────────────────────────────────

export interface ProtectedSets {
  investorNames: Set<string>;
  clientNames: Set<string>;
  partnerNames: Set<string>;
  serviceProviderNames: Set<string>;
  /** Normalized canonical "<clientName> - advisory mandate" strings. */
  mandateNames: Set<string>;
  /** Lowercased protected contact / service-provider emails. */
  emails: Set<string>;
  /** Normalized full names of contacts that have no email on file — the
   * only signal we have for protecting them by name. */
  contactNames: Set<string>;
}

/** Build every protected identifier set from real-data.json's in-memory
 * shape. Pure function: does not read the file itself (the CLI does that
 * and passes in the parsed object) — keeps this module fs-free and testable
 * with plain fixtures. */
export function buildProtectedSets(realData: RealData): ProtectedSets {
  const investorNames = new Set<string>();
  const emails = new Set<string>();
  const contactNames = new Set<string>();

  for (const inv of realData.investors ?? []) {
    investorNames.add(normalizeName(inv.name));
    for (const c of inv.contacts ?? []) {
      if (c.email) {
        emails.add(normalizeEmail(c.email));
      } else {
        // Name-only contact (no email in the tracker) — protect by name so
        // it can never be mistaken for a wizard/agent test contact.
        contactNames.add(normalizeName(`${c.firstName} ${c.lastName ?? ""}`));
      }
    }
  }

  const clientNames = new Set<string>();
  const mandateNames = new Set<string>();
  for (const m of realData.mandates ?? []) {
    if (!m.clientName) continue;
    clientNames.add(normalizeName(m.clientName));
    mandateNames.add(normalizeMandateName(`${m.clientName} - Advisory Mandate`));
  }

  const partnerNames = new Set<string>();
  for (const p of realData.partners ?? []) {
    partnerNames.add(normalizeName(p.name));
  }

  const serviceProviderNames = new Set<string>();
  for (const sp of realData.serviceProviders ?? []) {
    serviceProviderNames.add(normalizeName(sp.name));
    if (sp.email) emails.add(normalizeEmail(sp.email));
    // contactPerson on a ServiceProvider is a free-text full name (not
    // firstName/lastName) — protect it too as extra margin; it can never
    // reduce protection, only extend it.
    if (sp.contactPerson) contactNames.add(normalizeName(sp.contactPerson));
  }

  return {
    investorNames,
    clientNames,
    partnerNames,
    serviceProviderNames,
    mandateNames,
    emails,
    contactNames,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Row classification
// ─────────────────────────────────────────────────────────────────────────────

export type CandidateKind =
  | "investor"
  | "client"
  | "partner"
  | "serviceProvider"
  | "mandate"
  | "user"
  | "person";

export interface NamedRow {
  name: string;
  email?: string | null;
}

export interface MandateRow {
  name: string;
  /** Name of the Client this mandate belongs to (joined in by the caller —
   * Mandate.clientId is required/non-null in the schema, so this is always
   * populated for a real row). */
  clientName: string | null;
}

export interface UserRow {
  email: string;
}

export interface PersonRow {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
}

/** Row shape per kind — a discriminated union keyed by `kind` so callers get
 * compile-time checking of which fields they must project from Prisma. */
export type RowFor<K extends CandidateKind> = K extends "mandate"
  ? MandateRow
  : K extends "user"
    ? UserRow
    : K extends "person"
      ? PersonRow
      : NamedRow;

function isProtectedEmailOrDomain(email: string, sets: ProtectedSets): boolean {
  return isProtectedDomainEmail(email) || sets.emails.has(normalizeEmail(email));
}

/** Is this single row protected (must never be a deletion candidate)? */
export function isProtected<K extends CandidateKind>(
  kind: K,
  row: RowFor<K>,
  sets: ProtectedSets
): boolean {
  switch (kind) {
    case "investor":
      return sets.investorNames.has(normalizeName((row as NamedRow).name));
    case "client":
      return sets.clientNames.has(normalizeName((row as NamedRow).name));
    case "partner":
      return sets.partnerNames.has(normalizeName((row as NamedRow).name));
    case "serviceProvider": {
      const r = row as NamedRow;
      if (sets.serviceProviderNames.has(normalizeName(r.name))) return true;
      return !!r.email && isProtectedEmailOrDomain(r.email, sets);
    }
    case "mandate": {
      const r = row as MandateRow;
      if (sets.mandateNames.has(normalizeMandateName(r.name))) return true;
      return !!r.clientName && sets.clientNames.has(normalizeName(r.clientName));
    }
    case "user": {
      const r = row as UserRow;
      return isProtectedEmailOrDomain(r.email, sets);
    }
    case "person": {
      const r = row as PersonRow;
      if (r.email && isProtectedEmailOrDomain(r.email, sets)) return true;
      const fullName = normalizeName(`${r.firstName} ${r.lastName ?? ""}`);
      return sets.contactNames.has(fullName);
    }
    default:
      // Exhaustiveness guard — TS will flag this if a CandidateKind is added
      // without a case above.
      throw new Error(`isProtected: unhandled kind "${kind as string}"`);
  }
}

export interface Partition<T> {
  candidates: T[];
  protected: T[];
}

/** Split a batch of rows into deletion candidates vs. protected rows. Never
 * mutates the input array. */
export function partitionRows<K extends CandidateKind, T extends RowFor<K>>(
  kind: K,
  rows: T[],
  sets: ProtectedSets
): Partition<T> {
  const candidates: T[] = [];
  const protectedRows: T[] = [];
  for (const row of rows) {
    if (isProtected(kind, row, sets)) protectedRows.push(row);
    else candidates.push(row);
  }
  return { candidates, protected: protectedRows };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hard check #1: classification re-verification (behavioral spec §2)
// ─────────────────────────────────────────────────────────────────────────────

export class ProtectedDataError extends Error {
  constructor(
    message: string,
    public readonly kind: CandidateKind,
    public readonly offendingRows: unknown[]
  ) {
    super(message);
    this.name = "ProtectedDataError";
  }
}

/** Throws ProtectedDataError (does NOT silently skip) if any row in the
 * proposed deletion list matches a protected identifier. Callers must run
 * this immediately before issuing the delete for that kind, using rows
 * freshly re-fetched inside the same transaction so a state change between
 * "compute candidates" and "delete" can never slip a protected row through. */
export function assertNoneProtected<K extends CandidateKind, T extends RowFor<K>>(
  kind: K,
  rows: T[],
  sets: ProtectedSets
): void {
  const offending = rows.filter((row) => isProtected(kind, row, sets));
  if (offending.length > 0) {
    throw new ProtectedDataError(
      `Refusing to delete: ${offending.length} "${kind}" row(s) in the candidate list match a protected identifier from real-data.json (or the @${PROTECTED_EMAIL_DOMAIN} domain). Aborting — not skipping.`,
      kind,
      offending
    );
  }
}
