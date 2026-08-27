import { describe, it, expect } from "vitest";
import { toDealKindEnum, fromDealKindEnum, dealHref } from "../deal-kind";

describe("toDealKindEnum", () => {
  it("maps the lowercase deals-queue union to the Prisma-shaped enum", () => {
    expect(toDealKindEnum("mandate")).toBe("Mandate");
    expect(toDealKindEnum("transaction")).toBe("Transaction");
    expect(toDealKindEnum("advisory")).toBe("Advisory");
  });
});

describe("fromDealKindEnum", () => {
  it("maps the Prisma-shaped enum back to the lowercase union", () => {
    expect(fromDealKindEnum("Mandate")).toBe("mandate");
    expect(fromDealKindEnum("Transaction")).toBe("transaction");
    expect(fromDealKindEnum("Advisory")).toBe("advisory");
  });
});

describe("dealHref", () => {
  it("builds the entity-detail path for each deal kind", () => {
    expect(dealHref("Mandate", "m1")).toBe("/mandates/m1");
    expect(dealHref("Transaction", "t1")).toBe("/transactions/t1");
    expect(dealHref("Advisory", "a1")).toBe("/advisory/a1");
  });
});
