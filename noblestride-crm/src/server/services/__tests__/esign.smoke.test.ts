import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/integrations/esign/provider", () => ({
  getESignProvider: () => ({
    sendEnvelope: vi.fn(async () => ({ externalId: "env-123", status: "sent" })),
    getEnvelope: vi.fn(),
  }),
}));

import { sendEsignEnvelope } from "../esign";
import { prisma } from "@/lib/db";
import type { Actor } from "@/graphql/context";

beforeEach(async () => { await prisma.eSignEnvelope.deleteMany({ where: { externalId: "env-123" } }); });

describe("sendEsignEnvelope", () => {
  it("calls the provider and persists an ESignEnvelope row", async () => {
    const out = await sendEsignEnvelope({
      kind: "OpenNda", documentBase64: "x", documentName: "NDA.pdf",
      signer: { email: "a@b.com", name: "A" }, subject: "s", linkRecord: {},
    }, { type: "API" } as Actor);
    expect(out.externalId).toBe("env-123");
    const row = await prisma.eSignEnvelope.findFirst({ where: { externalId: "env-123" } });
    expect(row?.status).toBe("sent");
    expect(row?.kind).toBe("OpenNda");
  });
});
