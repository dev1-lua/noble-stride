// RetainerPayment write path — F4.3.1's third clause (Aug-2026 feedback): a
// ledger of individual retainer payments behind Mandate.retainerPaidAmount.
//
// Recording a payment increments the mandate's paid amount inside the same
// database transaction; deleting one decrements it, clamped at zero. The
// scalar itself stays directly editable in the mandate drawer (pre-ledger
// history), so on old mandates the ledger total and the paid amount may
// legitimately differ — the UI shows the ledger total alongside, it never
// overwrites the scalar wholesale.

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { actorSource, CrudError } from "./crud";
import type { Actor } from "@/graphql/context";

const recordSchema = z.object({
  mandateId: z.string().min(1),
  amount: z.number().positive(),
  paidOn: z.coerce.date().optional(),
  reference: z.string().trim().max(500).optional(),
});

export async function recordRetainerPayment(raw: unknown, actor: Actor) {
  const input = recordSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const mandate = await tx.mandate.findUnique({
      where: { id: input.mandateId },
      select: { id: true, retainerPaidAmount: true },
    });
    if (!mandate) throw new CrudError("Mandate not found");

    const payment = await tx.retainerPayment.create({
      data: {
        mandateId: input.mandateId,
        amount: new Prisma.Decimal(input.amount),
        paidOn: input.paidOn ?? new Date(),
        reference: input.reference || null,
        recordedById: actor.userId ?? null,
        createdSource: actorSource(actor),
      },
      include: { recordedBy: true },
    });

    const paid = Number(mandate.retainerPaidAmount ?? 0) + input.amount;
    await tx.mandate.update({
      where: { id: input.mandateId },
      data: { retainerPaidAmount: new Prisma.Decimal(paid) },
    });

    return payment;
  });
}

export async function deleteRetainerPayment(id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.retainerPayment.findUnique({
      where: { id },
      select: { id: true, amount: true, mandateId: true, mandate: { select: { retainerPaidAmount: true } } },
    });
    if (!payment) return false;

    await tx.retainerPayment.delete({ where: { id } });

    const paid = Math.max(0, Number(payment.mandate.retainerPaidAmount ?? 0) - Number(payment.amount));
    await tx.mandate.update({
      where: { id: payment.mandateId },
      data: { retainerPaidAmount: new Prisma.Decimal(paid) },
    });

    return true;
  });
}
