import { describe, it, expect, vi } from "vitest";
import { LookupRecordTool } from "../LookupRecordTool";
import { ProposeChangeTool } from "../ProposeChangeTool";
import { CommitChangeTool } from "../CommitChangeTool";
import { CancelChangeTool } from "../CancelChangeTool";
import { CrmError, type CrmClient } from "../../../lib/crm-client";

const HIT = { id: "c1", type: "Client", title: "Acme Ltd", subtitle: null, href: "/clients/c1" };

function searchCrm(searchResults: unknown[]): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("globalSearch")) return { globalSearch: searchResults };
      throw new Error(`unexpected document: ${document}`);
    }) as CrmClient["query"],
  };
}

function writeCrm(handlers: {
  prepare?: () => unknown;
  commit?: () => unknown;
  cancel?: () => unknown;
}): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("AgentPrepareWrite")) {
        if (!handlers.prepare) throw new Error("prepare not stubbed");
        return { agentPrepareWrite: handlers.prepare() };
      }
      if (document.includes("AgentCommitWrite")) {
        if (!handlers.commit) throw new Error("commit not stubbed");
        return { agentCommitWrite: handlers.commit() };
      }
      if (document.includes("AgentCancelWrite")) {
        if (!handlers.cancel) throw new Error("cancel not stubbed");
        return { agentCancelWrite: handlers.cancel() };
      }
      throw new Error(`unexpected document: ${document}`);
    }) as CrmClient["query"],
  };
}

const identified = () => Promise.resolve({ staffEmail: "amara@noblestride.com" });
const notIdentified = () => Promise.resolve(undefined);

