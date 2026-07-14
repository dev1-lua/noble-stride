// MINOR a: logInvestorCommunication's `interactionType` arrives as a raw
// GraphQL string and is force-cast to the Prisma InteractionType enum inside
// the service (src/server/services/investor-agent.ts). An invalid value used
// to reach that cast unguarded and blow up with an opaque Prisma error (and,
// via mask-error.ts, an even more opaque "Unexpected error." to the caller).
// The resolver must validate against the real enum first and throw a clear,
// unmasked error (CrudError passes through maskDomainError verbatim).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/graphql/route";

let dbUp = true;
async function checkDb() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbUp = false;
  }
}

let investorId = "";

beforeAll(async () => {
  await checkDb();
  if (!dbUp) return;
  process.env.AGENT_API_KEY = "test-agent-key-123";
  const investor = await prisma.investor.create({
    data: {
      name: "ZZTest LogComm Fund",
      investorType: "PrivateEquity",
      sectorFocus: ["Healthcare"],
      geographicFocus: ["EastAfrica"],
      instruments: ["Equity"],
      ticketMin: 1_000_000,
      ticketMax: 5_000_000,
      status: "ActivelyDeploying",
    },
  });
  investorId = investor.id;
});

afterAll(async () => {
  if (!dbUp) return;
  await prisma.activity.deleteMany({ where: { investorId } });
  await prisma.investor.deleteMany({ where: { name: "ZZTest LogComm Fund" } });
});

async function gql(query: string, variables: Record<string, unknown>) {
  const res = await POST(
    new Request("http://localhost/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", "x-agent-key": "test-agent-key-123" },
      body: JSON.stringify({ query, variables }),
    }),
  );
  return res.json();
}

const MUTATION = `
  mutation Log($input: InvestorCommunicationInput!) {
    logInvestorCommunication(input: $input) { ok }
  }
`;

describe("logInvestorCommunication validates interactionType (MINOR a)", () => {
  it("rejects an invalid interactionType with a clear, unmasked error", async () => {
    if (!dbUp) return;
    const body = await gql(MUTATION, {
      input: { investorId, direction: "Inbound", interactionType: "NotARealType", summary: "ZZTest bad type" },
    });
    expect(body.data?.logInvestorCommunication ?? null).toBeNull();
    expect(body.errors?.[0]?.message).toMatch(/interactionType/i);
    expect(body.errors?.[0]?.message).not.toBe("Unexpected error.");
    const act = await prisma.activity.findFirst({ where: { investorId, subject: { contains: "ZZTest bad type" } } });
    expect(act).toBeNull();
  });

  it("accepts a real InteractionType value", async () => {
    if (!dbUp) return;
    const body = await gql(MUTATION, {
      input: { investorId, direction: "Inbound", interactionType: "Email", summary: "ZZTest valid comm" },
    });
    expect(body.errors).toBeUndefined();
    expect(body.data?.logInvestorCommunication?.ok).toBe(true);
  });
});
