// Public application tracking (F2.4 / §2b G1).
//
// The client's ask, from the annotation on image25: "give visibility to the
// client of the information submitted and the status." Applicants had no way to
// see anything after submitting — the intake wizard ended on a thank-you page.
//
// There is no applicant account, and creating one would be worse than the
// problem: an applicant has one thing to check, occasionally. So the flow is a
// 6-digit code to the email they applied with, traded for a short-lived signed
// cookie. Same shape as client-status.ts, which does this for the web-chat
// "check my status" flow.
//
// ANTI-ENUMERATION is the binding constraint on this module. requestApplicantOtp
// returns { ok: true } on every path — unknown email, blocked email, mail
// failure, rate limit — because any difference in the response tells an
// anonymous caller whether an address applied to Noblestride.

import { SignJWT, jwtVerify } from "jose";
import type { DocumentStatus, DocumentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateOtpCode, hashOtpCode, OTP_TTL_MS } from "@/server/auth/otp";
import { recordDevOtp } from "@/server/auth/dev-otp-sink";
import { rateLimit } from "@/server/auth/rate-limit";
import { sendApplicantOtpEmail } from "@/server/auth/auth-mail";
import { normalizeEmail } from "@/server/auth/guardrails";
import { applicationTabOf, applicationStatusLabel } from "@/server/domain/application-status";
import { label } from "@/lib/vocab";

export const APPLICANT_SESSION_COOKIE = "ns_applicant";
export const APPLICANT_TOKEN_TTL_S = 1800; // 30 minutes
export const APPLICANT_OTP_MAX_PER_WINDOW = 3;
export const APPLICANT_OTP_WINDOW_MS = 15 * 60 * 1000;

const APPLICANT_TOKEN_PURPOSE = "applicant-status";
const OK = { ok: true } as const;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

