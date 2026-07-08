// src/server/services/meetings.ts
// Thin service: schedule a meeting via the provider seam (manual no-op
// fallback when Teams is unconfigured; see
// src/server/integrations/meetings/provider.ts) and persist a Meeting row.
// Also logs a Meeting Activity so the timeline mirrors manual meeting
// logging (see engagements.logActivity) for a consistent shape.
import { prisma } from "@/lib/db";
import { actorSource } from "./crud";
import type { Actor } from "@/graphql/context";
import { getMeetingProvider, type ScheduleMeetingInput } from "@/server/integrations/meetings/provider";
import { graphEnv } from "@/server/integrations/config";

export async function scheduleMeeting(input: ScheduleMeetingInput, actor: Actor): Promise<{ id: string; joinUrl: string }> {
  const result = await getMeetingProvider().scheduleMeeting(input);
  const meeting = await prisma.meeting.create({
    data: {
      provider: "teams",
      externalId: result.externalId,
      joinUrl: result.joinUrl,
      subject: input.subject,
      startAt: input.startAt,
      endAt: input.endAt,
      organizerUserId: graphEnv().organizerId,
      engagementId: input.linkRecord.engagementId ?? null,
      transactionId: input.linkRecord.transactionId ?? null,
      investorId: input.linkRecord.investorId ?? null,
      createdSource: actorSource(actor),
    },
  });
  // Mirror the manual meeting-logging shape so timelines are consistent.
  await prisma.activity.create({
    data: {
      type: "Meeting",
      subject: input.subject,
      engagementId: input.linkRecord.engagementId ?? null,
      transactionId: input.linkRecord.transactionId ?? null,
      investorId: input.linkRecord.investorId ?? null,
      createdSource: actorSource(actor),
    },
  });
  return { id: meeting.id, joinUrl: meeting.joinUrl };
}
