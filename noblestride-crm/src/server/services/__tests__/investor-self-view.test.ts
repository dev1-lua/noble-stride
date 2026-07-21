import { describe, it, expect, vi, beforeEach } from "vitest";

// investorSelfView reads only prisma.person.findFirst; mock the DB so the whitelist
// projection + tier guard can be asserted without Postgres.
const { findFirstMock } = vi.hoisted(() => ({ findFirstMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { person: { findFirst: findFirstMock } } }));

import { investorSelfView } from "../investor-agent";

const APPROVED_INVESTOR = {
  id: "clxinvestorcuid0000000000abcd",
  name: "Vantage Capital",
  status: "ActivelyDeploying",
  onboardingStatus: "Approved",
  engagementClassification: "Active",
  sectorFocus: ["Fintech", "Healthcare"],
  geographicFocus: ["SubSaharanAfrica"],
  instruments: ["Equity"],
  investmentStages: ["Growth"],
  aum: 500_000_000,
  ticketMin: 2_000_000,
  ticketMax: 8_000_000,
  currency: "USD",
  targetIrr: 20,
  countryRestrictions: "No Sudan",
  esgFocus: "Gender-lens",
  investmentMandate: "SSA growth equity",
  notes: "INTERNAL — do not share",
  nextActionDate: new Date("2026-02-01T00:00:00Z"),
  criteriaVerifiedAt: new Date("2026-01-01T00:00:00Z"),
};

beforeEach(() => findFirstMock.mockReset());

describe("investorSelfView", () => {
  it("returns the investor's own whitelisted profile — no record id, no internal fields, symbol-free band", async () => {
    findFirstMock.mockResolvedValue({ investor: APPROVED_INVESTOR });
    const out = await investorSelfView("ceo@vantage.com");

    expect(out.matched).toBe(true);
    expect(out.investorName).toBe("Vantage Capital");
    expect(out.sectorFocus).toEqual(["Fintech", "Healthcare"]);
    expect(out.onboardingStatus).toBe("Approved");
    expect(out.targetIrr).toBe(20);

    // Ticket is a band, symbol-free (the outbound leak scanner vetoes "$"/currency figures);
    // a min/max straddling two buckets collapses to outer edges.
    expect(out.ticketBand).toBe("1M–10M");
    expect(out.ticketBand).not.toContain("$");

    const serialized = JSON.stringify(out);
    // No cuid / record id leaks into the payload.
    expect(serialized).not.toContain(APPROVED_INVESTOR.id);
    expect(serialized).not.toMatch(/\bc[a-z0-9]{24,}\b/);
    // Internal-only fields are excluded by construction.
    expect(out).not.toHaveProperty("aum");
    expect(out).not.toHaveProperty("notes");
    expect(out).not.toHaveProperty("nextActionDate");
    expect(out).not.toHaveProperty("engagementClassification");
    // No raw ticket numbers.
    expect(serialized).not.toContain("2000000");
    expect(serialized).not.toContain("8000000");
  });

  it("qualifies a single-bound ticket appetite", async () => {
    findFirstMock.mockResolvedValue({ investor: { ...APPROVED_INVESTOR, ticketMin: 5_000_000, ticketMax: null } });
    expect((await investorSelfView("ceo@vantage.com")).ticketBand).toBe("at least 5M");

    findFirstMock.mockResolvedValue({ investor: { ...APPROVED_INVESTOR, ticketMin: null, ticketMax: 8_000_000 } });
    expect((await investorSelfView("ceo@vantage.com")).ticketBand).toBe("up to 10M");
  });

  it("treats a NONE-tier (excluded) investor as unmatched", async () => {
    findFirstMock.mockResolvedValue({
      investor: { ...APPROVED_INVESTOR, engagementClassification: "Excluded" },
    });
    const out = await investorSelfView("ceo@vantage.com");
    expect(out.matched).toBe(false);
    expect(out.investorName).toBeUndefined();
  });

  it("treats an unapproved-onboarding investor as unmatched", async () => {
    findFirstMock.mockResolvedValue({
      investor: { ...APPROVED_INVESTOR, onboardingStatus: "PendingReview" },
    });
    expect((await investorSelfView("ceo@vantage.com")).matched).toBe(false);
  });

  it("returns unmatched when no investor contact matches the email", async () => {
    findFirstMock.mockResolvedValue(null);
    expect((await investorSelfView("nobody@nowhere.com")).matched).toBe(false);
  });

  it("returns unmatched for a blank email without touching the DB", async () => {
    const out = await investorSelfView("   ");
    expect(out.matched).toBe(false);
    expect(findFirstMock).not.toHaveBeenCalled();
  });
});
