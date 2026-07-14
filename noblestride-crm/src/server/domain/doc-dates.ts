// doc-dates.ts — pure reconciliation of a document's sent/signed dates from
// its status. No I/O, no Date.now() — `now` is passed in, matching journey.ts.
// A document's journey trigger reads the DATE (e.g. mandate.ndaSignedDate),
// while the UI sets the STATUS enum; this keeps the two in sync.

import type { DocStatus } from "@prisma/client";

export interface DocDateState {
  status: DocStatus;
  sentDate: Date | null;
  signedDate: Date | null;
}

/** A caller-supplied change. `undefined` = not provided; explicit `null` = clear. */
export interface DocDateInput {
  status?: DocStatus | null;
  sentDate?: Date | null;
  signedDate?: Date | null;
}

/** Only the fields that should change (spread into a Prisma update). */
export interface DocDatePatch {
  sentDate?: Date | null;
  signedDate?: Date | null;
}

/**
 * Reconcile one document's dates. Manual date overrides win; otherwise, when a
 * status is being set: Signed stamps signedDate (if empty); Sent stamps
 * sentDate and clears signedDate; NotSent clears both. No status + no override
 * → empty patch (dates untouched).
 */
export function reconcileDocDates(next: DocDateInput, existing: DocDateState, now: Date): DocDatePatch {
  const patch: DocDatePatch = {};

  const sentOverridden = next.sentDate !== undefined;
  const signedOverridden = next.signedDate !== undefined;
  if (sentOverridden) patch.sentDate = next.sentDate ?? null;
  if (signedOverridden) patch.signedDate = next.signedDate ?? null;

  if (next.status != null) {
    if (next.status === "Signed") {
      if (!signedOverridden) patch.signedDate = existing.signedDate ?? now;
    } else if (next.status === "Sent") {
      if (!sentOverridden) patch.sentDate = existing.sentDate ?? now;
      if (!signedOverridden) patch.signedDate = null;
    } else {
      // NotSent
      if (!sentOverridden) patch.sentDate = null;
      if (!signedOverridden) patch.signedDate = null;
    }
  }

  return patch;
}

export interface MandateDocInput {
  ndaStatus?: DocStatus | null;
  ndaSentDate?: Date | null;
  ndaSignedDate?: Date | null;
  eaStatus?: DocStatus | null;
  eaSentDate?: Date | null;
  eaSignedDate?: Date | null;
}

export interface MandateDocState {
  ndaStatus: DocStatus;
  ndaSentDate: Date | null;
  ndaSignedDate: Date | null;
  eaStatus: DocStatus;
  eaSentDate: Date | null;
  eaSignedDate: Date | null;
}

export interface MandateDocPatch {
  ndaSentDate?: Date | null;
  ndaSignedDate?: Date | null;
  eaSentDate?: Date | null;
  eaSignedDate?: Date | null;
}

/** Apply reconcileDocDates to a mandate's NDA and EA pairs. */
export function reconcileMandateDocDates(input: MandateDocInput, existing: MandateDocState, now: Date): MandateDocPatch {
  const nda = reconcileDocDates(
    { status: input.ndaStatus, sentDate: input.ndaSentDate, signedDate: input.ndaSignedDate },
    { status: existing.ndaStatus, sentDate: existing.ndaSentDate, signedDate: existing.ndaSignedDate },
    now,
  );
  const ea = reconcileDocDates(
    { status: input.eaStatus, sentDate: input.eaSentDate, signedDate: input.eaSignedDate },
    { status: existing.eaStatus, sentDate: existing.eaSentDate, signedDate: existing.eaSignedDate },
    now,
  );
  return {
    ...(nda.sentDate !== undefined ? { ndaSentDate: nda.sentDate } : {}),
    ...(nda.signedDate !== undefined ? { ndaSignedDate: nda.signedDate } : {}),
    ...(ea.sentDate !== undefined ? { eaSentDate: ea.sentDate } : {}),
    ...(ea.signedDate !== undefined ? { eaSignedDate: ea.signedDate } : {}),
  };
}
