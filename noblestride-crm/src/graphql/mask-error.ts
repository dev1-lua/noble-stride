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
 * Duck-typed rather than `instanceof GraphQLError`: this schema's execution
 * path (@graphql-tools/executor, under graphql-yoga) can hand back a
 * GraphQLError constructed against a different loaded copy of the "graphql"
 * package than the one this file imports, so `instanceof` silently returns
 * false for a real GraphQLError (see the "another module or realm" note in
 * esign-mutation.smoke.test.ts). Checking for the shape (an object with an
 * `originalError` property — GraphQLError always defines one) is realm-proof.
 */
function hasOriginalError(value: unknown): value is { originalError: unknown } {
  return typeof value === "object" && value !== null && "originalError" in value;
}

/**
 * Unwrap nested `originalError` chains down to the real thrown value.
 * graphql-js's `locatedError` wraps a resolver throw in a GraphQLError with
 * `originalError` set to the raw error — but this schema's execution path
 * (Pothos resolvers under @graphql-tools/executor) locates the error TWICE,
 * once inside Pothos's own field wrapping and once in the top-level executor,
 * producing GraphQLError -> GraphQLError -> <real error>. A single-level
 * unwrap only reaches the intermediate GraphQLError (whose `instanceof
 * CrudError` etc. checks always fail), so this recurses until it hits
 * something that isn't itself GraphQLError-shaped with an originalError.
 */
function unwrapOriginalError(error: unknown): unknown {
  let current = error;
  const seen = new Set<unknown>();
  while (
    hasOriginalError(current) &&
    current.originalError != null &&
    current.originalError !== current &&
    !seen.has(current)
  ) {
    seen.add(current);
    current = current.originalError;
  }
  return current;
}

/**
 * Drop-in for Yoga's `maskedErrors.maskError`. graphql-js wraps resolver
 * throws in a GraphQLError with `originalError` set, so unwrap first.
 */
export function maskDomainError(error: unknown, message: string, isDev?: boolean): Error {
  // Intentional GraphQLError (no wrapped resolver throw) — surface as-is.
  // Duck-typed (see hasOriginalError above) rather than `instanceof
  // GraphQLError`, for the same realm-safety reason.
  if (hasOriginalError(error) && error.originalError == null) return error as unknown as Error;
  const original = unwrapOriginalError(error);
  const userMessage = userFacingMessage(original);
  if (userMessage !== null) return new GraphQLError(userMessage);
  return yogaMaskError(error, message, isDev);
}
