import { PostProcessor } from "lua-cli";

// Deterministic outbound formatting normalizer (2026-07-22).
//
// Persona rules about punctuation are advisory and unreliable (the investor
// sign-off rule was honored in 0/14 organic replies), so em/en-dash removal is
// enforced HERE where it cannot be dropped by the model. It only touches the
// "typographic" dashes (figure dash, en dash, em dash, horizontal bar). ASCII
// hyphens in names, code names, and URLs (Sub-Saharan, M-Kopa,
// /investors/abc-123) are never altered, and a reply that contains NO
// typographic dash is returned byte-for-byte unchanged (fast path) so normal
// prose, markdown indentation, and code blocks are never disturbed.
const TYPO_DASH = "‒–—―"; // figure, en, em, horizontal bar
const TYPO_DASH_RE = /[‒–—―]/;

/** Pure and idempotent: strips typographic dashes and tidies only the artifacts that produces. */
export function normalizeFormatting(text: string): string {
  // Fast path: dash-free replies (the majority) are left exactly as written.
  if (!text || !TYPO_DASH_RE.test(text)) return text;

  let out = text;

  // 0. A line that is ONLY typographic dashes (a divider rule) -> drop it.
  out = out.replace(new RegExp(`^[ \\t]*[${TYPO_DASH}]+[ \\t]*$`, "gm"), "");

  // 1. A typographic dash starting a line (a bullet marker) -> markdown hyphen
  //    bullet. Flanks are [ \t] only, so it never swallows the previous newline.
  out = out.replace(new RegExp(`^([ \\t]*)[${TYPO_DASH}][ \\t]+`, "gm"), "$1- ");

  // 2. A dash between two numbers is a range -> "to" ("5–25M" -> "5 to 25M").
  out = out.replace(new RegExp(`(\\d)[ \\t]*[${TYPO_DASH}][ \\t]*(\\d)`, "g"), "$1 to $2");

  // 3. Any remaining typographic dash (a clause separator) -> comma. Flanks are
  //    [ \t] only, so a line-ending dash becomes ",\n" and never merges lines.
  out = out.replace(new RegExp(`[ \\t]*[${TYPO_DASH}][ \\t]*`, "g"), ", ");

  // 4. Tidy ONLY the artifacts the substitutions above can create. Leading
  //    indentation and clean punctuation elsewhere are deliberately left alone.
  out = out
    .replace(/,(?:[ \t]*,)+/g, ",") // collapse comma runs (idempotent)
    .replace(/[ \t]+,/g, ",") // a space we left before a comma
    .replace(/,[ \t]*([)\]])/g, "$1") // comma glued before a closer, e.g. "(text —)" -> "(text)"
    .replace(/([([])[ \t]*,[ \t]*/g, "$1") // "(, " -> "("
    .replace(/[ \t]+$/gm, "") // trailing spaces (e.g. from "word — ")
    .replace(/(?<=\S)[ \t]{2,}/g, " ") // collapse intra-line runs, keep leading indentation
    .replace(/,\s*$/, ""); // a single dangling comma at the very end of the reply

  return out;
}

export const formatNormalizer = new PostProcessor({
  name: "format-normalizer",
  description:
    "Deterministically removes typographic em/en-dashes from every outbound reply (persona punctuation rules are advisory only): ranges become 'to', clause-separators become commas. Never alters ASCII hyphens in names, code names, or URLs, and leaves dash-free replies unchanged.",
  priority: 200, // run LAST, after any sign-off / leak guard has finalized the text
  execute: async (_user, _message, response, _channel) => {
    return { modifiedResponse: normalizeFormatting(response) };
  },
});

export default formatNormalizer;
