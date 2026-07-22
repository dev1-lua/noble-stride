// client-status.ts — silent OTP challenge issuance for the public web-chat
// "check my status" flow (spec 2026-07-14). Anonymous callers only ever see
// {ok:true}: the anti-enumeration invariant from client-intake.ts applies
// here too — no branch may leak whether a company or contact email exists.

import { SignJWT, jwtVerify } from "jose";
import type { MandateStage, DealStatus, TransactionStage, DocStatus, DocumentType, DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { matchClients, emailMatchesContact } from "@/server/services/client-intake";
import { generateOtpCode, hashOtpCode, OTP_TTL_MS } from "@/server/auth/otp";
import { recordDevOtp } from "@/server/auth/dev-otp-sink";
import { sendMail } from "@/server/auth/mailer";
import { CrudError } from "./crud";

const RESEND_COOLDOWN_MS = 60_000;
const HOURLY_CAP = 5;

export const STATUS_TOKEN_TTL_S = 900; // 15 minutes
const STATUS_TOKEN_PURPOSE = "client-status";

const FAILED = { status: "failed" as const };

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

async function signStatusToken(clientId: string, personId: string): Promise<string> {
  return new SignJWT({ clientId, personId, purpose: STATUS_TOKEN_PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATUS_TOKEN_TTL_S}s`)
    .sign(secret());
}

// Exported for Task 4 (clientStatus query), which trades this token for a
// whitelisted status payload.
export async function verifyStatusToken(token: string): Promise<{ clientId: string; personId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.purpose !== STATUS_TOKEN_PURPOSE) return null;
    if (typeof payload.clientId !== "string" || typeof payload.personId !== "string") return null;
    return { clientId: payload.clientId, personId: payload.personId };
  } catch {
    return null;
  }
}

export async function requestClientStatusOtp(
  companyName: string,
  contactEmail: string,
  deps: { send: typeof sendMail } = { send: sendMail },
): Promise<{ ok: true }> {
  if (!companyName.trim() || !contactEmail.trim()) return { ok: true }; // oracle guard
  const clients = await matchClients(companyName);
  if (clients.length === 0) return { ok: true };
  const match = await emailMatchesContact(
    clients.map((c) => c.id),
    contactEmail,
  );
  if (!match) return { ok: true };

  const dest = contactEmail.trim().toLowerCase();
  const hourAgo = new Date(Date.now() - 3_600_000);
  const recent = await prisma.clientOtpChallenge.findMany({
    where: { destination: dest, createdAt: { gte: hourAgo } },
    orderBy: { createdAt: "desc" },
  });
  if (recent.length >= HOURLY_CAP) return { ok: true };
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) return { ok: true };

  await prisma.clientOtpChallenge.updateMany({
    // one active challenge per person
    where: { personId: match.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const code = generateOtpCode();
  await prisma.clientOtpChallenge.create({
    data: {
      clientId: match.clientId!,
      personId: match.id,
      codeHash: hashOtpCode(code),
      destination: dest,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  recordDevOtp(dest, code);
  try {
    await deps.send({
      to: dest,
      subject: "Your Noblestride verification code",
      text: `Your Noblestride verification code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
    });
  } catch (err) {
    console.error("requestClientStatusOtp: send failed", err); // still {ok:true}
  }
  return { ok: true };
}

/**
 * Verifies a 6-digit code against the caller's active clientOtpChallenge and,
 * on success, mints a short-lived signed status token. Every non-ok path —
 * unmatched company, unmatched contact email, no active challenge, expired
 * challenge, attempts exhausted, wrong code, or a lost single-use race —
 * returns the identical FAILED shape. No branch may leak which of those
 * happened (same anti-enumeration invariant as requestClientStatusOtp).
 */
