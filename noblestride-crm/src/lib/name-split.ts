/**
 * Split a single free-text name into the first/last pair the Person model wants.
 *
 * The public intake form asks for one "contact person" field, and both submit
 * paths used to write the whole string into `Person.firstName` — so a contact
 * named "Solomon Oulula" had no surname anywhere in the CRM (F2.3).
 *
 * Splits on the FIRST whitespace run only: "Mary Jane Watson" keeps
 * "Jane Watson" together rather than guessing which part is a middle name.
 */
export function splitFullName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Contact", lastName: null };
  const [firstName, ...rest] = parts;
  return { firstName: firstName!, lastName: rest.length > 0 ? rest.join(" ") : null };
}
