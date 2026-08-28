// Where a website application stands (F2.1 / image2).
//
// There is no status column: an application IS a Mandate with source Website,
// and its state follows from two facts already in the row — has a deal lead
// picked it up, and is the deal still open. Keeping the derivation pure (and
// type-only on Prisma) means the staff Applications page, its tab counts and
// the public /apply/status tracker cannot drift apart.
//
// A lead deliberately wins over a non-Open status: an application that was
// accepted and later paused is still an accepted application, not a rejected
// one, and the applicant should be told the truth.

import type { DealStatus, MandateStage } from "@prisma/client";
import { label } from "@/lib/vocab";

export type ApplicationTab = "awaiting" | "accepted" | "dropped";

export const APPLICATION_TABS = ["awaiting", "accepted", "dropped"] as const satisfies readonly ApplicationTab[];

export const APPLICATION_TAB_LABELS: Record<ApplicationTab, string> = {
  awaiting: "Awaiting",
  accepted: "Accepted",
  dropped: "Not taken forward",
};

export function applicationTabOf(m: { leadId: string | null; dealStatus: DealStatus }): ApplicationTab {
  if (m.leadId) return "accepted";
  return m.dealStatus === "Open" ? "awaiting" : "dropped";
}

/** One line an applicant or a reviewer can read without knowing the data model. */
export function applicationStatusLabel(m: {
  leadId: string | null;
  dealStatus: DealStatus;
  stage: MandateStage;
}): string {
  switch (applicationTabOf(m)) {
    case "awaiting":
      return "Awaiting review";
    case "accepted":
      return `Accepted — ${label("MandateStage", m.stage)}`;
    case "dropped":
      return "Not taken forward";
  }
}