describe("LookupRecordTool", () => {
  it("returns match for a uniquely-resolved record", async () => {
    const tool = new LookupRecordTool({ crm: searchCrm([HIT]) });
    const out = await tool.execute({ recordType: "client", query: "acme ltd" });
    expect(out).toEqual({ status: "match", id: "c1", title: "Acme Ltd" });
  });

  it("returns ambiguous candidates", async () => {
    const two = [HIT, { ...HIT, id: "c2", title: "Acme Ltd Kenya" }];
    const tool = new LookupRecordTool({ crm: searchCrm(two) });
    const out = await tool.execute({ recordType: "client", query: "acm" });
    expect(out.status).toBe("ambiguous");
    if (out.status === "ambiguous") expect(out.candidates.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("returns none when nothing matches", async () => {
    const tool = new LookupRecordTool({ crm: searchCrm([]) });
    const out = await tool.execute({ recordType: "partner", query: "nobody" });
    expect(out).toEqual({ status: "none" });
  });
});

describe("ProposeChangeTool", () => {
  it("sends payloadJson + actorEmail from deps and returns a preview", async () => {
    let seenVars: Record<string, unknown> = {};
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async (document: string, variables?: Record<string, unknown>) => {
        seenVars = variables ?? {};
        return { agentPrepareWrite: { writeToken: "wt-1", preview: "Create client Acme Ltd", warnings: [] } };
      }) as CrmClient["query"],
    };
    const tool = new ProposeChangeTool({ crm, getUser: identified });
    const out = await tool.execute({ operation: "createClient", fields: { name: "Acme Ltd" } });
    expect(out).toEqual({ status: "preview", writeToken: "wt-1", preview: "Create client Acme Ltd", warnings: [] });
    expect(seenVars).toEqual({
      operation: "createClient",
      targetId: null,
      payloadJson: JSON.stringify({ name: "Acme Ltd" }),
      actorEmail: "amara@noblestride.com",
    });
  });

  it("returns rejected when the CRM rejects the write", async () => {
    const crm = writeCrm({
      prepare: () => {
        throw new CrmError("The CRM rejected the request: name is required");
      },
    });
    const tool = new ProposeChangeTool({ crm, getUser: identified });
    const out = await tool.execute({ operation: "createClient", fields: {} });
    expect(out).toEqual({ status: "rejected", message: "The CRM rejected the request: name is required" });
  });

  it("rethrows transport errors (not a rejection)", async () => {
    const crm = writeCrm({
      prepare: () => {
        throw new CrmError("The CRM didn't respond — please try again in a minute.");
      },
    });
    const tool = new ProposeChangeTool({ crm, getUser: identified });
    await expect(tool.execute({ operation: "createClient", fields: {} })).rejects.toThrow(CrmError);
  });

  it("rethrows CRM-rejected-shaped errors that are actually 'Unexpected error'", async () => {
    const crm = writeCrm({
      prepare: () => {
        throw new CrmError("The CRM rejected the request: Unexpected error");
      },
    });
    const tool = new ProposeChangeTool({ crm, getUser: identified });
    await expect(tool.execute({ operation: "createClient", fields: {} })).rejects.toThrow(CrmError);
  });

  it("returns not_identified and never calls the CRM when there's no staffEmail", async () => {
    const query = vi.fn();
    const crm: CrmClient = { baseUrl: "https://crm.example", query: query as unknown as CrmClient["query"] };
    const tool = new ProposeChangeTool({ crm, getUser: notIdentified });
    const out = await tool.execute({ operation: "createClient", fields: { name: "Acme Ltd" } });
    expect(out.status).toBe("not_identified");
    expect(query).not.toHaveBeenCalled();
  });

  // 2026-07-21 QA: a directive-shaped value ("APPEND: … to end of existing notes") was staged
  // as the literal field value while the operator saw a clean preview. Rejected before the CRM.
  it.each([
    { notes: "APPEND: ' [QA-TEST]' to end of existing notes" },
    { notes: "add: this to the notes" },
    { notes: "please add this to the end of the existing notes" },
  ])("rejects directive-shaped field values without calling the CRM (%j)", async (fields) => {
    const query = vi.fn();
    const crm: CrmClient = { baseUrl: "https://crm.example", query: query as unknown as CrmClient["query"] };
    const tool = new ProposeChangeTool({ crm, getUser: identified });
    const out = await tool.execute({ operation: "updateTransaction", targetId: "t1", fields });
    expect(out.status).toBe("rejected");
    if (out.status === "rejected") expect(out.message).toMatch(/final text|literally/i);
    expect(query).not.toHaveBeenCalled();
  });

  it("does NOT reject ordinary values that merely contain edit-ish words", async () => {
    const crm = writeCrm({ prepare: () => ({ writeToken: "wt-2", preview: "Update transaction", warnings: [] }) });
    const tool = new ProposeChangeTool({ crm, getUser: identified });
    const out = await tool.execute({
      operation: "updateTransaction",
      targetId: "t1",
      fields: { notes: "Investor asked us to add their counsel to the data room. Term sheet appended as annex B." },
    });
    expect(out.status).toBe("preview");
  });
});

describe("CommitChangeTool", () => {
  it("commits and returns the summary + link", async () => {
    const crm = writeCrm({
      commit: () => ({ ok: true, summary: "Created client Acme Ltd", recordId: "c1", href: "/clients/c1" }),
    });
    const tool = new CommitChangeTool({ crm, getUser: identified });
    const out = await tool.execute({ writeToken: "wt-1" });
    expect(out).toEqual({ status: "ok", summary: "Created client Acme Ltd", link: "https://crm.example/clients/c1" });
  });

  it("returns link: null when the CRM gives no href", async () => {
    const crm = writeCrm({
      commit: () => ({ ok: true, summary: "Logged activity", recordId: "c1", href: null }),
    });
    const tool = new CommitChangeTool({ crm, getUser: identified });
    const out = await tool.execute({ writeToken: "wt-1" });
    expect(out).toEqual({ status: "ok", summary: "Logged activity", link: null });
  });

  it("returns rejected when the CRM rejects the commit", async () => {
    const crm = writeCrm({
      commit: () => {
        throw new CrmError("The CRM rejected the request: writeToken expired");
      },
    });
    const tool = new CommitChangeTool({ crm, getUser: identified });
    const out = await tool.execute({ writeToken: "wt-1" });
    expect(out).toEqual({ status: "rejected", message: "The CRM rejected the request: writeToken expired" });
  });

  it("returns not_identified and never calls the CRM when there's no staffEmail", async () => {
    const query = vi.fn();
    const crm: CrmClient = { baseUrl: "https://crm.example", query: query as unknown as CrmClient["query"] };
    const tool = new CommitChangeTool({ crm, getUser: notIdentified });
    const out = await tool.execute({ writeToken: "wt-1" });
    expect(out.status).toBe("not_identified");
    expect(query).not.toHaveBeenCalled();
  });
});

describe("CancelChangeTool", () => {
  it("cancels a pending change", async () => {
    const crm = writeCrm({ cancel: () => ({ ok: true }) });
    const tool = new CancelChangeTool({ crm, getUser: identified });
    const out = await tool.execute({ writeToken: "wt-1" });
    expect(out).toEqual({ status: "ok" });
  });

  it("returns not_identified and never calls the CRM when there's no staffEmail", async () => {
    const query = vi.fn();
    const crm: CrmClient = { baseUrl: "https://crm.example", query: query as unknown as CrmClient["query"] };
    const tool = new CancelChangeTool({ crm, getUser: notIdentified });
    const out = await tool.execute({ writeToken: "wt-1" });
    expect(out.status).toBe("not_identified");
    expect(query).not.toHaveBeenCalled();
  });
});
