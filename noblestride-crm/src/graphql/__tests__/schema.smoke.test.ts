// GraphQL schema smoke test.
// Always-run: verifies the schema builds (no DB required) — schema-build assertion.
// DB-guarded: verifies the dashboardStats service resolves via the schema's resolver
//             (skipped when DATABASE_URL is unset, matching the Tasks 4–7 smoke pattern).

import { describe, it, expect } from "vitest";

/** Helper: run `fn`, skip on DB errors, re-throw unexpected errors. */
async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping DB smoke test");
    return null;
  }
  try {
    return await fn();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("connect") ||
      message.includes("Can't reach database") ||
      message.includes("P1001") ||
      message.includes("P1002")
    ) {
      console.log("DB unreachable — skipping smoke test:", message);
      return null;
    }
    throw err;
  }
}

describe("graphql schema", () => {
  it("builds without errors and exposes a query type with 41 queries and 71 mutations", async () => {
    // Dynamic import so the module graph is resolved lazily — errors surface here.
    const { schema } = await import("@/graphql/schema");
    expect(schema).toBeTruthy();

    const queryType = schema.getQueryType();
    expect(queryType).toBeTruthy();
    const queryFields = Object.keys(queryType?.getFields() ?? {});
    expect(queryFields).toHaveLength(41);

    const mutationType = schema.getMutationType();
    expect(mutationType).toBeTruthy();
    const mutationFields = Object.keys(mutationType?.getFields() ?? {});
    expect(mutationFields).toHaveLength(71);

    // Spot-check that key query fields exist
    expect(queryFields).toContain("dashboardStats");
    expect(queryFields).toContain("investors");
    expect(queryFields).toContain("mandatesByStage");
    expect(queryFields).toContain("advisoryEngagements");
    expect(queryFields).toContain("advisoryByStage");
    expect(queryFields).toContain("advisoryEngagement");
    expect(queryFields).toContain("aiAsk");
    expect(queryFields).toContain("documents");
    expect(queryFields).toContain("document");
    expect(queryFields).toContain("savedViews");
    expect(queryFields).toContain("myUnreadNotifications");
    expect(queryFields).toContain("myUnreadNotificationCount");
    expect(queryFields).toContain("globalSearch");
    expect(queryFields).toContain("checkCompany");
    expect(queryFields).toContain("resolveStaffUser");
    expect(queryFields).toContain("clientStatus");
    expect(queryFields).toContain("investorByEmail");
    expect(queryFields).toContain("matchInvestorsForTransaction");
    expect(queryFields).toContain("transactionTeaserContext");

    // Spot-check mutation fields
    expect(mutationFields).toContain("updateMandateStage");
    expect(mutationFields).toContain("updateTransactionStage");
    expect(mutationFields).toContain("updateAdvisoryStage");
    expect(mutationFields).toContain("createAdvisory");
    expect(mutationFields).toContain("updateAdvisory");
    expect(mutationFields).toContain("deleteAdvisory");
    expect(mutationFields).toContain("logEngagement");
    expect(mutationFields).toContain("logActivity");
    expect(mutationFields).toContain("createEngagement");
    expect(mutationFields).toContain("updateEngagement");
    expect(mutationFields).toContain("createServiceProvider");
    expect(mutationFields).toContain("updateServiceProvider");
    expect(mutationFields).toContain("deleteServiceProvider");
    expect(mutationFields).toContain("createDocument");
    expect(mutationFields).toContain("updateDocument");
    expect(mutationFields).toContain("deleteDocument");
    expect(mutationFields).toContain("setInvestorOnboardingStatus");
    expect(mutationFields).toContain("greylistInvestor");
    expect(mutationFields).toContain("markInvestorCriteriaVerified");
    expect(mutationFields).toContain("recordOpenNda");
    expect(mutationFields).toContain("recordClosedNda");
    expect(mutationFields).toContain("sendEsignEnvelope");
    expect(mutationFields).toContain("shareDocumentViaBox");
    expect(mutationFields).toContain("scheduleMeeting");
    expect(mutationFields).toContain("createTask");
    expect(mutationFields).toContain("updateTask");
    expect(mutationFields).toContain("deleteTask");
    expect(mutationFields).toContain("createPerson");
    expect(mutationFields).toContain("updatePerson");
    expect(mutationFields).toContain("deletePerson");
    expect(mutationFields).toContain("recordMilestone");
    expect(mutationFields).toContain("unrecordMilestone");
    expect(mutationFields).toContain("upsertDueDiligenceTrack");
    expect(mutationFields).toContain("deleteDueDiligenceTrack");
    expect(mutationFields).toContain("createSavedView");
    expect(mutationFields).toContain("renameSavedView");
    expect(mutationFields).toContain("deleteSavedView");
    expect(mutationFields).toContain("submitWebsiteIntake");
    expect(mutationFields).toContain("acceptIntakeMandate");
    expect(mutationFields).toContain("deprioritizeIntakeMandate");
    expect(mutationFields).toContain("rerunQualification");
    expect(mutationFields).toContain("markNotificationsRead");
    expect(mutationFields).toContain("markAllNotificationsRead");
    expect(mutationFields).toContain("submitClientIntake");
    expect(mutationFields).toContain("logInboundClientMessage");
    expect(mutationFields).toContain("agentPrepareWrite");
    expect(mutationFields).toContain("agentCommitWrite");
    expect(mutationFields).toContain("agentCancelWrite");
    expect(mutationFields).toContain("requestClientStatusOtp");
    expect(mutationFields).toContain("verifyClientStatusOtp");
    expect(mutationFields).toContain("submitInvestorUpdate");
    expect(mutationFields).toContain("logInvestorCommunication");
    expect(mutationFields).toContain("saveOutreachDrafts");
    // No delete-shaped operation is ever exposed on the agent write surface
    // (spec: the agent may create/update, never delete) — guard against a
    // future registry entry accidentally growing a matching mutation.
    expect(mutationFields.some((f) => /^agentDelete/i.test(f))).toBe(false);
  });

  it("Task links to Partner (referral review tasks — spec §3.8 link rule extension)", async () => {
    const { schema } = await import("@/graphql/schema");
    const taskInput = schema.getType("TaskInput") as { getFields: () => Record<string, unknown> } | undefined;
    expect(taskInput).toBeTruthy();
    expect(Object.keys(taskInput!.getFields())).toContain("partnerId");
    const taskType = schema.getType("Task") as { getFields: () => Record<string, unknown> } | undefined;
    expect(taskType).toBeTruthy();
    const taskFields = Object.keys(taskType!.getFields());
    expect(taskFields).toContain("partnerId");
    expect(taskFields).toContain("partner");
  });

  it("ClientStatusPayload exposes exactly the 10 whitelisted fields (spec 2026-07-14 §5.3)", async () => {
    // Locks the payload's field list at the schema level: adding a field here
    // is a spec violation regardless of how "harmless" it looks, so this test
    // must fail the moment a future change grows (or shrinks) the shape.
    const { schema } = await import("@/graphql/schema");
    const payloadType = schema.getType("ClientStatusPayload");
    expect(payloadType).toBeTruthy();

    // GraphQLObjectType is the only kind that exposes getFields() with field args.
    const fields = (payloadType as { getFields: () => Record<string, { type: unknown }> }).getFields();
    const shape = Object.fromEntries(
      Object.entries(fields)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, f]) => [name, String(f.type)]),
    );

    // Exact name → type map (nullability mirrors the service interface; the
    // three nullable fields are nullable there too, arrays are [String!]!).
    expect(shape).toEqual({
      applicationState: "String!",
      coarseStage: "String",
      companyName: "String!",
      engagementAgreementStatus: "String",
      lastUpdated: "String!",
      ndaStatus: "String",
      nextStep: "String!",
      preparedDocuments: "[String!]!",
      stageMessage: "String!",
      submittedRaise: "String",
    });
  });

  it("dashboardStats service resolves correctly (DB-guarded)", async () => {
    // Tests the resolver's backing service — same pattern as Tasks 4-7 smoke tests.
    // Using the service directly avoids cross-module-realm issues with graphql@17 in vitest.
    await withDb(async () => {
      const { dashboardStats } = await import("@/server/services/dashboard");
      const stats = await dashboardStats();
      expect(stats).toBeTruthy();
      expect(typeof stats.activeMandates.value).toBe("number");
      expect(typeof stats.activeMandates.delta).toBe("number");
      expect(typeof stats.activeTransactions.value).toBe("number");
      expect(typeof stats.activeTransactions.delta).toBe("number");
    });
  });
});
