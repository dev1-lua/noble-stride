// investors/proposed-changes/page.tsx — Proposed-changes inbox. Server
// Component: the auth gate is getOrgLens() (redirects to /login when signed
// out); RBAC on the actual write is enforced again inside
// confirmProposedChange/rejectProposedChange (Task 3), never duplicated here.
import { prisma } from "@/lib/db";
import { getOrgLens } from "@/server/rbac/context";
import { ChangeCard, type ChangeCardData } from "./change-card";

export const dynamic = "force-dynamic";

export default async function ProposedChangesPage() {
  await getOrgLens(); // auth gate; RBAC enforced again inside the service on confirm
  const rows = await prisma.investorProposedChange.findMany({
    where: { status: "Pending" },
    include: { investor: true, person: true },
    orderBy: { createdAt: "asc" },
  });

  const cards: ChangeCardData[] = rows.map((row) => {
    const proposed = row.proposedFields as Record<string, unknown>;
    const current: Record<string, unknown> = { ...row.investor, ...(row.person ?? {}) };
    return {
      id: row.id,
      investorName: row.investor.name,
      contactName: row.person ? `${row.person.firstName} ${row.person.lastName ?? ""}` : null,
      sourceEmail: row.sourceEmail,
      summary: row.summary,
      createdAt: row.createdAt.toISOString(),
      fields: Object.entries(proposed).map(([key, value]) => ({
        key,
        current: JSON.stringify(current[key] ?? null),
        proposed: JSON.stringify(value),
      })),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Investor Profile Updates</h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          Changes investors sent by email, captured by the agent. Nothing is written to a record until you confirm it here.
        </p>
      </div>
      {cards.length === 0 && <p className="text-sm text-[var(--text-tertiary)]">No pending updates.</p>}
      {cards.map((c) => (
        <ChangeCard key={c.id} change={c} />
      ))}
    </div>
  );
}
