import { describe, it, expect, vi } from "vitest";
import { handleDraftOutreach } from "../draft-outreach.webhook";

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
