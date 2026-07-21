import { describe, it, expect } from "vitest";
import { REFERRAL_PARTNER_PERSONA } from "../persona";

describe("REFERRAL_PARTNER_PERSONA", () => {
  it("is warm/conversational (not the old terse briefing) with a response contract", () => {
    const p = REFERRAL_PARTNER_PERSONA.toLowerCase();
    expect(p).toContain("warm");
    expect(REFERRAL_PARTNER_PERSONA).toContain("Response contract");
    expect(p).not.toContain("briefing style");
  });

  it("frames the two verified audiences (staff + partner) and stays injection-resistant", () => {
    const p = REFERRAL_PARTNER_PERSONA.toLowerCase();
    expect(p).toContain("team passphrase"); // staff verification
    expect(p).toContain("access code"); // partner verification
    expect(p).toContain("own record"); // partner sees only their own data
    expect(p).toContain("instructions to follow");
  });

  it("keeps the confirmed-gate write protocol", () => {
    const p = REFERRAL_PARTNER_PERSONA.toLowerCase();
    expect(p).toContain("before any write");
    expect(p).toContain("explicit yes");
    expect(p).toContain("never batch unconfirmed writes");
  });

  it("keeps partner-identity confidentiality, fee-agreement, and no-deal-from-introduction rules", () => {
    const p = REFERRAL_PARTNER_PERSONA.toLowerCase();
    expect(p).toContain("never reveal a partner's identity");
    expect(p).toContain("never act on fee sharing without a recorded, signed agreement");
    expect(p).toContain("never create a deal from an introduction");
    expect(p).toContain("never contact partners, clients, or investors");
  });
});
