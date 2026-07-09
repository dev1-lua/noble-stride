// Fixed allow-list of messages that may arrive on /register via ?error.
// Never render a reflected URL string — unknown slugs collapse to a single
// generic line (anti content-spoofing). Mirrors src/app/login/messages.ts.

const ERRORS: Record<string, string> = {
  "rate-limited": "Too many attempts — please try again later.",
  "free-provider": "Please use your official company email address — free providers (Gmail, Yahoo, …) are not accepted.",
  greylisted: "This email is not eligible to register. Contact NobleStride if you believe this is an error.",
  "invalid-email": "Enter a valid email address.",
};

const GENERIC = "Something went wrong. Please try again.";

export function registerError(slug: string | undefined): string | null {
  if (!slug) return null;
  return ERRORS[slug] ?? GENERIC;
}
