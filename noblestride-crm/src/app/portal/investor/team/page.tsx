// portal/investor/team — org contacts + access management (spec 2026-07-19
// §7). Data is scoped by the viewpoint's investorId; the page only ever
// queries the investor's own Person rows.

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { getCurrentAuth } from "@/server/auth/current";
import { deriveMemberStatus } from "@/lib/team-status";
import TeamManager, { type TeamRow } from "./team-manager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  const auth = await getCurrentAuth();
  const selfPersonId = auth?.person?.id ?? null;

  const people = await prisma.person.findMany({
    where: { investorId: vp.recordId },
    include: { authAccount: { select: { status: true, lastLoginAt: true } } },
    orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  const rows: TeamRow[] = people.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName ?? ""}`.trim(),
    email: p.email,
    phone: p.phone,
    jobTitle: p.jobTitle,
    isPrimaryContact: p.isPrimaryContact,
    isSelf: p.id === selfPersonId,
    badge: deriveMemberStatus(p.authAccount),
  }));

  return <TeamManager rows={rows} />;
}
