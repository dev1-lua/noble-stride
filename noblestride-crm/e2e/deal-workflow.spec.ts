// deal-workflow.spec.ts — F4.1.1–4.1.3 + G2 (image13/15): the Deal Workflow
// card replaces the fixed 17-step journey, completes steps from real records,
// links each step to its evidence, and lets the team mark/reopen/move steps.

import { test, expect } from "@playwright/test";
import { IDS } from "./fixtures/seed";

const MANDATE = `/mandates/${IDS.mandate}`;
const TRANSACTION = `/transactions/${IDS.transaction}`;
const ADVISORY = `/advisory/${IDS.advisory}`;

test.describe.configure({ mode: "serial" });

test.describe("deal workflow card", () => {
  test("mandate shows the default template, three phases and evidence-derived steps", async ({ page }) => {
    await page.goto(MANDATE);
    const card = page.getByTestId("deal-workflow");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("workflow-template-name")).toHaveText("Default Transaction Advisory Workflow");

    for (const phase of ["Qualify", "Prepare", "Execute"]) {
      await expect(page.getByTestId(`workflow-phase-${phase}`)).toBeVisible();
    }

    // 12 of the 13 steps apply to a mandate (assignmentScoping is Advisory-only).
    await expect(page.getByTestId("workflow-progress")).toHaveText(/\d+ of 12 steps complete/);

    // Evidence: NDA signed on the fixture, and a lead is assigned.
    await expect(page.getByTestId("workflow-step-ndaSigned")).toHaveAttribute("data-status", "done");
    await expect(page.getByTestId("workflow-step-dealApproved")).toHaveAttribute("data-status", "done");
    await expect(page.getByTestId("workflow-step-newOpportunity")).toHaveAttribute("data-status", "done");

    // Advisory-only step must be absent on a mandate.
    await expect(page.getByTestId("workflow-step-assignmentScoping")).toHaveCount(0);

    // Step cards link to the record that evidences them.
    const prep = page.getByTestId("workflow-step-opportunityPreparation").getByTestId("workflow-step-link");
    await expect(prep).toHaveAttribute("href", /#documents-by-stage$|^https:\/\/vdr\./);
  });

  test("transaction resolves its OWN workflow and links opportunityPreparation to the VDR", async ({ page }) => {
    await page.goto(TRANSACTION);
    await expect(page.getByTestId("deal-workflow")).toBeVisible();
    const link = page.getByTestId("workflow-step-opportunityPreparation").getByTestId("workflow-step-link");
    await expect(link).toHaveAttribute("href", "https://vdr.example.test/zz");
    await expect(page.getByTestId("workflow-step-opportunityPreparation")).toHaveAttribute("data-status", "done");
    // An engagement exists on the fixture → investorOutreach + investorInterest done.
    await expect(page.getByTestId("workflow-step-investorOutreach")).toHaveAttribute("data-status", "done");
    await expect(page.getByTestId("workflow-step-investorInterest")).toHaveAttribute("data-status", "done");
  });

  test("advisory keeps assignmentScoping and drops dealAnalysis", async ({ page }) => {
    await page.goto(ADVISORY);
    await expect(page.getByTestId("workflow-step-assignmentScoping")).toBeVisible();
    await expect(page.getByTestId("workflow-step-dealAnalysis")).toHaveCount(0);
    await expect(page.getByTestId("workflow-progress")).toHaveText(/\d+ of 12 steps complete/);
  });

  test("Mark done records a manual completion with a note, and Reopen undoes it", async ({ page }) => {
    await page.goto(MANDATE);
    let step = page.getByTestId("workflow-step-internalReview");

    // Self-preparing: a previous run (or the Move-deal-here test) may have left
    // this step done, so reopen it first. Keeps the spec idempotent when
    // fixtures are kept between runs (E2E_KEEP=1).
    if ((await step.getAttribute("data-status")) === "done") {
      page.once("dialog", (d) => d.accept("reset by the e2e suite"));
      await step.getByTestId("workflow-reopen").click();
      await expect(page.getByTestId("workflow-step-internalReview")).not.toHaveAttribute("data-status", "done", { timeout: 20_000 });
      step = page.getByTestId("workflow-step-internalReview");
    }
    await expect(step).not.toHaveAttribute("data-status", "done");

    page.once("dialog", (d) => d.accept("Reviewed by the e2e suite"));
    await step.getByTestId("workflow-mark-done").click();
    await expect(page.getByTestId("workflow-step-internalReview")).toHaveAttribute("data-status", "done", { timeout: 20_000 });
    await expect(page.getByTestId("workflow-step-internalReview")).toContainText("Reviewed by the e2e suite");

    // Audit trail: Stage History carries a workflowStep row.
    await expect(page.locator("body")).toContainText("internalReview:complete");

    page.once("dialog", (d) => d.accept("Needs another pass"));
    await page.getByTestId("workflow-step-internalReview").getByTestId("workflow-reopen").click();
    await expect(page.getByTestId("workflow-step-internalReview")).not.toHaveAttribute("data-status", "done", { timeout: 20_000 });
    await expect(page.getByTestId("workflow-step-internalReview")).toContainText("Reopened by");
  });

  test("Move deal here completes every earlier open step (G2)", async ({ page }) => {
    await page.goto(MANDATE);

    // Target the LAST step so the assertion holds whatever the evidence rules
    // have already completed: moving there must close every earlier step and
    // leave the target current.
    const target = page.getByTestId("workflow-step-successFee");
    await expect(target.getByTestId("workflow-move-here")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await target.getByTestId("workflow-move-here").click();

    await expect(page.getByTestId("workflow-step-successFee")).toHaveAttribute("data-status", "current", { timeout: 20_000 });
    await expect(page.getByTestId("workflow-progress")).toHaveText("11 of 12 steps complete");
    for (const key of [
      "newOpportunity", "initialEvaluation", "ndaSigned", "dealAnalysis", "dealApproved",
      "opportunityPreparation", "internalReview", "investorOutreach", "investorInterest",
      "threePartyDiscussions", "termSheet",
    ]) {
      await expect(page.getByTestId(`workflow-step-${key}`)).toHaveAttribute("data-status", "done");
    }
    await expect(page.locator("body")).toContainText("Workflow moved to Success Fee");
  });

  test('the enum stage control is labelled "Pipeline status" with the disambiguating help text', async ({ page }) => {
    await page.goto(MANDATE);
    await expect(page.locator("#pipeline-status")).toContainText("Pipeline status");
    await expect(page.getByTestId("pipeline-status-help")).toContainText(
      "Progress through the deal itself is tracked in the Deal Workflow above",
    );
  });
});
