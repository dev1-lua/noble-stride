// app-settings.spec.ts — image29/30: the portal's finance tiles and milestone
// checklist are hidden by default with an admin toggle, and the public agent
// can be switched off.

import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("image30 / G3 — an admin decides what the investor portal shows", () => {
  test("shows the three switches at their seeded values", async ({ page }) => {
    await page.goto("/settings/app");
    await expect(page.getByRole("heading", { name: "App settings" })).toBeVisible();
    await expect(page.getByTestId("setting-portal.dashboard.financeTiles").getByRole("switch")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("setting-portal.deal.milestones").getByRole("switch")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("setting-agent.client.enabled").getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  test("a toggle persists across a reload", async ({ page }) => {
    await page.goto("/settings/app");
    const row = page.getByTestId("setting-portal.dashboard.financeTiles");
    await row.getByRole("switch").click();
    await expect(row.getByRole("switch")).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });

    await page.reload();
    await expect(page.getByTestId("setting-portal.dashboard.financeTiles").getByRole("switch")).toHaveAttribute("aria-checked", "true");

    // restore
    await page.getByTestId("setting-portal.dashboard.financeTiles").getByRole("switch").click();
    await expect(page.getByTestId("setting-portal.dashboard.financeTiles").getByRole("switch")).toHaveAttribute("aria-checked", "false", { timeout: 30_000 });
  });

  test("switching the public agent off falls back to the intake form on /talk-to-us", async ({ page }) => {
    await page.goto("/settings/app");
    const row = page.getByTestId("setting-agent.client.enabled");
    await row.getByRole("switch").click();
    await expect(row.getByRole("switch")).toHaveAttribute("aria-checked", "false", { timeout: 30_000 });

    // The setting cache has a 30s TTL, so poll until the page reflects it.
    await expect(async () => {
      await page.goto("/talk-to-us");
      await expect(page.locator("body")).toContainText("Chat is not configured");
    }).toPass({ timeout: 60_000 });

    await page.goto("/settings/app");
    await page.getByTestId("setting-agent.client.enabled").getByRole("switch").click();
    await expect(page.getByTestId("setting-agent.client.enabled").getByRole("switch")).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
  });
});
