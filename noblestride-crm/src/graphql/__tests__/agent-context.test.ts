import { describe, it, expect, beforeEach } from "vitest";
import { createContext } from "@/graphql/context";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/graphql", { method: "POST", headers });
}

describe("createContext x-agent-key", () => {
  beforeEach(() => {
    process.env.AGENT_API_KEY = "test-agent-key-123";
  });

  it("valid key yields an authenticated AGENT actor", async () => {
    const ctx = await createContext(req({ "x-agent-key": "test-agent-key-123" }));
    expect(ctx.actor).toMatchObject({ type: "AGENT", authenticated: true, label: "lua-summary-agent" });
  });

  it("wrong key yields an unauthenticated actor", async () => {
    const ctx = await createContext(req({ "x-agent-key": "wrong" }));
    expect(ctx.actor.authenticated).toBe(false);
  });

  it("header present but AGENT_API_KEY unset yields unauthenticated (fail closed)", async () => {
    delete process.env.AGENT_API_KEY;
    const ctx = await createContext(req({ "x-agent-key": "test-agent-key-123" }));
    expect(ctx.actor.authenticated).toBe(false);
  });

  it("no header keeps existing anonymous behavior", async () => {
    const ctx = await createContext(req({}));
    expect(ctx.actor).toMatchObject({ type: "HUMAN", authenticated: false });
  });
});