export async function verifyClientStatusOtp(
  companyName: string,
  contactEmail: string,
  code: string,
): Promise<{ status: "ok"; token: string } | { status: "failed" }> {
  if (!companyName.trim() || !contactEmail.trim()) return FAILED;

  const clients = await matchClients(companyName);
  if (clients.length === 0) return FAILED;
  const match = await emailMatchesContact(
    clients.map((c) => c.id),
    contactEmail,
  );
  if (!match) return FAILED;

  // QA MODE (env-gated). When CLIENT_STATUS_TEST_OTP is set (any value), a caller
  // whose company + email already matched is verified IMMEDIATELY — no emailed code
  // is required at all (the `code` argument is ignored) — so the data-out flow is
  // testable without an inbox. It mints the SAME token as the real path and still
  // requires the company/email match above. Unset in production the full OTP
  // challenge below is restored unchanged; flipping this one env var is the whole
  // on/off switch.
  //
  // SECURITY: while this flag is set the verify step is a company+email existence
  // oracle with NO code and NO brute-force protection — any request for a matched
  // contact succeeds. Enable it ONLY for a controlled QA window, and never leave it
  // on for a public-facing deployment.
  if (process.env.CLIENT_STATUS_TEST_OTP) {
    const token = await signStatusToken(match.clientId!, match.id);
    return { status: "ok", token };
  }

  if (!code.trim()) return FAILED;

  const row = await prisma.clientOtpChallenge.findFirst({
    where: { personId: match.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return FAILED;
  if (row.expiresAt.getTime() <= Date.now()) return FAILED;
  if (row.attempts >= row.maxAttempts) return FAILED;

  if (row.codeHash !== hashOtpCode(code)) {
    await prisma.clientOtpChallenge.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    return FAILED;
  }

  // Correct code — claim single-use atomically (mirrors otp.ts::verifyOtpChallenge).
  const claimed = await prisma.clientOtpChallenge.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claimed.count === 0) return FAILED;

  const token = await signStatusToken(match.clientId!, match.id);
  return { status: "ok", token };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: getClientStatus — consumes a status token and returns the
// hard-whitelisted status payload (spec §5.3). This object's shape IS the
// security boundary: it must contain ONLY the fields declared on
// ClientStatusPayload below — never investor identities, qualification
// verdicts, internal notes, or anything else. Adding a field here is a spec
// violation regardless of how "harmless" it looks.
// ─────────────────────────────────────────────────────────────────────────────

export type ApplicationState = "received" | "under_review" | "engaged" | "in_execution" | "completed" | "with_team";
export type CoarseStage = "docs_prep" | "investor_outreach" | "due_diligence" | "term_sheet" | "closing";

export interface ClientStatusPayload {
  companyName: string;
  applicationState: ApplicationState;
  coarseStage: CoarseStage | null;
  stageMessage: string;
  ndaStatus: "not_sent" | "sent" | "signed" | null;
  engagementAgreementStatus: "not_sent" | "sent" | "signed" | null;
  preparedDocuments: string[]; // subset of ["Teaser","Information Memorandum","Financial Model","Valuation Report","Business Plan"]
  submittedRaise: string | null;
  nextStep: string;
  lastUpdated: string; // ISO date
}

// Highest-index-wins precedence for the client-side "in execution" sub-stages.
const TRANSACTION_PRECEDENCE = [
  "DealPreparation",
  "InvestorOutreach",
  "DueDiligence",
  "TermSheet",
  "Closing",
] as const satisfies readonly TransactionStage[];

const TRANSACTION_STAGE_TO_COARSE_STAGE: Record<(typeof TRANSACTION_PRECEDENCE)[number], CoarseStage> = {
  DealPreparation: "docs_prep",
  InvestorOutreach: "investor_outreach",
  DueDiligence: "due_diligence",
  TermSheet: "term_sheet",
  Closing: "closing",
};

const DOC_STATUS_MAP: Record<DocStatus, "not_sent" | "sent" | "signed"> = {
  NotSent: "not_sent",
  Sent: "sent",
  Signed: "signed",
};

// DocumentType enum value -> client-facing display name. Order here is also
// the canonical output order for preparedDocuments (not DB insertion order).
const PREPARED_DOCUMENT_LABELS: Array<{ type: DocumentType; label: string }> = [
  { type: "Teaser", label: "Teaser" },
  { type: "IM", label: "Information Memorandum" },
  { type: "FinancialModel", label: "Financial Model" },
  { type: "Valuation", label: "Valuation Report" },
  { type: "BusinessPlan", label: "Business Plan" },
];
const PREPARED_DOCUMENT_TYPES = PREPARED_DOCUMENT_LABELS.map((d) => d.type);
const PREPARED_DOCUMENT_STATUSES: DocumentStatus[] = ["Approved", "Shared"];

// Every reachable messageKey (see messageKeyFor below) is either a CoarseStage
// (set only when applicationState is "in_execution") or one of the other
// ApplicationState values — never "in_execution" itself, since that state
// always carries a coarseStage instead. Keying on this union makes a typo'd
// or missing entry a tsc error instead of a silent `undefined` at runtime.
type MessageKey = Exclude<ApplicationState, "in_execution"> | CoarseStage;

const STAGE_MESSAGES: Record<MessageKey, string> = {
  received: "We've received your application and it's now in our queue for initial review.",
  under_review: "Your application is under review by our team.",
  engaged: "You're engaged with us — we're preparing to take your deal to market.",
  docs_prep: "We're preparing your deal materials ahead of investor outreach.",
  investor_outreach: "We're actively reaching out to prospective investors on your behalf.",
  due_diligence: "Your deal is in due diligence with an interested party.",
  term_sheet: "We're working through term sheet discussions on your deal.",
  closing: "Your deal is in the closing stage.",
  completed: "Congratulations — your deal has closed.",
  with_team: "Your application is with our team — they'll contact you with any updates.",
};

const NEXT_STEPS: Record<MessageKey, string> = {
  received: "Our team reviews every application and will be in touch soon.",
  under_review: "Our team is reviewing your application in detail — no action is needed from you right now.",
  engaged: "We're finalizing engagement details before moving to investor outreach.",
  docs_prep: "Sit tight while we finalize your deal materials.",
  investor_outreach: "We'll update you as investor conversations progress.",
  due_diligence: "Please stay responsive to any due diligence requests from our team.",
  term_sheet: "We'll keep you posted as term sheet discussions progress.",
  closing: "We're working toward closing — your deal lead will reach out with next steps.",
  completed: "Your deal has closed — congratulations! Reach out to your deal lead with any questions.",
  with_team: "Your deal lead will reach out with any updates.",
};

/**
 * Combines coarseStage/applicationState into the STAGE_MESSAGES/NEXT_STEPS
 * key, proving to tsc that the result is never "in_execution": deriveApplicationState
 * only ever returns applicationState "in_execution" together with a non-null
 * coarseStage, so the `applicationState === "in_execution"` branch below is
 * unreachable in practice — it exists so the return type (and therefore the
 * Record lookups callers do with it) excludes "in_execution" without a cast.
 */
function messageKeyFor(applicationState: ApplicationState, coarseStage: CoarseStage | null): MessageKey {
  if (coarseStage) return coarseStage;
  if (applicationState === "in_execution") {
    throw new Error("invariant violated: in_execution application state without a coarseStage");
  }
  return applicationState;
}

type StatusMandate = {
  stage: MandateStage;
  dealStatus: DealStatus;
  ndaStatus: DocStatus;
  eaStatus: DocStatus;
  dealSize: unknown;
  currency: string;
  updatedAt: Date;
};
type StatusTransaction = { stage: TransactionStage; dealStatus: DealStatus; updatedAt: Date };

function pickMostAdvancedOpenTransaction<T extends StatusTransaction>(transactions: T[]): T | null {
  const openTransactions = transactions.filter(
    (t) => (TRANSACTION_PRECEDENCE as readonly TransactionStage[]).includes(t.stage) && t.dealStatus !== "Dropped",
  );
  return openTransactions.reduce<T | null>((best, t) => {
    if (!best) return t;
    return TRANSACTION_PRECEDENCE.indexOf(t.stage as (typeof TRANSACTION_PRECEDENCE)[number]) >
      TRANSACTION_PRECEDENCE.indexOf(best.stage as (typeof TRANSACTION_PRECEDENCE)[number])
      ? t
      : best;
  }, null);
}

function deriveApplicationState<T extends StatusTransaction>(
  mandate: StatusMandate | null,
  transactions: T[],
): { applicationState: ApplicationState; coarseStage: CoarseStage | null; transaction: T | null } {
  if (transactions.some((t) => t.stage === "ClosedWon")) {
    return { applicationState: "completed", coarseStage: null, transaction: null };
  }

  const mostAdvanced = pickMostAdvancedOpenTransaction(transactions);
  if (mostAdvanced) {
    return {
      applicationState: "in_execution",
      coarseStage: TRANSACTION_STAGE_TO_COARSE_STAGE[mostAdvanced.stage as (typeof TRANSACTION_PRECEDENCE)[number]],
      transaction: mostAdvanced,
    };
  }

  const hasClosedLostTransaction = transactions.some((t) => t.stage === "ClosedLost");
  const hasDroppedTransaction = transactions.some((t) => t.dealStatus === "Dropped");
  const mandateLostOrDropped =
    !!mandate && (mandate.stage === "Lost" || mandate.dealStatus === "Dropped" || mandate.dealStatus === "OnHold");
  if (hasClosedLostTransaction || hasDroppedTransaction || mandateLostOrDropped) {
    return { applicationState: "with_team", coarseStage: null, transaction: null };
  }

  if (!mandate || mandate.stage === "NewLead") {
    return { applicationState: "received", coarseStage: null, transaction: null };
  }
  if (mandate.stage === "Signed" || mandate.eaStatus === "Signed") {
    return { applicationState: "engaged", coarseStage: null, transaction: null };
  }
  // Qualification, PitchPresentation, Proposal, Negotiation
  return { applicationState: "under_review", coarseStage: null, transaction: null };
}

/**
 * Consumes a short-lived status token and returns the whitelisted status
 * payload (spec §5.3). Throws CrudError("Verification expired — please
 * verify again.") on any bad/expired/tampered token — the visitor-facing
 * flow restarts the OTP dance on this error.
 */
export async function getClientStatus(token: string): Promise<ClientStatusPayload> {
  const claims = await verifyStatusToken(token);
  if (!claims) throw new CrudError("Verification expired — please verify again.");

  const client = await prisma.client.findUnique({
    where: { id: claims.clientId },
    include: {
      mandates: { orderBy: { createdAt: "desc" }, take: 1 },
      transactions: true,
      documents: {
        where: {
          clientId: claims.clientId,
          type: { in: PREPARED_DOCUMENT_TYPES },
          status: { in: PREPARED_DOCUMENT_STATUSES },
        },
      },
    },
  });
  if (!client) throw new CrudError("Verification expired — please verify again.");

  const mandate = client.mandates[0] ?? null;
  const transactions = client.transactions;

  const { applicationState, coarseStage, transaction: mostAdvancedTransaction } = deriveApplicationState(
    mandate,
    transactions,
  );

  const messageKey = messageKeyFor(applicationState, coarseStage);

  const presentDocTypes = new Set(client.documents.map((d) => d.type));
  const preparedDocuments = PREPARED_DOCUMENT_LABELS.filter((d) => presentDocTypes.has(d.type)).map((d) => d.label);

  const submittedRaise =
    mandate && mandate.dealSize
      ? `${mandate.currency ?? "USD"} ${Number(mandate.dealSize).toLocaleString("en-US")}`
      : null;

  const lastUpdatedCandidates = [client.updatedAt, mandate?.updatedAt, mostAdvancedTransaction?.updatedAt].filter(
    (d): d is Date => d instanceof Date,
  );
  const lastUpdated = new Date(Math.max(...lastUpdatedCandidates.map((d) => d.getTime()))).toISOString();

  const payload: ClientStatusPayload = {
    companyName: client.name,
    applicationState,
    coarseStage,
    stageMessage: STAGE_MESSAGES[messageKey],
    ndaStatus: mandate ? DOC_STATUS_MAP[mandate.ndaStatus] : null,
    engagementAgreementStatus: mandate ? DOC_STATUS_MAP[mandate.eaStatus] : null,
    preparedDocuments,
    submittedRaise,
    nextStep: NEXT_STEPS[messageKey],
    lastUpdated,
  };

  // Tracked-workflow logging (scoping doc): best-effort, never sinks the answer.
  try {
    await prisma.activity.create({
      data: {
        type: "Note",
        subject: "Client checked status via web chat",
        channel: "WebChat",
        direction: "Inbound",
        clientId: client.id,
        createdSource: "AGENT",
      },
    });
  } catch (err) {
    console.error("getClientStatus: activity log failed", err);
  }

  return payload;
}
