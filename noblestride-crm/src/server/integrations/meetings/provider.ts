// src/server/integrations/meetings/provider.ts
import { teamsConfigured } from "../config";
import { ManualMeetingProvider } from "./manual";
import { TeamsMeetingProvider } from "./teams";

export interface ScheduleMeetingInput {
  subject: string;
  startAt: Date;
  endAt: Date;
  attendees: { email: string; name?: string }[];
  linkRecord: { engagementId?: string; transactionId?: string; investorId?: string };
}
export interface MeetingResult { externalId: string; joinUrl: string }

export interface MeetingProvider {
  scheduleMeeting(input: ScheduleMeetingInput): Promise<MeetingResult>;
  cancelMeeting(externalId: string): Promise<void>;
}

export function getMeetingProvider(): MeetingProvider {
  if (teamsConfigured()) return new TeamsMeetingProvider();
  return new ManualMeetingProvider();
}
