import { describe, it, expect, beforeAll } from "vitest";
import { parse } from "graphql";
import { isIntrospectionOnly } from "@/graphql/auth-gate";
import { POST } from "@/app/api/graphql/route";
import { assertCan } from "@/server/rbac/enforce";
import type { Actor } from "@/graphql/context";

async function gql(body: object, headers: Record<string, string> = {}): Promise<Response> {
  return POST(
    new Request("http://localhost/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

describe("isIntrospectionOnly", () => {
  it("true for __schema-only queries", () => {
    expect(isIntrospectionOnly(parse("{ __schema { queryType { name } } }"))).toBe(true);
    expect(isIntrospectionOnly(parse("{ __typename }"))).toBe(true);
  });
  it("false when any data field is selected", () => {
    expect(isIntrospectionOnly(parse("{ __typename clients { id } }"))).toBe(false);
    expect(isIntrospectionOnly(parse("{ clients { id } }"))).toBe(false);
  });
  it("false for mutations", () => {
    expect(isIntrospectionOnly(parse("mutation { __typename }"))).toBe(false);
  });
});

describe("auth gate (integration via yoga handler)", () => {
  beforeAll(() => {
    process.env.AGENT_API_KEY = "test-agent-key-123";
  });

  it("anonymous data query is rejected with 401", async () => {
    const res = await gql({ query: "{ clients { id } }" });
    expect(res.status).toBe(401);
  });

  it("anonymous introspection is allowed", async () => {
    const res = await gql({ query: "{ __schema { queryType { name } } }" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.__schema.queryType.name).toBe("Query");
  });

  it("x-agent-key request passes the gate (never 401)", async () => {
    const res = await gql(
      { query: "{ pipelineOverview { mandatesByStage { stage count } } }" },
      { "x-agent-key": "test-agent-key-123" },
    );
    // DB may be unavailable in CI — the assertion is only that AUTH passed.
    expect(res.status).not.toBe(401);
  });
});

describe("delegated actor does not get the automation RBAC bypass", () => {
  it("a plain (non-delegated) authenticated AGENT/API actor keeps the existing automation bypass", () => {
    const agent: Actor = { type: "AGENT", authenticated: true };
    const api: Actor = { type: "API", authenticated: true };
    expect(() => assertCan(agent, "Clients", "U")).not.toThrow();
    expect(() => assertCan(api, "Clients", "D")).not.toThrow();
  });

  it("an AGENT actor resolved as a delegate is judged on the delegate's real role, not automation", () => {
    const delegatedAdmin: Actor = {
      type: "AGENT",
      authenticated: true,
      delegated: true,
      accountKind: "INTERNAL",
      orgRole: "Admin",
    };
    const delegatedMember: Actor = {
      type: "AGENT",
      authenticated: true,
      delegated: true,
      accountKind: "INTERNAL",
      orgRole: "TeamMember",
    };
    expect(() => assertCan(delegatedAdmin, "Clients", "U")).not.toThrow(); // Admin really can
    expect(() => assertCan(delegatedMember, "Clients", "U")).toThrow(/not authorized/i); // TeamMember really can't
  });
});
