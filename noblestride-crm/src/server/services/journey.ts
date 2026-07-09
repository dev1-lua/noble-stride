// journey.ts — service loader for the deal journey (Task 16). Builds a
// JourneyInput from the mandate's graph in Prisma and hands it to the pure
// `dealJourney` engine (src/server/domain/journey.ts, Task 15 — do not
// modify). This is the only place in the app that touches the database for
// journey data; the engine itself stays dependency-free and unit-testable.

import { prisma } from "@/lib/db";
import { dealJourney, type JourneyInput, type JourneyStep } from "@/server/domain/journey";

/**
 * Derive the 17-step deal journey for a mandate. Returns null when the
 * mandate does not exist. Loads the mandate's full graph (client, referrer,
 * transactions + their engagements/documents, client documents) in ONE
 * `prisma.mandate.findUnique` round via nested includes; a second tiny query
 * finds the earliest Meeting/Call activity (mandate- or client-linked) since
 * that's a scalar lookup unrelated to the mandate-graph shape above.
 */
export async function journeyForMandate(mandateId: string): Promise<JourneyStep[] | null> {
  const mandate = await prisma.mandate.findUnique({
    where: { id: mandateId },
    include: {
      referredBy: { select: { name: true } },
      documents: { select: { type: true } },
      client: { select: { documents: { select: { type: true } } } },
      transactions: {
        select: {
          id: true,
          stage: true,
          vdrLink: true,
          successFeeInvoicedDate: true,
          successFeePaidDate: true,
          documents: { select: { type: true } },
          engagements: { select: { engagementStage: true, amountDisbursed: true, disbursementStatus: true } },
        },
      },
    },
  });

  if (!mandate) return null;

  // Earliest Meeting|Call activity linked to the mandate OR its client.
  // Kept as a separate query: it's a tiny scalar lookup, not part of the
  // mandate-graph shape loaded above.
  const firstMeeting = await prisma.activity.findFirst({
    where: {
      type: { in: ["Meeting", "Call"] },
      OR: [{ mandateId }, { clientId: mandate.clientId }],
    },
    orderBy: { occurredAt: "asc" },
    select: { occurredAt: true },
  });

  const documentTypes: string[] = [
    ...mandate.documents.map((d) => d.type),
    ...mandate.transactions.flatMap((t) => t.documents.map((d) => d.type)),
    ...(mandate.client?.documents.map((d) => d.type) ?? []),
  ];

  const engagementStages: string[] = mandate.transactions.flatMap((t) =>
    t.engagements.map((e) => e.engagementStage)
  );

  const transactions: JourneyInput["transactions"] = mandate.transactions.map((t) => ({
    id: t.id,
    stage: t.stage,
    vdrLink: t.vdrLink,
    successFeeInvoicedDate: t.successFeeInvoicedDate,
    successFeePaidDate: t.successFeePaidDate,
    // hasDisbursements rule: there is no Disbursement model — disbursement
    // data lives on Engagement (amountDisbursed / disbursementStatus). A
    // transaction "has disbursements" when any of its engagements has a
    // positive disbursed amount OR an ACTIVE disbursement status (Disbursed /
    // Ongoing). FellOff / Dropped are excluded — a disbursement that fell
    // through must not mark journey step 15 ("Financial close & disbursement")
    // done. Aligns with disbursement-table.tsx's amountDisbursed framing.
    hasDisbursements: t.engagements.some(
      (e) =>
        (e.amountDisbursed != null && Number(e.amountDisbursed) > 0) ||
        e.disbursementStatus === "Disbursed" ||
        e.disbursementStatus === "Ongoing"
    ),
  }));

  const input: JourneyInput = {
    mandate: {
      id: mandate.id,
      source: mandate.source,
      ndaSignedDate: mandate.ndaSignedDate,
      eaSignedDate: mandate.eaSignedDate,
      stage: mandate.stage,
      retainerPaidDate: mandate.retainerPaidDate,
      qualificationVerdict: mandate.qualificationVerdict,
      referredByName: mandate.referredBy?.name ?? null,
    },
    transactions,
    engagementStages,
    documentTypes,
    firstMeetingAt: firstMeeting?.occurredAt ?? null,
  };

  return dealJourney(input);
}
