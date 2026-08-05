import { test, expect } from "@playwright/test";

/**
 * Happy path: boot → les 1 (NAND) → place NAND → wire → Submit → Verified → les 2 unlocked.
 */
test.describe("NAND leerflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("forge-onboarding-v1", "1");
    });
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Forge Logic");
  });

  test("les 1 NAND submit unlocked les 2", async ({ page }) => {
    await page.locator('[data-select-challenge="nand"]').click();
    await page.locator('[data-open-challenge="nand"]').click();

    await page.evaluate(() => {
      const skipBtn = document.querySelector("[data-tutorial-skip]");
      if (skipBtn) {
        skipBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
      const root = document.getElementById("tutorial-root");
      if (root) {
        root.hidden = true;
      }
    });

    const partsSummary = page.locator(".parts-dropdown summary");
    if (await partsSummary.isVisible()) {
      const dropdown = page.locator(".parts-dropdown");
      const open = await dropdown.evaluate((el) => el.open);
      if (!open) {
        await partsSummary.click();
      }
    }
    await page.locator('[data-part-type="gate-nand"]').click();
    await expect(page.locator("article.gate-nand")).toHaveCount(1);

    async function clickLabelOutput(label) {
      await page
        .locator("article.node")
        .filter({ has: page.locator(".node-label", { hasText: new RegExp(`^${label}$`) }) })
        .locator('[data-pin-direction="output"]')
        .first()
        .click();
    }

    async function clickGateInput(pinKey) {
      await page
        .locator(`article.gate-nand [data-pin-key="${pinKey}"][data-pin-direction="input"]`)
        .click();
    }

    await clickLabelOutput("A");
    await clickGateInput("A");
    await clickLabelOutput("B");
    await clickGateInput("B");

    await page.locator('article.gate-nand [data-pin-key="OUT"][data-pin-direction="output"]').click();
    await page
      .locator("article.node-output-pin")
      .filter({ has: page.locator(".node-label", { hasText: /^OUT$/ }) })
      .locator('[data-pin-key="IN"][data-pin-direction="input"]')
      .click();

    await page.locator('[data-submit-challenge="nand"]').click();

    await expect(page.locator(".challenge-detail-card .challenge-status")).toContainText(/Passed|Gehaald|Verified/, {
      timeout: 15_000,
    });

    await expect(page.locator('[data-select-challenge="not"]')).not.toHaveClass(/locked/);
  });
});
