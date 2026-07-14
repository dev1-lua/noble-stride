import { describe, it, expect, vi } from "vitest";
import { LogClientMessageTool } from "../LogClientMessageTool";
import { LOG_CLIENT_MESSAGE } from "../../../lib/queries";
import type { CrmClient } from "../../../lib/crm-client";

function crmStub(verified: boolean): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async () => ({ logInboundClientMessage: { ok: true, verified } })) as CrmClient["query"],
  };
}

describe("LogClientMessageTool", () => {
  it("relays the verified flag and nothing else", async () => {
    const crm = crmStub(true);
    const out = await new LogClientMessageTool({ crm }).execute({
      companyName: "Chai Estates",
      contactEmail: "jane@chai.example",
      messageSummary: "Wants an update on their raise.",
      requestType: "status_update",
    });
    expect(out).toEqual({ status: "ok", verified: true });
    const [doc, vars] = (crm.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doc).toBe(LOG_CLIENT_MESSAGE);
    expect(vars).toEqual({
      input: {
        companyName: "Chai Estates",
        contactEmail: "jane@chai.example",
        messageSummary: "Wants an update on their raise.",
        requestType: "status_update",
      },
    });
  });
  it("unverified passes through", async () => {
    const crm = crmStub(false);
    const out = await new LogClientMessageTool({ crm }).execute({
      companyName: "Chai Estates",
      contactEmail: "x@evil.example",
      messageSummary: "hello",
      requestType: "question",
    });
    expect(out).toEqual({ status: "ok", verified: false });
    const [doc, vars] = (crm.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doc).toBe(LOG_CLIENT_MESSAGE);
    expect(vars).toEqual({
      input: {
        companyName: "Chai Estates",
        contactEmail: "x@evil.example",
        messageSummary: "hello",
        requestType: "question",
      },
    });
  });
});
