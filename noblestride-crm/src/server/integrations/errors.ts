// src/server/integrations/errors.ts
// Uniform error for external-integration failures. Mirrors StorageError so
// route handlers/services can map provider failures to an HTTP status.
export class IntegrationError extends Error {
  constructor(message: string, readonly status: number = 502) {
    super(message);
    this.name = "IntegrationError";
  }
}
