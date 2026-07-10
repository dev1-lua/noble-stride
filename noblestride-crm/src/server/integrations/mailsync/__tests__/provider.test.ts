import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMailSyncProvider } from "../provider";

let saved: string | undefined;
beforeEach(() => { saved = process.env.OUTLOOK_ENABLED; delete process.env.OUTLOOK_ENABLED; });
afterEach(() => { if (saved === undefined) delete process.env.OUTLOOK_ENABLED; else process.env.OUTLOOK_ENABLED = saved; });

describe("getMailSyncProvider", () => {
  it("returns the off provider when Outlook is unconfigured; listing yields nothing", async () => {
    expect(await getMailSyncProvider().listMessages("a@x.com")).toEqual([]);
  });
});
