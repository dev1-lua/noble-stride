// src/server/services/esign.ts
// Thin service: send an e-sign envelope via the provider seam and persist a
// tracking row. Completion is applied by resolveEnvelopeCompletion (webhook),
// which converges on the same NDA state the manual buttons produce.
import { prisma } from "@/lib/db";
import { actorSource } from "./crud";
import { recordOpenNda, recordClosedNda } from "./nda";
import type { Actor } from "@/graphql/context";
import { getESignProvider, type SendEnvelopeInput } from "@/server/integrations/esign/provider";

export async function sendEsignEnvelope(input: SendEnvelopeInput, actor: Actor) {
  const result = await getESignProvider().sendEnvelope(input);
  const row = await prisma.eSignEnvelope.create({
    data: {
      provider: "docusign",
      externalId: result.externalId,
      kind: input.kind,
      status: result.status,
      signerEmail: input.signer.email,
      signerName: input.signer.name,
      investorId: input.linkRecord.investorId ?? null,
      engagementId: input.linkRecord.engagementId ?? null,
      transactionId: input.linkRecord.transactionId ?? null,
      createdSource: actorSource(actor),
    },
  });
  return { id: row.id, externalId: row.externalId, status: row.status };
}

export async function resolveEnvelopeCompletion(externalId: string, completedAt: Date): Promise<void> {
  const row = await prisma.eSignEnvelope.findFirst({ where: { provider: "docusign", externalId } });
  if (!row || row.status === "completed") return; // idempotent

  const systemActor: Actor = { type: "API" };
  if (row.kind === "OpenNda" && row.investorId) {
    await recordOpenNda(row.investorId, systemActor);
  } else if (row.kind === "ClosedNda" && row.engagementId) {
    await recordClosedNda(row.engagementId, systemActor);
  }
  // TermSheet completion records no NDA state; the row status update below is sufficient.
  await prisma.eSignEnvelope.update({ where: { id: row.id }, data: { status: "completed", completedAt } });
}
