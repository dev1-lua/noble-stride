// Fixed allow-list of everything /apply/status may say (F2.4 / §2b G1).
//
// The page is public and anonymous. Two rules follow from that and are pinned by
// the tests next door: an unknown ?notice/?error slug collapses to one generic
// line rather than being rendered (anti content-spoofing), and no message
// mentions an email address — the copy must never confirm who was looked up or
// whether an application exists.
//
// Mirrors src/app/login/messages.ts.

export const APPLY_STATUS_NOTICES: Record<string, string> = {
  "code-sent":
    "If we have an application for that email, a 6-digit code is on its way. It expires in 10 minutes.",
  "signed-out": "You've been signed out of application tracking.",
  "upload-ok": "Document received — the Noblestride team will review it.",
};

export const APPLY_STATUS_ERRORS: Record<string, string> = {
  "code-invalid": "That code didn't match, or it has expired. Request a new one.",
  "rate-limited": "Too many attempts — please try again in a little while.",
  "session-expired": "Your tracking session expired. Enter your email to get a new code.",
  "upload-too-large": "That file is too large. The limit is 15 MB.",
  "upload-type": "Please upload a PDF, Word or Excel file.",
  "upload-failed": "We couldn't save that file. Please try again.",
};

const GENERIC_NOTICE = "Enter the email you applied with to see your application.";
const GENERIC_ERROR = "Something went wrong. Please try again.";

export function applyStatusNotice(slug: string | undefined): string | null {
  if (!slug) return null;
  return APPLY_STATUS_NOTICES[slug] ?? GENERIC_NOTICE;
}

export function applyStatusError(slug: string | undefined): string | null {
  if (!slug) return null;
  return APPLY_STATUS_ERRORS[slug] ?? GENERIC_ERROR;
}
