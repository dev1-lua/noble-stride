// applications/page.tsx — the website-application queue (F2.1 / image2).
//
// The client's complaint: "the application syncs into the CRM, but the only way
// I can see it is the notification bell." These are Mandates with source
// Website; they were reachable only through a pre-filtered /deals URL. This is
// their own page, with the applicant's contact details on the row (F2.3) and
// the review actions inline.

import { redirect } from "next/navigation";
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";
import { relationOptions } from "@/server/services/relation-options";
import {
  listApplications,
  applicationCounts,
  APPLICATION_TABS,
  APPLICATION_TAB_LABELS,
  type ApplicationTab,
} from "@/server/services/applications";
import { ApplicationsTable } from "./applications-table";
import { ApplicationsToolbar } from "./applications-toolbar";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string; q?: string }>;
}

function parseTab(raw: string | undefined): ApplicationTab {
  return (APPLICATION_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as ApplicationTab)
    : "awaiting";
}

export default async function ApplicationsPage({ searchParams }: PageProps) {
  const lens = await getOrgLens();
  if (!can(lens.orgRole, "Mandates", "R")) redirect("/dashboard");

  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const q = sp.q?.trim() || undefined;

  const [rows, counts, options] = await Promise.all([
    listApplications({ tab, q }),
    applicationCounts(),
    relationOptions(),
  ]);

  const canReview = can(lens.orgRole, "Mandates", "U");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Website Applications</h1>
        <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
          Submitted through the public intake wizard and the website chat agent.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Application status" className="flex flex-wrap gap-1.5">
          {APPLICATION_TABS.map((t) => {
            const selected = t === tab;
            const href = `/applications?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
            return (
              <a
                key={t}
                role="tab"
                aria-selected={selected}
                data-testid={`applications-tab-${t}`}
                href={href}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                  (selected
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]")
                }
              >
                {APPLICATION_TAB_LABELS[t]} ({counts[t]})
              </a>
            );
          })}
        </div>
        <ApplicationsToolbar tab={tab} q={q ?? ""} />
      </div>

      <ApplicationsTable rows={rows} users={options.users} canReview={canReview} />
    </div>
  );
}
