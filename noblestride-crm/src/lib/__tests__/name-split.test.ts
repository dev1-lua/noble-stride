// F2.3: intake stores the applicant's whole name in Person.firstName, so
// "Solomon Oulula" showed up as a first name with no surname anywhere in the
// CRM. This splits it on write.

import { describe, it, expect } from "vitest";
import { splitFullName } from "../name-split";

describe("splitFullName", () => {
  it("splits on the first whitespace run", () => {
    expect(splitFullName("Solomon Oulula")).toEqual({ firstName: "Solomon", lastName: "Oulula" });
    expect(splitFullName("Mary Jane  Watson")).toEqual({ firstName: "Mary", lastName: "Jane Watson" });
  });

  it("keeps a single token as the first name", () => {
    expect(splitFullName("Solomon")).toEqual({ firstName: "Solomon", lastName: null });
  });

  it("trims surrounding whitespace", () => {
    expect(splitFullName("  Ada  Lovelace  ")).toEqual({ firstName: "Ada", lastName: "Lovelace" });
  });

  it("falls back for blank input rather than writing an empty required field", () => {
    expect(splitFullName("   ")).toEqual({ firstName: "Contact", lastName: null });
    expect(splitFullName("")).toEqual({ firstName: "Contact", lastName: null });
  });
});
