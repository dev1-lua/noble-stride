import { describe, it, expect, beforeAll } from "vitest";
import { POST } from "@/app/api/graphql/route";

async function gql(body: object, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

describe("investor agent fields are automation-gated", () => {
  beforeAll(() => {
    process.env.AGENT_API_KEY = "test-agent-key-123";
  });
  const q = { query: `{ investorByEmail(email: "x@y.z") { matched } }` };

  it("anonymous is rejected 401", async () => {
    expect((await gql(q)).status).toBe(401);
  });
  it("x-agent-key passes the gate", async () => {
    const res = await gql(q, { "x-agent-key": "test-agent-key-123" });
    expect(res.status).not.toBe(401);
  });
});
