// Regression guard: Zod strips undeclared keys before every Prisma write, so a
// field missing from these schemas is silently dropped. These tests pin the
// §3.1 / §3.2 / §6.2 fields into the create schemas.
import { describe, expect, it } from "vitest";
import { clientCreateSchema } from "@/lib/schemas/client";
import { transactionCreateSchema } from "@/lib/schemas/transaction";
import { ddTrackUpsertSchema } from "@/lib/schemas/due-diligence";

describe("client schema — §3.1 fields survive parsing", () => {
  it("keeps codename, financials and impact flags", () => {
    const parsed = clientCreateSchema.parse({
      name: "Acme",
      codename: "Project Baobab",
      ebitda: 1_200_000,
      existingDebt: 500_000,
      totalAssets: 4_000_000,
      impactFlags: ["WomenLed"],
    });
    expect(parsed.codename).toBe("Project Baobab");
    expect(parsed.ebitda).toBe(1_200_000);
    expect(parsed.existingDebt).toBe(500_000);
    expect(parsed.totalAssets).toBe(4_000_000);
    expect(parsed.impactFlags).toEqual(["WomenLed"]);
  });

  it("allows negative EBITDA but not negative debt/assets", () => {
    expect(clientCreateSchema.parse({ name: "A", ebitda: -50_000 }).ebitda).toBe(-50_000);
    expect(() => clientCreateSchema.parse({ name: "A", existingDebt: -1 })).toThrow();
    expect(() => clientCreateSchema.parse({ name: "A", totalAssets: -1 })).toThrow();
  });
});

describe("transaction schema — §3.2 IC/CAK fields survive parsing", () => {
  it("keeps IC dates and CAK/COMESA fields", () => {
    const parsed = transactionCreateSchema.parse({
      name: "Deal",
      clientId: "c1",
      icFirstApprovalDate: "2026-01-15",
      icSecondApprovalDate: "2026-03-01",
      cakComesaStatus: "Filed",
      cakComesaFiledDate: "2026-04-01",
      cakComesaApprovedDate: "2026-05-01",
    });
    expect(parsed.icFirstApprovalDate).toBeInstanceOf(Date);
    expect(parsed.icSecondApprovalDate).toBeInstanceOf(Date);
    expect(parsed.cakComesaStatus).toBe("Filed");
    expect(parsed.cakComesaFiledDate).toBeInstanceOf(Date);
    expect(parsed.cakComesaApprovedDate).toBeInstanceOf(Date);
  });

  it("rejects an unknown regulatory status", () => {
    expect(() =>
      transactionCreateSchema.parse({ name: "Deal", clientId: "c1", cakComesaStatus: "Pending" }),
    ).toThrow();
  });
});

describe("dd track schema", () => {
  it("requires transactionId + track", () => {
    const parsed = ddTrackUpsertSchema.parse({
      transactionId: "t1",
      track: "Financial",
      status: "InProgress",
    });
    expect(parsed.track).toBe("Financial");
    expect(parsed.status).toBe("InProgress");
    expect(() => ddTrackUpsertSchema.parse({ track: "Financial" })).toThrow();
    expect(() => ddTrackUpsertSchema.parse({ transactionId: "t1", track: "Forensic" })).toThrow();
  });
});
