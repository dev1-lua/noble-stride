// DB-backed smoke test for ingestMessage (mail matching + EmailMessage upsert).
// Skips cleanly when DATABASE_URL is unset (e.g. CI without a DB).
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { ingestMessage } from "../mailsync";

const d = process.env.DATABASE_URL ? describe : describe.skip;
const UNIQ = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

d("ingestMessage (smoke)", () => {
  it("upserts an EmailMessage row and matches it to the investor by participant email", async () => {
    const email = `zz-mailsync-${UNIQ}@x.com`;
    const investor = await prisma.investor.create({
      data: {
        name: `ZZ Mailsync Investor ${UNIQ}`,
        investorType: "VentureCapital",
        contacts: { create: { firstName: "ZZ", lastName: "Contact", email, isPrimaryContact: true } },
      },
    });
    const externalId = `msg-${UNIQ}`;
    try {
      await ingestMessage("team@ns.com", {
        externalId,
        toAddresses: ["team@ns.com"],
        fromAddress: email,
        subject: "Hello",
      });

      const row = await prisma.emailMessage.findUnique({
        where: { provider_externalId: { provider: "outlook", externalId } },
      });
      expect(row).not.toBeNull();
      expect(row?.investorId).toBe(investor.id);
      expect(row?.matchedBy).toBe("participant");
      expect(row?.direction).toBe("inbound");
    } finally {
      await prisma.emailMessage.deleteMany({ where: { externalId } });
      await prisma.person.deleteMany({ where: { investorId: investor.id } });
      await prisma.investor.delete({ where: { id: investor.id } });
    }
  });
});
