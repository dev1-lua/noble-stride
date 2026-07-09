// Corporate-email gate for investor registration ("exclude use of Gmail or
// Yahoo emails" — Data-collected-from-potential-investors doc). Blocklist of
// well-known free providers; anything else with a plausible domain passes.

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com",
  "hotmail.com", "outlook.com", "live.com", "msn.com",
  "aol.com",
  "icloud.com", "me.com", "mac.com",
  "proton.me", "protonmail.com",
  "gmx.com", "gmx.net",
  "yandex.com", "yandex.ru",
  "mail.com", "zoho.com",
]);

/** Lower-cased domain part of an email, or null if the string isn't email-shaped. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.includes(".") ? domain : null;
}

/** True when `domain` is a known free/consumer provider. */
export function isFreeEmailDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain.toLowerCase());
}

/** True when the email has a domain that is not a known free provider. */
export function isCorporateEmail(email: string): boolean {
  const domain = emailDomain(email);
  return domain !== null && !isFreeEmailDomain(domain);
}
