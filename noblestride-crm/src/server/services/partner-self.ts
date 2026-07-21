// partner-self.ts — partner self-service verification + own-record view/update
// (SOW §7.2 Partner "own" access). A partner is a data point, not a CRM login:
// staff issue a static reference code/PIN out-of-band, the partner presents it to
// verify on their channel, then may view their OWN referral picture and PROPOSE
// updates to their OWN contact details (queued for staff review — never applied
// directly, SOW §8.4).
//
// Security posture mirrors client-status.ts:
//   • only a sha256 HASH of the code is stored (raw code returned once, to staff);
//   • anti-enumeration — every verify failure path returns the identical FAILED
//     shape, never leaking whether a partner/code exists;
//   • attempt lockout on the partner record;
//   • success mints a short-lived signed JWT traded for a HARD-WHITELISTED payload.
//
// Pluggable verification seam: `partnerSelfView`/`submitPartnerSelfUpdate` consume
// only the signed `partner-self` token and are independent of HOW the partner was
// verified. The static-PIN path (`verifyPartnerAccessCode`) is the first method;
// once a WhatsApp Business API is provisioned, a WA-native method that matches the
// platform-verified sender number to Partner.phone can mint the same token via
// `issuePartnerSelfToken` with NO change to the view/update surface.

import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashOtpCode } from "@/server/auth/otp";
import { CrudError } from "./crud";

export const PARTNER_TOKEN_TTL_S = 900; // 15 minutes
const PARTNER_TOKEN_PURPOSE = "partner-self";
export const ACCESS_CODE_MAX_ATTEMPTS = 5;
export const ACCESS_CODE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const FAILED = { status: "failed" as const };

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

/** A high-entropy, human-relayable static code (base64url, ~64 bits). */
export function generatePartnerAccessCode(): string {
  return randomBytes(8).toString("base64url");
}

