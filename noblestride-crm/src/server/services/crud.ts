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

/**
 * Compare two dates at calendar-date (UTC) granularity rather than exact
 * instant. Edit drawers seed date fields as yyyy-mm-dd strings, which the
 * DateTime scalar coerces to UTC midnight; seeded/legacy rows may carry a
 * real time-of-day. An unchanged resend at the UI's date granularity must
 * not be treated as a change.
 */
export function sameCalendarDate(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}
