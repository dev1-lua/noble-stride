// Server-side domain guards for AGENT-originated writes (closes "gap F").
//
// The excluded-investor rule (SPEC §8.3/§12.7) and the fee-sharing rule (SPEC
// §8.4/§12.8) were previously enforced only inside individual Lua agents
// (investor-tracker-agent/src/lib/guards.ts checkExcludedGuard,
// referal_partner_agent/src/lib/guards.ts checkFeeGuard). The generic crmAgent
// write path (agentPrepareWrite → create*/update* services) did not import them,
// so those rules could be bypassed. Enforcing here, in the shared service layer,
// closes the hole for EVERY agent path — CREATE and UPDATE, via the two-phase
// ledger AND the god-mode direct GraphQL mutations — because they all call these
// service functions.
//
// Gated on agent actors only (`isAgentActor`) so human CRM-UI edits are
// unaffected; humans remain governed by the RBAC matrix + UI flows.

import { CrudError } from "@/server/services/crud";
import type { Actor } from "@/graphql/context";

export function isAgentActor(actor: Actor): boolean {
  return actor.type === "AGENT" || actor.type === "API";
}

// ─── Excluded-investor guard (SPEC §8.3) ─────────────────────────────────────
// Excluded/Greylisted investors' engagements may only be wound DOWN — recording
// a decline or a fell-off/dropped disbursement — never advanced or enriched.

const BLOCKED_CLASSIFICATIONS: ReadonlySet<string> = new Set(["Excluded", "Greylisted"]);
const WIND_DOWN_STAGES: ReadonlySet<string> = new Set(["Declined"]); // EngagementStage
const WIND_DOWN_DISBURSEMENTS: ReadonlySet<string> = new Set(["FellOff", "Dropped"]); // DisbursementStatus

/**
 * Pure: true when a blocked-classification investor's engagement is being changed
 * in any way OTHER than a pure wind-down (Declined stage and/or FellOff/Dropped
 * disbursement, with no other fields set). `change` is the full update payload.
 */
export function engagementChangeBlocked(
  classification: string | null | undefined,
  change: Record<string, unknown>,
): boolean {
  if (!classification || !BLOCKED_CLASSIFICATIONS.has(classification)) return false;
  const keys = Object.keys(change).filter((k) => change[k] !== undefined);
  if (keys.length === 0) return false; // a no-op update changes nothing — nothing to block
  const isWindDown =
    keys.every(
      (k) =>
        (k === "engagementStage" && WIND_DOWN_STAGES.has(String(change[k]))) ||
        (k === "disbursementStatus" && WIND_DOWN_DISBURSEMENTS.has(String(change[k]))),
    );
  return !isWindDown;
}

export function assertAgentEngagementAllowed(
  actor: Actor,
  investor: { name: string; engagementClassification: string | null },
  change: Record<string, unknown>,
): void {
  if (!isAgentActor(actor)) return;
  if (!engagementChangeBlocked(investor.engagementClassification, change)) return;
  throw new CrudError(
    `${investor.name} is classified ${investor.engagementClassification} — an agent cannot advance or enrich ` +
      `this engagement. Only recording a decline or a fell-off/dropped disbursement is permitted. ` +
      `Ask an admin to review the investor's classification if this seems wrong.`,
  );
}

/**
 * Creating an engagement IS sharing a deal with an investor (SPEC §8.3/§12.7:
 * "never share a deal with an excluded investor"). An agent must not open any
 * engagement for an Excluded/Greylisted investor — even a historical wind-down
 * stage would still create the sharing link, so a create is refused outright.
 */
export function assertAgentEngagementCreateAllowed(
  actor: Actor,
  investor: { name: string; engagementClassification: string | null },
): void {
  if (!isAgentActor(actor)) return;
  const c = investor.engagementClassification;
  if (!c || !BLOCKED_CLASSIFICATIONS.has(c)) return;
  throw new CrudError(
    `${investor.name} is classified ${c} — an agent cannot open an engagement (share a deal) with an ` +
      `excluded or greylisted investor. Ask an admin to review the investor's classification if this seems wrong.`,
  );
}

// ─── Fee-sharing guard (SPEC §8.4) ───────────────────────────────────────────
// A partner fee may be marked owed (status ≠ NotDue) or given an amount only when
// the deal's referring partner has a recorded, signed fee-sharing agreement.

export interface FeeChange {
  partnerFeeStatus?: string | null;
  partnerFeeAmount?: number | null;
}

export function feeChangeMarksOwed(change: FeeChange): boolean {
  const statusOwed =
    change.partnerFeeStatus !== undefined && change.partnerFeeStatus !== null && change.partnerFeeStatus !== "NotDue";
  const amountSet = change.partnerFeeAmount !== undefined && change.partnerFeeAmount !== null;
  return statusOwed || amountSet;
}

export function partnerHasSignedAgreement(
  partner: { feeSharingAgreement: boolean; partnerAgreementStatus: string } | null,
): boolean {
  return !!partner && partner.feeSharingAgreement === true && partner.partnerAgreementStatus === "Signed";
}

export function assertAgentFeeAllowed(
  actor: Actor,
  change: FeeChange,
  partner: { name: string; feeSharingAgreement: boolean; partnerAgreementStatus: string } | null,
): void {
  if (!isAgentActor(actor)) return;
  if (!feeChangeMarksOwed(change)) return;
  if (!partner) {
    throw new CrudError(
      "This deal has no referring partner on record — an agent cannot record a partner fee without one. " +
        "Link the originating partner to the deal first.",
    );
  }
  if (!partnerHasSignedAgreement(partner)) {
    throw new CrudError(
      `${partner.name} has no recorded, signed fee-sharing agreement — an agent cannot record a partner fee ` +
        `status or amount until one is on file (feeSharingAgreement: true, partnerAgreementStatus: Signed).`,
    );
  }
}
