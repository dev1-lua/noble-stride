import { describe, it, expect } from "vitest";
import { REFERRAL_PARTNER_PERSONA } from "../persona";

describe("REFERRAL_PARTNER_PERSONA", () => {
  it("is warm/conversational (not the old terse briefing) with a response contract", () => {
    const p = REFERRAL_PARTNER_PERSONA.toLowerCase();
    expect(p).toContain("warm");
    expect(REFERRAL_PARTNER_PERSONA).toContain("Response contract");
    expect(p).not.toContain("briefing style");
  });

  // F5.6 / image23: the client asked us to drop partner usage from this agent.
  // It is now staff-only, and it must say where a partner should actually go.
  it("is staff only, and sends partners to the portal", () => {
    const p = REFERRAL_PARTNER_PERSONA.toLowerCase();
    expect(p).toContain("team passphrase"); // staff verification
    expect(p).toContain("staff only");
    expect(p).toContain("partner portal");
    expect(p).toContain("do not use this assistant");
    expect(p).toContain("instructions to follow");
  });

  it("no longer advertises partner self service", () => {
    const p = REFERRAL_PARTNER_PERSONA.toLowerCase();
    expect(p).not.toContain("two audiences");
    expect(p).not.toContain("self-service desk");
    // The one surviving mention of an access code says there is no longer one
    // to issue, which is the fact staff need rather than an offer.
    expect(p).toContain("no access code to issue");
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
