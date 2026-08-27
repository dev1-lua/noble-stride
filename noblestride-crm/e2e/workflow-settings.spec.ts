// workflow-settings.spec.ts — F4.1.2/image14: workflow templates are
// customisable, and a deal can be pinned to its own template.

import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { IDS } from "./fixtures/seed";
import { MEMBER, loginAs } from "./helpers/login";

test.describe.configure({ mode: "serial" });

const TEMPLATE_NAME = "zz-E2E Advisory template";

// This spec CREATES a template, so it must start from a clean slate: a repeat
// run (or E2E_KEEP=1) would otherwise leave two rows with the same name and
// every row locator would match twice.
test.beforeAll(async () => {
  const prisma = new PrismaClient();
  try {
    const stale = await prisma.workflowTemplate.findMany({
      where: { name: { startsWith: "zz-" } },
      select: { id: true },
    });
    if (stale.length === 0) return;
    const ids = stale.map((t) => t.id);
    await prisma.mandate.updateMany({ where: { workflowTemplateId: { in: ids } }, data: { workflowTemplateId: null } });
    await prisma.transaction.updateMany({ where: { workflowTemplateId: { in: ids } }, data: { workflowTemplateId: null } });
    await prisma.advisoryEngagement.updateMany({ where: { workflowTemplateId: { in: ids } }, data: { workflowTemplateId: null } });
    // Never leave the org without a default.
    const seeded = await prisma.workflowTemplate.findFirst({ where: { name: "Default Transaction Advisory Workflow" }, select: { id: true } });
    if (seeded) {
      await prisma.workflowTemplate.updateMany({ where: { id: { in: ids } }, data: { isDefault: false } });
      await prisma.workflowTemplate.update({ where: { id: seeded.id }, data: { isDefault: true } });
    }
    await prisma.workflowTemplate.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await prisma.$disconnect();
  }
});

test.describe("F4.1 text 3 — stages are customisable and new templates can be created per deal", () => {
  test("the default template is badged and cannot be deleted", async ({ page }) => {
    await page.goto("/settings/workflows");
    await expect(page.getByRole("heading", { name: "Workflow templates" })).toBeVisible();
    const defaultRow = page.getByTestId("wf-template-row").filter({ hasText: "Default Transaction Advisory Workflow" });
    await expect(defaultRow.getByTestId("wf-default-badge")).toBeVisible();
    await expect(defaultRow.getByTestId("wf-delete")).toBeDisabled();
    // Nothing else may claim the badge.
    await expect(page.getByTestId("wf-default-badge")).toHaveCount(1);
  });

  test("creates a template, edits its steps, and assigns it to a deal", async ({ page }) => {
    await page.goto("/settings/workflows");
    await page.getByTestId("wf-new-name").fill(TEMPLATE_NAME);
    await page.getByTestId("wf-new-submit").click();

    // Lands on the editor, pre-filled with a copy of the 13 default steps.
    await expect(page).toHaveURL(/\/settings\/workflows\/.+/, { timeout: 30_000 });
    await expect(page.getByTestId("wf-step-row")).toHaveCount(13);

    // Drop the five investor-facing steps an advisory assignment never uses.
    for (let i = 0; i < 5; i += 1) {
      await page.getByTestId("wf-step-row").last().getByTestId("wf-step-remove").click();
    }
    await expect(page.getByTestId("wf-step-row")).toHaveCount(8);

    // Add an advisory-specific step and move it up once.
    await page.getByTestId("wf-step-add").click();
    const added = page.getByTestId("wf-step-row").last();
    await added.getByTestId("wf-step-title").fill("Deliverables handover");
    await added.getByTestId("wf-step-phase").selectOption("Execute");
    await expect(page.getByTestId("wf-step-row")).toHaveCount(9);

    await page.getByTestId("wf-save").click();
    await expect(page.locator("text=Saved.")).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByTestId("wf-step-row")).toHaveCount(9);
    // Titles live in <input value>, which innerText does not expose.
    await expect(page.getByTestId("wf-step-row").last().getByTestId("wf-step-title")).toHaveValue("Deliverables handover");
    await expect(page.getByTestId("wf-step-row").last()).toContainText("deliverablesHandover");

    // Assign it to the advisory deal and confirm the card picks it up.
    await page.goto(`/advisory/${IDS.advisory}`);
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("Workflow template").selectOption({ label: TEMPLATE_NAME });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("workflow-template-name")).toHaveText(TEMPLATE_NAME, { timeout: 30_000 });
    await expect(page.getByTestId("workflow-progress")).toHaveText(/\d+ of \d+ steps complete/);
  });

  test("Set default flips exactly one badge, then restores", async ({ page }) => {
    await page.goto("/settings/workflows");
    const zzRow = page.getByTestId("wf-template-row").filter({ hasText: TEMPLATE_NAME });
    await zzRow.getByTestId("wf-set-default").click();
    await expect(page.getByTestId("wf-default-badge")).toHaveCount(1, { timeout: 30_000 });
    await expect(page.getByTestId("wf-template-row").filter({ hasText: TEMPLATE_NAME }).getByTestId("wf-default-badge")).toBeVisible();

    const defaultRow = page.getByTestId("wf-template-row").filter({ hasText: "Default Transaction Advisory Workflow" });
    await defaultRow.getByTestId("wf-set-default").click();
    await expect(page.getByTestId("wf-default-badge")).toHaveCount(1, { timeout: 30_000 });
    await expect(
      page.getByTestId("wf-template-row").filter({ hasText: "Default Transaction Advisory Workflow" }).getByTestId("wf-default-badge"),
    ).toBeVisible();
  });

  test("deleting a template in use is refused, and works once unassigned", async ({ page }) => {
    await page.goto("/settings/workflows");
    const zzRow = page.getByTestId("wf-template-row").filter({ hasText: TEMPLATE_NAME });
    // Still assigned to the advisory deal → the button is disabled with a reason.
    await expect(zzRow.getByTestId("wf-delete")).toBeDisabled();
    await expect(zzRow.getByTestId("wf-delete")).toHaveAttribute("title", /still use this template/);

    await page.goto(`/advisory/${IDS.advisory}`);
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("Workflow template").selectOption("");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("workflow-template-name")).toHaveText("Default Transaction Advisory Workflow", { timeout: 30_000 });

    await page.goto("/settings/workflows");
    await page.getByTestId("wf-template-row").filter({ hasText: TEMPLATE_NAME }).getByTestId("wf-delete").click();
    await expect(page.getByTestId("wf-template-row").filter({ hasText: TEMPLATE_NAME })).toHaveCount(0, { timeout: 30_000 });
  });

  test("a TeamMember cannot reach the admin settings pages", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    try {
      await loginAs(page, MEMBER);
      for (const path of ["/settings/app", "/settings/workflows"]) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
      }
    } finally {
      await ctx.close();
    }
  });
});
