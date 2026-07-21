import { describe, it, expect, vi } from "vitest";
import { handleDraftOutreach, resolveJobTransactionId, outreachJobName } from "../draft-outreach.webhook";

describe("handleDraftOutreach", () => {
  const runner = vi.fn(async () => ({ requested: 2, saved: 2, skipped: 0, fallbacks: 0 }));

  it("rejects a missing/wrong secret without doing work", async () => {
    const out = await handleDraftOutreach(
      { headers: { "x-webhook-secret": "wrong" }, body: { transactionId: "t1" } },
      "right-secret",
      runner,
    );
    expect(out).toEqual({ ok: false, error: "unauthorized" });
    expect(runner).not.toHaveBeenCalled();
  });
  it("rejects a missing transactionId", async () => {
    const out = await handleDraftOutreach(
      { headers: { "x-webhook-secret": "s" }, body: {} },
      "s",
      runner,
    );
    expect(out).toEqual({ ok: false, error: "transactionId required" });
  });
  it("runs the drafting on a valid call", async () => {
    const out = await handleDraftOutreach(
      { headers: { "x-webhook-secret": "s" }, body: { transactionId: "t1" } },
      "s",
      runner,
    );
    expect(out).toMatchObject({ ok: true, requested: 2, saved: 2 });
    expect(runner).toHaveBeenCalledWith("t1");
  });
});

describe("resolveJobTransactionId (deferred-job id propagation)", () => {
  // Regression for the outreach HTTP 400. Reads ONLY the `job` record the runner
  // passes to execute (closures do NOT survive Jobs.create's execute.toString()).
  const cuid = "clh3k9x2p0000abcd1234wxyz"; // cuid shape: lowercase alnum, no hyphens

  it("parses the id from job.name when metadata is empty (the real prod case)", () => {
    const name = outreachJobName(cuid, 1721560000000);
    expect(resolveJobTransactionId({ name, metadata: {} })).toBe(cuid);
    expect(resolveJobTransactionId({ name })).toBe(cuid);
  });
  it("prefers job.metadata.transactionId when the SDK does populate it", () => {
    expect(
      resolveJobTransactionId({ name: outreachJobName(cuid, 1721560000000), metadata: { transactionId: "meta-wins" } }),
    ).toBe("meta-wins");
    expect(resolveJobTransactionId({ metadata: { transactionId: cuid } })).toBe(cuid);
  });
  it("round-trips: the name we write parses back to the same id", () => {
    expect(resolveJobTransactionId({ name: outreachJobName(cuid, Date.now()) })).toBe(cuid);
  });
  it("parses the EXACT prod-mangled job name (Lua appends ' - <epoch>'; metadata arrives empty)", () => {
    // Verbatim from a real prod job log (v4): job.name is suffixed with " - <epoch>"
    // and job.metadata comes back as {} even though the version record held the id.
    const prodName = "draft-outreach-cmqqcrblu009z42ctzcaypsae-1784621119820 - 1784621119820";
    expect(resolveJobTransactionId({ name: prodName, metadata: {} })).toBe("cmqqcrblu009z42ctzcaypsae");
  });
  it("also tolerates a '_<epoch>' suffix (lua-cli local sandbox variant)", () => {
    const mangled = `${outreachJobName(cuid, 1721560000000)}_1721560001234`;
    expect(resolveJobTransactionId({ name: mangled, metadata: {} })).toBe(cuid);
  });
  it("throws a legible error when neither source carries the id", () => {
    expect(() => resolveJobTransactionId({ name: "unrelated-job-123", metadata: {} })).toThrow(/transactionId unavailable/);
    expect(() => resolveJobTransactionId({})).toThrow(/transactionId unavailable/);
    expect(() => resolveJobTransactionId(undefined)).toThrow(/transactionId unavailable/);
    expect(() => resolveJobTransactionId({ metadata: { transactionId: "  " } })).toThrow(/transactionId unavailable/);
  });
});
