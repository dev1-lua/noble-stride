import { describe, it, expect } from "vitest";
import { reconcileDocDates, reconcileMandateDocDates } from "@/server/domain/doc-dates";

const NOW = new Date("2026-07-13T00:00:00.000Z");
const notSent = { status: "NotSent" as const, sentDate: null, signedDate: null };

describe("reconcileDocDates", () => {
  it("stamps signedDate when status is set to Signed and no prior date", () => {
    expect(reconcileDocDates({ status: "Signed" }, notSent, NOW)).toEqual({ signedDate: NOW });
  });

  it("keeps an existing signedDate when status stays Signed", () => {
    const prior = new Date("2026-01-01T00:00:00.000Z");
    const existing = { status: "Signed" as const, sentDate: null, signedDate: prior };
    expect(reconcileDocDates({ status: "Signed" }, existing, NOW)).toEqual({ signedDate: prior });
  });

  it("stamps sentDate and clears signedDate when set to Sent (downgrade)", () => {
    const existing = { status: "Signed" as const, sentDate: null, signedDate: new Date("2026-01-01") };
    expect(reconcileDocDates({ status: "Sent" }, existing, NOW)).toEqual({ sentDate: NOW, signedDate: null });
  });

  it("clears both dates when set to NotSent", () => {
    const existing = { status: "Signed" as const, sentDate: new Date("2026-01-01"), signedDate: new Date("2026-01-02") };
    expect(reconcileDocDates({ status: "NotSent" }, existing, NOW)).toEqual({ sentDate: null, signedDate: null });
  });

  it("returns an empty patch when no status is provided", () => {
    expect(reconcileDocDates({}, notSent, NOW)).toEqual({});
  });

  it("respects a manual date override over status-derived stamping", () => {
    const manual = new Date("2025-12-25T00:00:00.000Z");
    expect(reconcileDocDates({ status: "Signed", signedDate: manual }, notSent, NOW)).toEqual({ signedDate: manual });
  });

  it("respects an explicit null override", () => {
    const existing = { status: "Signed" as const, sentDate: null, signedDate: new Date("2026-01-01") };
    expect(reconcileDocDates({ status: "Signed", signedDate: null }, existing, NOW)).toEqual({ signedDate: null });
  });
});

describe("reconcileMandateDocDates", () => {
  it("stamps only the NDA signed date when NDA status becomes Signed", () => {
    const existing = {
      ndaStatus: "NotSent" as const, ndaSentDate: null, ndaSignedDate: null,
      eaStatus: "NotSent" as const, eaSentDate: null, eaSignedDate: null,
    };
    expect(reconcileMandateDocDates({ ndaStatus: "Signed" }, existing, NOW)).toEqual({ ndaSignedDate: NOW });
  });

  it("returns an empty patch when neither status changes", () => {
    const existing = {
      ndaStatus: "Signed" as const, ndaSentDate: null, ndaSignedDate: new Date("2026-01-01"),
      eaStatus: "NotSent" as const, eaSentDate: null, eaSignedDate: null,
    };
    expect(reconcileMandateDocDates({ notes: "x" } as never, existing, NOW)).toEqual({});
  });
});
