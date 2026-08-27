// Website applications (F2.1 / image2: "the application syncs into the CRM, but
// the only way to reach it is the notification bell").
//
// An application is not a new entity: it is a Mandate with `source: "Website"`,
// created by the public intake wizard or the website chat agent. This service
// gives that set a first-class list with the applicant's contact details
// attached — which the CRM already stored (F2.3) but never showed.
//
// The `awaiting` predicate is intentionally identical to
// dashboard.ts::intakeAwaitingReviewCount, so the sidebar badge, the dashboard
// callout and this page can never disagree about how many are waiting. A smoke
// test asserts the two counts match.

import { prisma } from "@/lib/db";
import {
  applicationTabOf,
  applicationStatusLabel,
  APPLICATION_TABS,
  APPLICATION_TAB_LABELS,
  type ApplicationTab,
} from "@/server/domain/application-status";

export {
  applicationTabOf,
  applicationStatusLabel,
  APPLICATION_TABS,
  APPLICATION_TAB_LABELS,
  type ApplicationTab,
};

export type ApplicationVerdict = "Qualified" | "NeedsReview" | "Deprioritized" | null;

export interface ApplicationContact {
  personId: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
}

export interface ApplicationRow {
  mandateId: string;
  clientId: string;
  company: string;
  submittedAt: Date;
  tab: ApplicationTab;
  statusLabel: string;
  verdict: ApplicationVerdict;
  /** How it arrived: the intake form, or the website chat agent. */
  via: "Website form" | "Web chat";
  dealSize: number | null;
  currency: string;
  leadName: string | null;
  contact: ApplicationContact | null;
  documentCount: number;
}

/** The tab predicates, in one place so counts and rows cannot diverge. */
const TAB_WHERE = {
  awaiting: { leadId: null, dealStatus: "Open" },
  accepted: { leadId: { not: null } },
  dropped: { leadId: null, dealStatus: { not: "Open" } },
} as const;

const CONTACT_ORDER = [{ isPrimaryContact: "desc" }, { createdAt: "asc" }] as const;

export async function listApplications(opts?: { tab?: ApplicationTab; q?: string }): Promise<ApplicationRow[]> {
  const mandates = await prisma.mandate.findMany({
    where: {
      source: "Website",
      ...(opts?.tab ? TAB_WHERE[opts.tab] : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      client: { include: { contacts: { orderBy: [...CONTACT_ORDER] } } },
      lead: { select: { name: true } },
      _count: { select: { documents: true } },
    },
  });

  const rows: ApplicationRow[] = mandates.map((m) => {
    const person = m.client.contacts[0] ?? null;
    return {
      mandateId: m.id,
      clientId: m.clientId,
      company: m.client.name,
      submittedAt: m.createdAt,
      tab: applicationTabOf(m),
      statusLabel: applicationStatusLabel(m),
      verdict: (m.qualificationVerdict as ApplicationVerdict) ?? null,
      // AGENT provenance means the website chat agent filed it, not the form.
      via: m.createdSource === "AGENT" ? "Web chat" : "Website form",
      dealSize: m.dealSize == null ? null : Number(m.dealSize),
      currency: m.currency ?? "USD",
      leadName: m.lead?.name ?? null,
      contact: person
        ? {
            personId: person.id,
            name: `${person.firstName} ${person.lastName ?? ""}`.trim(),
            jobTitle: person.jobTitle,
            email: person.email,
            phone: person.phone,
          }
        : null,
      documentCount: m._count.documents,
    };
  });

  const q = opts?.q?.trim().toLowerCase();
  if (!q) return rows;
  // In-memory, like deals-queue: the website-application set is small, and the
  // search has to span the company and the applicant in one box.
  return rows.filter((r) =>
    [r.company, r.contact?.name, r.contact?.email]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q)),
  );
}

export async function applicationCounts(): Promise<Record<ApplicationTab, number>> {
  const [awaiting, accepted, dropped] = await Promise.all(
    APPLICATION_TABS.map((tab) =>
      prisma.mandate.count({ where: { source: "Website", ...TAB_WHERE[tab] } }),
    ),
  );
  return { awaiting: awaiting!, accepted: accepted!, dropped: dropped! };
}
