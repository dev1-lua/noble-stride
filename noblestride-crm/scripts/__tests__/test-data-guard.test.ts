import { describe, expect, it } from "vitest";
import {
  buildProtectedSets,
  isProtected,
  isProtectedDomainEmail,
  normalizeEmail,
  normalizeMandateName,
  normalizeName,
  partitionRows,
  assertNoneProtected,
  ProtectedDataError,
  PROTECTED_EMAIL_DOMAIN,
  type RealData,
} from "../lib/test-data-guard";

// Fixture mirroring prisma/real-data.json's shape (mandates[].clientName,
// investors[].{name,contacts[].{firstName,lastName,email}},
// serviceProviders[].{name,email,contactPerson}, partners[].name).
const realData: RealData = {
  mandates: [
    { clientName: "Acme Ltd" },
    { clientName: "KK Fresh products exporters" },
  ],
  tasks: [],
  investors: [
    {
      name: "Gulf Capital",
      contacts: [
        { firstName: "Fidaa", lastName: "Haddad", email: "fhaddad@gulfcapital.com" },
        { firstName: "No", lastName: "Email", email: null },
      ],
    },
  ],
  serviceProviders: [
    { name: "Anjarwalla & Khanna", email: "aanjarwalla@ach-legal.com", contactPerson: "Atiq Anjarwalla" },
  ],
  partners: [{ name: "Dominique Kavuisya" }],
};

const sets = buildProtectedSets(realData);

describe("normalizeName / normalizeEmail", () => {
  it("trims, lowercases, and collapses internal whitespace", () => {
    expect(normalizeName("  Gulf   Capital  ")).toBe("gulf capital");
    expect(normalizeName("GULF CAPITAL")).toBe("gulf capital");
  });

  it("lowercases emails", () => {
    expect(normalizeEmail(" FHaddad@GulfCapital.com ")).toBe("fhaddad@gulfcapital.com");
  });
});

describe("isProtectedDomainEmail", () => {
  it("protects the exact noblestride.capital domain", () => {
    expect(isProtectedDomainEmail("evans@noblestride.capital")).toBe(true);
    expect(isProtectedDomainEmail("Solomon@NobleStride.Capital")).toBe(true);
  });

  it("does NOT protect a subdomain of noblestride.capital", () => {
    expect(isProtectedDomainEmail("user@mail.noblestride.capital")).toBe(false);
  });

  it("does not protect unrelated domains", () => {
    expect(isProtectedDomainEmail("test@gmail.com")).toBe(false);
  });

  it("exposes the domain constant used by the rule", () => {
    expect(PROTECTED_EMAIL_DOMAIN).toBe("noblestride.capital");
  });
});

describe("investor classification (brief case a/b)", () => {
  it("(a) a protected investor name is never a candidate, case/whitespace-insensitive", () => {
    expect(isProtected("investor", { name: "  GULF   CAPITAL " }, sets)).toBe(true);
    const { candidates, protected: kept } = partitionRows(
      "investor",
      [{ name: "Gulf Capital" }, { name: "  gulf capital  " }],
      sets
    );
    expect(candidates).toHaveLength(0);
    expect(kept).toHaveLength(2);
  });

  it("(b) an unknown investor name is a candidate", () => {
    expect(isProtected("investor", { name: "Meridian Frontier Capital" }, sets)).toBe(false);
    const { candidates } = partitionRows(
      "investor",
      [{ name: "Meridian Frontier Capital" }],
      sets
    );
    expect(candidates).toHaveLength(1);
  });
});

describe("user classification (brief case c)", () => {
  it("(c) an @noblestride.capital user is protected, an unrelated email is a candidate", () => {
    expect(isProtected("user", { email: "evans@noblestride.capital" }, sets)).toBe(true);
    expect(isProtected("user", { email: "test@gmail.com" }, sets)).toBe(false);
  });
});

describe("contact/person email classification (brief case d)", () => {
  it("(d) a contact email from realData.investors[].contacts is protected", () => {
    expect(
      isProtected("person", { firstName: "Fidaa", lastName: "Haddad", email: "FHaddad@GulfCapital.com" }, sets)
    ).toBe(true);
  });

  it("protects a name-only contact (no email in the tracker) by normalized name", () => {
    expect(isProtected("person", { firstName: "No", lastName: "Email" }, sets)).toBe(true);
    expect(isProtected("person", { firstName: "Someone", lastName: "Else" }, sets)).toBe(false);
  });
});

describe("mandate classification (brief case e + en-dash/hyphen)", () => {
  it('(e) "Acme Ltd – Advisory Mandate" is protected when clientName "Acme Ltd" is real', () => {
    expect(
      isProtected("mandate", { name: "Acme Ltd – Advisory Mandate", clientName: "Acme Ltd" }, sets)
    ).toBe(true);
  });

  it("treats the EN DASH (U+2013) and a plain hyphen as equivalent in the mandate name pattern", () => {
    expect(normalizeMandateName("Acme Ltd – Advisory Mandate")).toBe(
      normalizeMandateName("Acme Ltd - Advisory Mandate")
    );
    expect(
      isProtected("mandate", { name: "Acme Ltd - Advisory Mandate", clientName: null }, sets)
    ).toBe(true);
  });

  it("protects a mandate via its client's name even if the mandate's own name string doesn't match the pattern", () => {
    expect(
      isProtected("mandate", { name: "Some renamed deal", clientName: "Acme Ltd" }, sets)
    ).toBe(true);
  });

  it("an unrelated mandate is a candidate", () => {
    expect(
      isProtected("mandate", { name: "Test Co – Advisory Mandate", clientName: "Test Co" }, sets)
    ).toBe(false);
  });
});

describe("serviceProvider classification", () => {
  it("protects by name and independently by email", () => {
    expect(isProtected("serviceProvider", { name: "Anjarwalla & Khanna" }, sets)).toBe(true);
    expect(
      isProtected("serviceProvider", { name: "Renamed Firm", email: "aanjarwalla@ach-legal.com" }, sets)
    ).toBe(true);
    expect(isProtected("serviceProvider", { name: "Some Test Firm" }, sets)).toBe(false);
  });
});

describe("partner classification", () => {
  it("protects a real partner name, normalized", () => {
    expect(isProtected("partner", { name: "dominique   kavuisya" }, sets)).toBe(true);
    expect(isProtected("partner", { name: "Made Up Partner" }, sets)).toBe(false);
  });
});

describe("assertNoneProtected (brief case f)", () => {
  it("(f) throws ProtectedDataError when a protected row sneaks into a candidate list", () => {
    expect(() =>
      assertNoneProtected("investor", [{ name: "Meridian Frontier Capital" }, { name: "Gulf Capital" }], sets)
    ).toThrow(ProtectedDataError);
  });

  it("does not throw when every row is a legitimate candidate", () => {
    expect(() =>
      assertNoneProtected("investor", [{ name: "Meridian Frontier Capital" }], sets)
    ).not.toThrow();
  });

  it("reports the offending rows on the thrown error", () => {
    try {
      assertNoneProtected("client", [{ name: "Acme Ltd" }], sets);
      throw new Error("expected assertNoneProtected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ProtectedDataError);
      expect((err as ProtectedDataError).kind).toBe("client");
      expect((err as ProtectedDataError).offendingRows).toHaveLength(1);
    }
  });
});
