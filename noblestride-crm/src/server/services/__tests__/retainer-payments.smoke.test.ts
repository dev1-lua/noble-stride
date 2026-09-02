// DB-backed smoke test for the retainer payment ledger (F4.3.1 third clause).
// Follows the project's `withDb` pattern: skips cleanly when DATABASE_URL is
// unset or the DB is unreachable.
//
// Focus: the ledger and Mandate.retainerPaidAmount must move together.
// Recording a payment increments the paid amount; deleting it decrements;
// deleting a payment larger than the (manually lowered) paid amount clamps at
// zero instead of going negative.

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { recordRetainerPayment, deleteRetainerPayment } from "@/server/services/retainer-payments";

/** Run `fn`, skip on DB-connection errors, re-throw unexpected errors. */
async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping retainer-payments smoke test");
    return null;
  }
  try {
    return await fn();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("connect") ||
      message.includes("Can't reach database") ||
      message.includes("P1001") ||
      message.includes("P1002")
    ) {
      console.log("DB unreachable — skipping smoke test:", message);
      return null;
    }
    throw err;
  }
}

async function paidAmount(mandateId: string): Promise<number> {
  const m = await prisma.mandate.findUniqueOrThrow({
    where: { id: mandateId },
    select: { retainerPaidAmount: true },
  });
  return Number(m.retainerPaidAmount ?? 0);
}

describe("retainer payment ledger (smoke)", () => {
  it("keeps retainerPaidAmount in step with recorded and deleted payments", async () => {
    await withDb(async () => {
      // Self-contained throwaway client + mandate, deleted in finally.
      const client = await prisma.client.create({
        data: { name: "__retainer_ledger_test_client__" },
      });
      const mandate = await prisma.mandate.create({
        data: {
          name: "__retainer_ledger_test_mandate__",
          clientId: client.id,
          retainerAmount: 50_000,
          retainerPaidAmount: 20_000,
        },
      });

      try {
        // Record: paid 20k → 30k, ledger row carries the payment facts.
        const payment = await recordRetainerPayment(
          { mandateId: mandate.id, amount: 10_000, paidOn: new Date("2026-08-15"), reference: "INV-042" },
          { type: "HUMAN" },
        );
        expect(Number(payment.amount)).toBe(10_000);
        expect(payment.reference).toBe("INV-042");
        expect(await paidAmount(mandate.id)).toBe(30_000);

        // Delete: paid 30k → back to 20k, row gone.
        expect(await deleteRetainerPayment(payment.id)).toBe(true);
        expect(await paidAmount(mandate.id)).toBe(20_000);
        expect(await prisma.retainerPayment.findUnique({ where: { id: payment.id } })).toBeNull();

        // Deleting a missing payment reports false and changes nothing.
        expect(await deleteRetainerPayment(payment.id)).toBe(false);
        expect(await paidAmount(mandate.id)).toBe(20_000);

        // Clamp: record 15k (paid → 35k), manually lower paid to 5k (pre-ledger
        // history is directly editable), then delete the 15k payment — the paid
        // amount clamps at 0 rather than going to −10k.
        const clampPayment = await recordRetainerPayment(
          { mandateId: mandate.id, amount: 15_000 },
          { type: "HUMAN" },
        );
        expect(await paidAmount(mandate.id)).toBe(35_000);
        await prisma.mandate.update({
          where: { id: mandate.id },
          data: { retainerPaidAmount: 5_000 },
        });
        expect(await deleteRetainerPayment(clampPayment.id)).toBe(true);
        expect(await paidAmount(mandate.id)).toBe(0);

        // A payment against a missing mandate is refused.
        await expect(
          recordRetainerPayment({ mandateId: "does-not-exist", amount: 1 }, { type: "HUMAN" }),
        ).rejects.toThrow("Mandate not found");
      } finally {
        await prisma.mandate.delete({ where: { id: mandate.id } });
        await prisma.client.delete({ where: { id: client.id } });
      }
    });
  });
});
