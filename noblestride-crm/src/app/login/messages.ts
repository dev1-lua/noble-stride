// Fixed allow-list of messages that may arrive on /login via ?error / ?notice
// (2FA bounce, password-reset success, account-created). Never render a
// reflected URL string — unknown slugs collapse to a single generic line
// (anti content-spoofing).

const NOTICES: Record<string, string> = {
  "password-updated": "Password updated — sign in with your new password.",
  "session-expired": "Your sign-in session expired. Please sign in again.",
  "code-expired": "Your code expired. Please sign in again to get a new one.",
  "too-many-codes": "Too many incorrect codes. Please sign in again to get a new code.",
  locked: "Too many attempts. Please try again in a little while.",
  suspended: "This account is suspended. Contact Noblestride if you believe this is an error.",
  "account-created": "Account created — sign in.",
  "invite-complete": "Your access is set up — sign in with your email and new password.",
};

const GENERIC = "Please sign in to continue.";

export function loginNotice(slug: string | undefined): string | null {
  if (!slug) return null;
  return NOTICES[slug] ?? GENERIC;
}
