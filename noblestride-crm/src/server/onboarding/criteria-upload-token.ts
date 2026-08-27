// The registration → criteria-upload hand-off (F3.1 / image5, image6:
// "investors should be able to upload their investment criteria at onboarding,
// and we should see it in the review queue").
//
// The problem this solves: at the moment the wizard finishes, the fund has an
// account but it is PENDING approval, so there is no session to authorise an
// upload with. Rather than let anyone POST a file against any investor id, the
// wizard mints a short-lived, purpose-scoped token naming exactly one investor,
// and the upload route accepts nothing else.
//
// Same shape as src/server/services/client-status.ts, which does this for the
// public status check.

import { SignJWT, jwtVerify } from "jose";

export const REG_UPLOAD_COOKIE = "reg_upload";
export const REG_UPLOAD_TTL_S = 900; // 15 minutes
const REG_UPLOAD_PURPOSE = "criteria-upload";

export const CRITERIA_MAX_BYTES = 15 * 1024 * 1024;
export const CRITERIA_MIMES: readonly string[] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function issueCriteriaUploadToken(investorId: string): Promise<string> {
  return new SignJWT({ investorId, purpose: REG_UPLOAD_PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REG_UPLOAD_TTL_S}s`)
    .sign(secret());
}

export async function verifyCriteriaUploadToken(token: string): Promise<{ investorId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    // The purpose claim matters: several flows sign with this secret, and none
    // of their tokens may authorise a file write.
    if (payload.purpose !== REG_UPLOAD_PURPOSE) return null;
    if (typeof payload.investorId !== "string" || !payload.investorId) return null;
    return { investorId: payload.investorId };
  } catch {
    return null;
  }
}