async function signApplicantToken(email: string): Promise<string> {
  return new SignJWT({ email, purpose: APPLICANT_TOKEN_PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${APPLICANT_TOKEN_TTL_S}s`)
    .sign(secret());
}

export async function verifyApplicantToken(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    // The purpose claim matters: client-status.ts signs with the same secret,
    // and its tokens must not open application tracking.
    if (payload.purpose !== APPLICANT_TOKEN_PURPOSE) return null;
    if (typeof payload.email !== "string" || !payload.email) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

let bypassWarned = false;
/**
 * QA hatch for environments where the dev OTP sink file is unavailable (some CI
 * sandboxes). Inert in production regardless of the env var.
 */
function otpBypassEnabled(): boolean {
  const on = Boolean(process.env.E2E_OTP_BYPASS) && process.env.NODE_ENV !== "production";
  if (on && !bypassWarned) {
    bypassWarned = true;
    console.warn("[applicant-status] E2E_OTP_BYPASS is enabled — do not use in production");
  }
  return on;
}

/**
 * Issue a code to an applicant's email. Always resolves { ok: true }: see the
 * anti-enumeration note at the top of the file.
 */
export async function requestApplicantOtp(
  emailRaw: string,
  deps?: { send?: typeof sendApplicantOtpEmail },
): Promise<{ ok: true }> {
  const email = normalizeEmail(emailRaw);
  if (!email) return OK;

  // Two limits, deliberately: the in-memory limiter throttles a burst from one
  // process, and the row count survives a restart.
  if (!rateLimit(`applicant-otp:${email}`, {
    max: APPLICANT_OTP_MAX_PER_WINDOW,
    windowMs: APPLICANT_OTP_WINDOW_MS,
  })) {
    return OK;
  }
  const recent = await prisma.applicantOtpChallenge.count({
    where: { email, createdAt: { gt: new Date(Date.now() - APPLICANT_OTP_WINDOW_MS) } },
  });
  if (recent >= APPLICANT_OTP_MAX_PER_WINDOW) return OK;

  // Only ever one live code per email.
  await prisma.applicantOtpChallenge.updateMany({
    where: { email, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateOtpCode();
  await prisma.applicantOtpChallenge.create({
    data: {
      email,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  recordDevOtp(email, code);
  try {
    await (deps?.send ?? sendApplicantOtpEmail)({ to: email, code });
  } catch (err) {
    // Never let a transport failure change the response shape.
    console.error("[applicant-status] OTP send failed:", err);
  }
  return OK;
}

export async function verifyApplicantOtp(
  emailRaw: string,
  code: string,
): Promise<{ status: "ok"; token: string } | { status: "failed" }> {
  const email = normalizeEmail(emailRaw);
  if (!email || !/^\d{6}$/.test(code.trim())) return { status: "failed" };

  const challenge = await prisma.applicantOtpChallenge.findFirst({
    where: { email, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { status: "failed" };
  if (challenge.attempts >= challenge.maxAttempts) return { status: "failed" };

  const matches = challenge.codeHash === hashOtpCode(code.trim()) || otpBypassEnabled();
  if (!matches) {
    await prisma.applicantOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { status: "failed" };
  }

  // Single use, race-safe: only one caller can claim it.
  const claimed = await prisma.applicantOtpChallenge.updateMany({
    where: { id: challenge.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return { status: "failed" };

  return { status: "ok", token: await signApplicantToken(email) };
}

export interface ApplicantDocument {
  name: string;
  typeLabel: string;
  status: DocumentStatus | null;
  uploadedAt: Date;
}

export interface ApplicantApplication {
  mandateId: string;
  clientId: string;
  company: string;
  submittedAt: Date;
  status: "Awaiting review" | "Accepted / In progress" | "Not taken forward";
  statusDetail: string;
  contactName: string;
  contactEmail: string;
  documents: ApplicantDocument[];
  /** How many investors have registered interest. A COUNT, never names. */
  interestCount: number;
}

const STATUS_BY_TAB = {
  awaiting: "Awaiting review",
  accepted: "Accepted / In progress",
  dropped: "Not taken forward",
} as const;

/**
 * Every website application filed under this email address.
 *
 * The projection is an explicit allow-list. In particular documents expose a
 * name, a type, a status and a date and NOTHING else — no fileUrl, no
 * storageKey, no download link — and investor interest is a count, never
 * identities (the Aika pattern: a founder sees "3 investors interested", never
 * which three).
 */
export async function listApplicationsForEmail(emailRaw: string): Promise<ApplicantApplication[]> {
  const email = normalizeEmail(emailRaw);
  if (!email) return [];

  const mandates = await prisma.mandate.findMany({
    where: {
      source: "Website",
      client: { contacts: { some: { email: { equals: email, mode: "insensitive" } } } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      client: {
        include: {
          contacts: { orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }] },
          documents: {
            where: { isCurrent: true },
            orderBy: { uploadedAt: "desc" },
            select: { name: true, type: true, status: true, uploadedAt: true },
          },
        },
      },
      transactions: { select: { _count: { select: { engagements: true } } } },
    },
  });

  return mandates.map((m) => {
    const tab = applicationTabOf(m);
    const contact =
      m.client.contacts.find((c) => (c.email ?? "").toLowerCase() === email) ?? m.client.contacts[0] ?? null;
    const interest = m.transactions.reduce((n, t) => n + t._count.engagements, 0);
    return {
      mandateId: m.id,
      clientId: m.clientId,
      company: m.client.name,
      submittedAt: m.createdAt,
      status: STATUS_BY_TAB[tab],
      statusDetail: applicationStatusLabel(m),
      contactName: contact ? `${contact.firstName} ${contact.lastName ?? ""}`.trim() : "",
      contactEmail: contact?.email ?? email,
      documents: m.client.documents.map((d) => ({
        name: d.name,
        typeLabel: label("DocumentType", d.type as DocumentType),
        status: d.status,
        uploadedAt: d.uploadedAt,
      })),
      // Interest only becomes meaningful once the deal is actually being worked.
      interestCount: tab === "accepted" ? interest : 0,
    };
  });
}
