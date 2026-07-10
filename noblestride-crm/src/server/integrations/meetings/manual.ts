// src/server/integrations/meetings/manual.ts
// Not-configured provider. The authoritative meeting path when Teams is off is
// manual Activity meeting logging (unchanged). Scheduling must never be
// reachable here — the schedule UI only renders when teamsConfigured(); this
// throws as defense-in-depth.
import { IntegrationError } from "../errors";
import type { MeetingProvider } from "./provider";

export class ManualMeetingProvider implements MeetingProvider {
  async scheduleMeeting(): Promise<never> {
    throw new IntegrationError("Teams meetings not configured", 503);
  }
  async cancelMeeting(): Promise<void> {
    /* no-op */
  }
}
