// src/server/integrations/meetings/teams.ts
// Teams meeting = a Graph calendar event with isOnlineMeeting. Auto-invites
// attendees and returns onlineMeeting.joinUrl. Needs only Calendars.ReadWrite.
import { graphEnv } from "../config";
import { getGraphToken } from "../msgraph/auth";
import { IntegrationError } from "../errors";
import type { MeetingProvider, ScheduleMeetingInput, MeetingResult } from "./provider";

export function buildEventBody(i: ScheduleMeetingInput): object {
  return {
    subject: i.subject,
    start: { dateTime: i.startAt.toISOString(), timeZone: "UTC" },
    end: { dateTime: i.endAt.toISOString(), timeZone: "UTC" },
    attendees: i.attendees.map((a) => ({ emailAddress: { address: a.email, name: a.name ?? a.email }, type: "required" })),
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
  };
}

export class TeamsMeetingProvider implements MeetingProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async scheduleMeeting(input: ScheduleMeetingInput): Promise<MeetingResult> {
    const token = await getGraphToken(this.fetchImpl);
    const { organizerId } = graphEnv();
    const res = await this.fetchImpl(`https://graph.microsoft.com/v1.0/users/${organizerId}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEventBody(input)),
    });
    if (!res.ok) throw new IntegrationError(`Graph event create failed (${res.status})`, 502);
    const j = (await res.json()) as { id: string; onlineMeeting?: { joinUrl?: string } };
    return { externalId: j.id, joinUrl: j.onlineMeeting?.joinUrl ?? "" };
  }

  async cancelMeeting(externalId: string): Promise<void> {
    const token = await getGraphToken(this.fetchImpl);
    const { organizerId } = graphEnv();
    await this.fetchImpl(`https://graph.microsoft.com/v1.0/users/${organizerId}/events/${externalId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}
