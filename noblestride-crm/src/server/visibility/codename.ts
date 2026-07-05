// codename.ts — deterministic pre-NDA teaser codenames ("Project Amber Falcon").
// Company identity is masked at PRE_INTEREST and unmasks after NDA (design
// spec §5; flagged for client confirmation in memory/client-meeting-questions.md).

const ADJECTIVES = [
  "Amber", "Cobalt", "Crimson", "Golden", "Indigo", "Ivory",
  "Jade", "Onyx", "Opal", "Scarlet", "Silver", "Umber",
] as const;

const NOUNS = [
  "Acacia", "Baobab", "Falcon", "Harrier", "Ibis", "Kudu",
  "Marula", "Meridian", "Nile", "Oryx", "Sable", "Savanna",
] as const;

/** Stable, non-identifying codename derived from the deal id. */
export function dealCodename(dealId: string): string {
  let h = 0;
  for (let i = 0; i < dealId.length; i++) h = (h * 31 + dealId.charCodeAt(i)) >>> 0;
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[(h >>> 8) % NOUNS.length];
  return `Project ${adj} ${noun}`;
}
