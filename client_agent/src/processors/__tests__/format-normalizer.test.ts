import { describe, it, expect } from "vitest";
import { normalizeFormatting } from "../format-normalizer";

describe("normalizeFormatting", () => {
  it("replaces an em-dash clause separator with a comma", () => {
    expect(normalizeFormatting("New Lead has 39 deals — a heavy top of funnel.")).toBe(
      "New Lead has 39 deals, a heavy top of funnel.",
    );
  });

  it("turns a numeric en-dash range into 'to'", () => {
    expect(normalizeFormatting("Ticket appetite 5–25M in US dollars.")).toBe(
      "Ticket appetite 5 to 25M in US dollars.",
    );
    expect(normalizeFormatting("2–8M ticket range")).toBe("2 to 8M ticket range");
  });

  it("converts a line-leading dash bullet to a markdown hyphen bullet", () => {
    expect(normalizeFormatting("Summary:\n— first\n— second")).toBe("Summary:\n- first\n- second");
  });

  it("never alters ASCII hyphens in names, code names, or URLs", () => {
    const s = "Sub-Saharan focus for M-Kopa, see /investors/abc-123-def for detail.";
    expect(normalizeFormatting(s)).toBe(s);
  });

  it("preserves newlines and paragraph structure", () => {
    const s = "Line one.\n\nLine two.";
    expect(normalizeFormatting(s)).toBe(s);
  });

  it("collapses doubled-comma artifacts from adjacent dashes", () => {
    expect(normalizeFormatting("A, — B")).toBe("A, B");
  });

  it("is idempotent", () => {
    const once = normalizeFormatting("Focus — Technology and Financial Services — Pan-Africa; 5–25M.");
    expect(normalizeFormatting(once)).toBe(once);
    expect(once).not.toMatch(/[‒–—―]/);
  });

  it("handles empty input", () => {
    expect(normalizeFormatting("")).toBe("");
  });

  // --- Regression cases from the Task-1 review (dash-free fast path + artifact scoping) ---

  it("leaves a dash-free reply byte-for-byte unchanged (nested lists, code, clean punctuation)", () => {
    const s = "Steps:\n- Group A\n  - Sub 1\n\n    git log\n\nWe use C#, .NET and Java. Thanks :)";
    expect(normalizeFormatting(s)).toBe(s);
  });

  it("preserves nested-list indentation even when a dash appears elsewhere", () => {
    expect(normalizeFormatting("Note — see below:\n- Group A\n  - Sub 1")).toBe(
      "Note, see below:\n- Group A\n  - Sub 1",
    );
  });

  it("does not merge a following bullet line into the sentence (dash at line end)", () => {
    expect(normalizeFormatting("Here is the breakdown —\n- item one")).toBe(
      "Here is the breakdown,\n- item one",
    );
  });

  it("preserves clean punctuation like .NET and :) when a dash is present", () => {
    expect(normalizeFormatting("We use C#, .NET — mostly. Thanks :)")).toBe("We use C#, .NET, mostly. Thanks :)");
  });

  it("collapses a run of dashes without leaving doubled commas, and stays idempotent", () => {
    const once = normalizeFormatting("a ——— b");
    expect(once).toBe("a, b");
    expect(normalizeFormatting(once)).toBe(once);
  });

  it("drops a divider line that is only dashes", () => {
    expect(normalizeFormatting("Above.\n—\nBelow.")).toBe("Above.\n\nBelow.");
  });

  it("trims a single dangling comma left by a trailing dash", () => {
    expect(normalizeFormatting("more details —")).toBe("more details");
  });
});
