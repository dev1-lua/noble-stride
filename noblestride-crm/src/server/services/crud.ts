// Shared helpers for the entity CRUD services.
// No GraphQL/React imports — thin domain layer only.

import type { Actor } from "@/graphql/context";
import type { ActorSource } from "@prisma/client";

/** Thrown when a delete is blocked because dependent records exist. */
export class CrudError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrudError";
  }
}

/** Map the request actor to the provenance enum stamped on created records. */
export function actorSource(actor: Actor): ActorSource {
  if (actor.type === "AGENT") return "AGENT";
  if (actor.type === "API") return "API";
  return "HUMAN";
}
