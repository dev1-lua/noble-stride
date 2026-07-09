import { describe, it, expect } from "vitest";
import { GraphQLError } from "graphql";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { maskDomainError } from "../mask-error";
import { NdaGuardError, assertStageAllowed } from "@/server/domain/nda-guard";
import { CrudError } from "@/server/services/crud";
import { RegistrationError } from "@/server/onboarding/register-investor";

const MASK = "Unexpected error.";

describe("maskDomainError", () => {
  it("passes NdaGuardError messages through as GraphQLError", () => {
    const err = new NdaGuardError('Stage "NDASigned" requires a signed NDA.');
    const masked = maskDomainError(err, MASK);
    expect(masked).toBeInstanceOf(GraphQLError);
    expect(masked.message).toContain("requires a signed NDA");
  });

  it("unwraps graphql-js wrapping (GraphQLError.originalError)", () => {
    // graphql-js wraps resolver throws in a located GraphQLError whose
    // message is copied but whose class is no longer NdaGuardError.
    let domainErr: Error;
    try {
      assertStageAllowed("NDASigned", { ndaStatus: "None" }, { ndaType: null });
      throw new Error("guard did not throw");
    } catch (e) {
      domainErr = e as Error;
    }
    const wrapped = new GraphQLError(domainErr.message, { originalError: domainErr });
    const masked = maskDomainError(wrapped, MASK);
    expect(masked.message).toContain("requires a signed NDA");
  });

  it("passes CrudError and RegistrationError through", () => {
    expect(maskDomainError(new CrudError("Delete blocked: 3 documents attached."), MASK).message).toBe(
      "Delete blocked: 3 documents attached.",
    );
    expect(
      maskDomainError(new RegistrationError("Email already registered."), MASK).message,
    ).toBe("Email already registered.");
  });

  it("maps Prisma P2025 (record not found) to a refresh hint", () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError("No record was found", {
      code: "P2025",
      clientVersion: "0.0.0",
    });
    expect(maskDomainError(p2025, MASK).message).toMatch(/refresh the page/i);
  });

  it("maps ZodError to the first issue with its path", () => {
    const zerr = new ZodError([
      { code: "custom", message: "Required", path: ["engagementStage"] },
    ]);
    expect(maskDomainError(zerr, MASK).message).toBe("engagementStage: Required");
  });

  it("still masks unexpected errors", () => {
    const masked = maskDomainError(new Error("connect ECONNREFUSED 127.0.0.1:5544"), MASK);
    expect(masked.message).toBe(MASK);
    expect(masked.message).not.toContain("ECONNREFUSED");
  });

  it("leaves intentional GraphQLErrors alone", () => {
    const masked = maskDomainError(new GraphQLError("Not authorized"), MASK);
    expect(masked.message).toBe("Not authorized");
  });
});
