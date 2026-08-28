// F3.2 (image7): "the investor should be able to open the Noblestride NDA and
// sign it, or upload their own for sign-off."
//
// The template is pure and versioned because a signed agreement has to stay
// reproducible: the stored envelope keeps templateVersion + the signature image,
// and the rendered document is regenerated from those. Changing the clauses
// without bumping the version would silently rewrite what people signed.

import { describe, it, expect } from "vitest";
import {
  renderStandardNda,
  isSignatureDataUrl,
  NDA_TEMPLATE_VERSION,
  NDA_CLAUSES,
  SIGNATURE_MAX_BYTES,
} from "../standard-nda";

describe("standard NDA template", () => {
  it("interpolates the fund and signer and carries the version", () => {
    const doc = renderStandardNda({
      investorName: "Fundxyz",
      signerName: "Test Investor",
      signedAt: new Date("2026-08-27T10:00:00Z"),
    });
    expect(doc.version).toBe(NDA_TEMPLATE_VERSION);
    expect(doc.preamble).toContain("Fundxyz");
    expect(doc.clauses).toHaveLength(NDA_CLAUSES.length);
    expect(doc.countersignature.org).toBe("Noblestride Capital Limited");
    expect(doc.title).toMatch(/2026/);
  });

  it("renders unsigned without a date", () => {
    const doc = renderStandardNda({ investorName: "F", signerName: "S", signedAt: null });
    expect(doc.title).not.toMatch(/\d{4}/);
  });

  it("covers the confidentiality ground SOW §06 requires", () => {
    const headings = NDA_CLAUSES.map((c) => c.heading.toLowerCase()).join(" | ");
    for (const topic of [
      "confidential information",
      "permitted use",
      "non-disclosure",
      "exclusions",
      "term",
      "return",
      "no licence",
      "governing law",
    ]) {
      expect(headings).toContain(topic);
    }
  });

  it("names Kenyan law, since that is where the engagement sits", () => {
    const law = NDA_CLAUSES.find((c) => c.heading.toLowerCase().includes("governing law"));
    expect(law?.body).toContain("Kenya");
  });

  it("accepts only bounded PNG data URLs", () => {
    expect(isSignatureDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isSignatureDataUrl("data:image/jpeg;base64,AAAA")).toBe(false);
    expect(isSignatureDataUrl("javascript:alert(1)")).toBe(false);
    expect(isSignatureDataUrl("data:image/png;base64,<svg onload=1>")).toBe(false);
    expect(isSignatureDataUrl("")).toBe(false);
    // A signature is a small image; anything this large is not one, and the
    // value goes into a text column.
    expect(isSignatureDataUrl("data:image/png;base64," + "A".repeat(SIGNATURE_MAX_BYTES + 1))).toBe(false);
  });
});
