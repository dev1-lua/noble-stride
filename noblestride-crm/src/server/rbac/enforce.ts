// Server-side RBAC enforcement (real-auth spec §9) — the matrix in matrix.ts
// finally gates mutations, not just buttons. API/AGENT actors with a valid
// Bearer JWT keep full automation access (existing contract).

import { GraphQLError } from "graphql";
import { can, canDeleteRecord, canUpdateRecord, type OwnableRecord, type Perm, type RbacEntity } from "./matrix";
import type { Actor } from "@/graphql/context";

export function forbidden(message = "Not authorized"): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

function isAutomation(actor: Actor): boolean {
  return actor.authenticated === true && (actor.type === "API" || actor.type === "AGENT");
}

function internalRole(actor: Actor) {
  if (actor.authenticated !== true || actor.accountKind !== "INTERNAL" || !actor.orgRole) return null;
  return actor.orgRole;
}

export function assertCan(actor: Actor, entity: RbacEntity, perm: Perm): void {
  if (isAutomation(actor)) return;
  const role = internalRole(actor);
  if (!role || !can(role, entity, perm)) throw forbidden();
}

export function assertCanDelete(actor: Actor, entity: RbacEntity): void {
  if (isAutomation(actor)) return;
  const role = internalRole(actor);
  if (!role || !canDeleteRecord(role, entity)) throw forbidden();
}

/** Row-level update on own-scoped entities. `fetch` runs only for non-admin internal roles. */
export async function assertCanUpdateOwnScoped(
  actor: Actor,
  entity: RbacEntity,
  fetch: () => Promise<OwnableRecord | null>,
): Promise<void> {
  if (isAutomation(actor)) return;
  const role = internalRole(actor);
  if (!role || !can(role, entity, "U")) throw forbidden();
  if (role === "Admin") return;
  const record = await fetch();
  if (!record || !canUpdateRecord(role, entity, actor.userId, record)) throw forbidden();
}

export function assertAdmin(actor: Actor): void {
  if (isAutomation(actor)) return;
  if (internalRole(actor) !== "Admin") throw forbidden();
}
