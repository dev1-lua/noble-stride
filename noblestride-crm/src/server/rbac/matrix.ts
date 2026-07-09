// RBAC matrix (design spec §7.2) — the single source of truth for the in-org
// access model. Pure module: type-only Prisma import, no runtime deps, safe to
// import from client components. This drives BOTH the /access-matrix display
// and the demo view-lens enforcement. Demo-grade: enforced at UI level, not auth.

import type { OrgRole } from "@prisma/client";

export const RBAC_ENTITIES = [
  "Investors",
  "Clients",
  "Mandates",
  "Transactions",
  "Engagements",
  "Partners",
  "Documents",
  "Service Providers",
  "Tasks",
] as const;

export type RbacEntity = (typeof RBAC_ENTITIES)[number];
export type Perm = "C" | "R" | "U" | "D";

const FULL: readonly Perm[] = ["C", "R", "U", "D"];

/** §7.2 defaults: Admin full CRUD; Deal Lead CRU own deals + read all; Team Member read all, update assigned work. */
export const RBAC_MATRIX: Record<OrgRole, Record<RbacEntity, readonly Perm[]>> = {
  Admin: Object.fromEntries(RBAC_ENTITIES.map((e) => [e, FULL])) as Record<RbacEntity, readonly Perm[]>,
  DealLead: {
    Investors: ["C", "R", "U"],
    Clients: ["C", "R", "U"],
    Mandates: ["C", "R", "U"],
    Transactions: ["C", "R", "U"],
    Engagements: ["C", "R", "U"],
    Partners: ["R"],
    Documents: ["C", "R", "U"],
    "Service Providers": ["R"],
    Tasks: ["C", "R", "U"],
  },
  TeamMember: {
    Investors: ["R"],
    Clients: ["R"],
    Mandates: ["R"],
    Transactions: ["R"],
    Engagements: ["R", "U"],
    Partners: ["R"],
    Documents: ["R"],
    "Service Providers": ["R"],
    Tasks: ["R", "U"],
  },
};

export function can(role: OrgRole, entity: RbacEntity, perm: Perm): boolean {
  return RBAC_MATRIX[role][entity].includes(perm);
}

/** Entities whose UPDATE is scoped to "own records" for non-admin roles. */
const OWN_SCOPED: Readonly<Partial<Record<RbacEntity, true>>> = {
  Mandates: true,
  Transactions: true,
  Engagements: true,
  Tasks: true,
};

/** Ownership links: Transaction/Engagement.ownerId, Mandate.leadId, Task.assigneeId. */
export interface OwnableRecord {
  ownerId?: string | null;
  leadId?: string | null;
  assigneeId?: string | null;
}

export function ownsRecord(userId: string | undefined, record: OwnableRecord): boolean {
  if (!userId) return false;
  return record.ownerId === userId || record.leadId === userId || record.assigneeId === userId;
}

/** Row-level update check: matrix perm + own-scope for non-admins. */
export function canUpdateRecord(
  role: OrgRole,
  entity: RbacEntity,
  userId: string | undefined,
  record: OwnableRecord,
): boolean {
  if (!can(role, entity, "U")) return false;
  if (role === "Admin") return true;
  if (!OWN_SCOPED[entity]) return true; // no ownership link on this entity — matrix perm decides
  return ownsRecord(userId, record);
}

export function canDeleteRecord(role: OrgRole, entity: RbacEntity): boolean {
  return can(role, entity, "D");
}
