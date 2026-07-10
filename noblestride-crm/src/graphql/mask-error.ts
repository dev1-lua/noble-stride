// mask-error.ts — GraphQL error masking with domain-error passthrough.
//
// graphql-yoga masks every non-GraphQLError thrown in a resolver to the
// literal "Unexpected error." — which hid deliberate domain rules (e.g. the
// SOW §06 NDA guard) behind a generic failure the UI can't explain. This
// maskError keeps Yoga's default masking for genuinely unexpected errors but
// lets expected, user-facing domain errors through with their real message.

import { GraphQLError } from "graphql";
import { maskError as yogaMaskError } from "graphql-yoga";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { NdaGuardError } from "@/server/domain/nda-guard";
import { CrudError } from "@/server/services/crud";
import { RegistrationError } from "@/server/onboarding/register-investor";
import { IntegrationError } from "@/server/integrations/errors";

/** Errors whose message is written for end users and safe to surface. */
function userFacingMessage(error: unknown): string | null {
  if (
    error instanceof NdaGuardError ||
    error instanceof CrudError ||
    error instanceof RegistrationError
  ) {
    return error.message;
  }
  // Integration "not configured" gates (status 503) carry a fixed, user-safe
  // message ("… not configured") and are reachable only as defense-in-depth
  // when a flag is off — surface it so the UI can explain the dormant state.
  // Real upstream provider failures use status 502 and stay masked, so their
  // status codes / API detail never leak to clients.
  if (error instanceof IntegrationError && error.status === 503) {
    return error.message;
  }
  // Stale id (e.g. a kanban card rendered before a reseed) → row is gone.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return "Record not found — refresh the page and try again.";
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    if (!issue) return "Invalid input.";
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  }
  return null;
}

/**
 * Drop-in for Yoga's `maskedErrors.maskError`. graphql-js wraps resolver
 * throws in a GraphQLError with `originalError` set, so unwrap first.
 */
export function maskDomainError(error: unknown, message: string, isDev?: boolean): Error {
  // Intentional GraphQLError (no wrapped resolver throw) — surface as-is.
  // Checked here with OUR graphql instance: yoga's own check can miss it
  // when two graphql copies are loaded (then it would over-mask).
  if (error instanceof GraphQLError && !error.originalError) return error;
  const original =
    error instanceof GraphQLError && error.originalError ? error.originalError : error;
  const userMessage = userFacingMessage(original);
  if (userMessage !== null) return new GraphQLError(userMessage);
  return yogaMaskError(error, message, isDev);
}