export async function issuePartnerSelfToken(partnerId: string): Promise<string> {
  return new SignJWT({ partnerId, purpose: PARTNER_TOKEN_PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PARTNER_TOKEN_TTL_S}s`)
    .sign(secret());
}

export async function verifyPartnerToken(token: string): Promise<{ partnerId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.purpose !== PARTNER_TOKEN_PURPOSE) return null;
    if (typeof payload.partnerId !== "string") return null;
    return { partnerId: payload.partnerId };
  } catch {
    return null;
  }
}

/**
 * Issue (or rotate) a partner's static access code. Staff-only path (gated at the
 * GraphQL layer by assertAutomation, and by the referral agent's staff passphrase
 * mode). Stores only the hash; returns the raw code ONCE for out-of-band delivery.
 * Resets any prior failed-attempt lockout.
 */
export async function issuePartnerAccessCode(partnerId: string): Promise<{ code: string }> {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId }, select: { id: true } });
  if (!partner) throw new CrudError("Partner not found");
  const code = generatePartnerAccessCode();
  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      accessCodeHash: hashOtpCode(code),
      accessCodeSetAt: new Date(),
      accessCodeFailedAttempts: 0,
      accessCodeLockedUntil: null,
    },
  });
  return { code };
}

/** Resolve a partner from a caller-supplied reference: exact id, else exact
 *  (case-insensitive) email. Ambiguous or no match → null (the caller collapses
 *  this to the uniform FAILED shape).
 *
 *  Deliberately NOT matched by name (review MED-1): referral partners are often
 *  firms whose names are effectively public, so name-based verification would let
 *  anyone trip a real partner's attempt-lockout as a denial-of-service. Requiring
 *  the on-record email (semi-private) shrinks that surface. A stronger follow-up
 *  is per-source (channel/user) rate-limiting on verify, which needs the caller
 *  identity plumbed through from the agent. */
async function resolvePartnerByRef(ref: string): Promise<{ id: string; accessCodeHash: string | null; accessCodeFailedAttempts: number; accessCodeLockedUntil: Date | null } | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  const select = {
    id: true,
    accessCodeHash: true,
    accessCodeFailedAttempts: true,
    accessCodeLockedUntil: true,
  } as const;
  const byId = await prisma.partner.findUnique({ where: { id: trimmed }, select });
  if (byId) return byId;
  const byEmail = await prisma.partner.findMany({
    where: { email: { equals: trimmed, mode: "insensitive" } },
    select,
    take: 2,
  });
  return byEmail.length === 1 ? byEmail[0] : null; // 0 or ambiguous(>1) → never guess
}

/**
 * Verify a partner's static access code. Anti-enumeration: unmatched ref, no code
 * set, lockout, or wrong code all return the identical FAILED shape. On success,
 * resets the attempt counter and mints a short-lived signed token.
 */
export async function verifyPartnerAccessCode(
  partnerRef: string,
  code: string,
): Promise<{ status: "ok"; token: string } | { status: "failed" }> {
  if (!partnerRef.trim() || !code.trim()) return FAILED;
  const partner = await resolvePartnerByRef(partnerRef);
  if (!partner || !partner.accessCodeHash) return FAILED;
  if (partner.accessCodeLockedUntil && partner.accessCodeLockedUntil.getTime() > Date.now()) return FAILED;

  if (partner.accessCodeHash !== hashOtpCode(code)) {
    const attempts = partner.accessCodeFailedAttempts + 1;
    const locked = attempts >= ACCESS_CODE_MAX_ATTEMPTS;
    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        accessCodeFailedAttempts: locked ? 0 : attempts,
        accessCodeLockedUntil: locked ? new Date(Date.now() + ACCESS_CODE_LOCKOUT_MS) : partner.accessCodeLockedUntil,
      },
    });
    return FAILED;
  }

  await prisma.partner.update({
    where: { id: partner.id },
    data: { accessCodeFailedAttempts: 0, accessCodeLockedUntil: null },
  });
  const token = await issuePartnerSelfToken(partner.id);
  return { status: "ok", token };
}

// ─────────────────────────────────────────────────────────────────────────────
// partnerSelfView — consumes a partner-self token and returns the HARD-WHITELISTED
// payload. This shape IS the security boundary (SOW §7.2 hard rule + §11): a
// partner sees ONLY their own contact/agreement state and the stage/status of the
// deals THEY introduced — never other partners, investor identities, fee amounts
// beyond their own agreement flags, or internal notes. Adding a field here is a
// spec violation regardless of how "harmless" it looks.
// ─────────────────────────────────────────────────────────────────────────────

export interface PartnerReferredDealView {
  dealName: string;
  stage: string;
  status: string;
}

export interface PartnerSelfPayload {
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  advisorType: string | null;
  feeAgreementOnFile: boolean; // NOT the terms/amount — just whether a signed agreement exists
  referredDeals: PartnerReferredDealView[];
  referredDealCount: number;
}

export async function partnerSelfView(token: string): Promise<PartnerSelfPayload> {
  const claims = await verifyPartnerToken(token);
  if (!claims) throw new CrudError("Verification expired — please verify again.");
  const partner = await prisma.partner.findUnique({
    where: { id: claims.partnerId },
    select: {
      name: true,
      organization: true,
      email: true,
      phone: true,
      advisorType: true,
      feeSharingAgreement: true,
      partnerAgreementStatus: true,
      referredMandates: { select: { name: true, stage: true, dealStatus: true } },
      referredTransactions: { select: { name: true, stage: true, dealStatus: true } },
    },
  });
  if (!partner) throw new CrudError("Verification expired — please verify again.");

  const referredDeals: PartnerReferredDealView[] = [
    ...partner.referredMandates.map((m) => ({
      dealName: m.name,
      stage: String(m.stage),
      status: String(m.dealStatus),
    })),
    ...partner.referredTransactions.map((t) => ({
      dealName: t.name,
      stage: String(t.stage),
      status: String(t.dealStatus),
    })),
  ];

  return {
    name: partner.name,
    organization: partner.organization,
    email: partner.email,
    phone: partner.phone,
    advisorType: partner.advisorType ? String(partner.advisorType) : null,
    feeAgreementOnFile: partner.feeSharingAgreement === true && partner.partnerAgreementStatus === "Signed",
    referredDeals,
    referredDealCount: referredDeals.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// submitPartnerSelfUpdate — a verified partner PROPOSES changes to their own
// contact details. Never mutates the Partner directly: writes a
// PartnerProposedChange + a staff review Task (SOW §8.4). Whitelist is contact
// info only — NEVER the fee-sharing/agreement legal facts (those are staff-owned;
// a partner must not be able to self-assert a signed fee agreement).
// ─────────────────────────────────────────────────────────────────────────────

export const PARTNER_SELF_EDITABLE_FIELDS = ["email", "phone", "organization"] as const;

const MAX_SELF_FIELD_LEN = 300;

export function pickPartnerSelfFields(proposed: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(proposed)) {
    if (!(PARTNER_SELF_EDITABLE_FIELDS as readonly string[]).includes(key)) {
      throw new CrudError(`Field "${key}" cannot be self-updated by a partner`);
    }
    // Defense-in-depth (review LOW-2): the agent tool already zod-validates these,
    // but a direct automation-key caller does not — every self-editable field is a
    // short string, so reject non-strings and oversized values before queueing.
    if (typeof value !== "string" || value.trim() === "" || value.length > MAX_SELF_FIELD_LEN) {
      throw new CrudError(`Field "${key}" must be a non-empty string under ${MAX_SELF_FIELD_LEN} characters`);
    }
    out[key] = value;
  }
  return out;
}

export async function submitPartnerSelfUpdate(
  token: string,
  proposedFields: Record<string, unknown>,
  summary: string,
): Promise<{ ok: true }> {
  const claims = await verifyPartnerToken(token);
  if (!claims) throw new CrudError("Verification expired — please verify again.");
  const cleaned = pickPartnerSelfFields(proposedFields); // throws on any non-whitelisted field
  if (Object.keys(cleaned).length === 0) throw new CrudError("No fields proposed");
  if (!summary.trim()) throw new CrudError("Summary is required");

  const partner = await prisma.partner.findUnique({ where: { id: claims.partnerId }, select: { id: true, name: true } });
  if (!partner) throw new CrudError("Verification expired — please verify again.");

  await prisma.$transaction(async (tx) => {
    await tx.partnerProposedChange.create({
      data: {
        partnerId: partner.id,
        proposedFields: cleaned as object,
        summary,
        createdSource: "AGENT",
      },
    });
    await tx.task.create({
      data: {
        title: `Confirm partner contact update — ${partner.name}`,
        body: summary,
        source: "Other",
      },
    });
  });
  return { ok: true };
}
