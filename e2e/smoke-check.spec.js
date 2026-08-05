import { test, expect } from "@playwright/test";

/**
 * Smoke-checks voor de leerapp-onderdelen buiten de NAND-flow:
 * cursusweergave, vrije modus, eindles (ROM+Screen), klok-runner, ROM-inspector.
 */
test.describe("Leerapp smoke", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw new Error(`Page error: ${err.message}`);
    });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("forge-onboarding-v1", "1");
    });
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Forge Logic");
  });

  test("verse gebruiker start op cursusweergave met 5 modules", async ({ page }) => {
    await expect(page.locator("#course-view")).toBeVisible();
    const cards = page.locator("#course-view .course-module-card, #course-view [data-course-module]");
    expect(await cards.count()).toBeGreaterThanOrEqual(5);
    await page.locator('.app-view-tab[data-app-view="workspace"]').click();
    await expect(page.locator(".workspace-frame")).toBeVisible();
    await page.locator('.app-view-tab[data-app-view="course"]').click();
    await expect(page.locator("#course-view")).toBeVisible();
  });

  test("cursus 'Ga verder' opent les 1 met tutorial", async ({ page }) => {
    const continueBtn = page
      .locator("#course-view button", { hasText: /Ga verder|Start/ })
      .first();
    await continueBtn.click();
    await expect(page.locator(".workspace-frame")).toBeVisible();
    await expect(page.locator("#tutorial-root, .tutorial-coachmark")).toBeVisible();
  });

  test("vrije modus unlockt lessen; computer-les opent met ROM en Screen", async ({ page }) => {
    const computerCard = page.locator('[data-select-challenge="computer"]');
    await expect(computerCard).toHaveClass(/locked/);

    const freeToggle = page.locator("#challenge-list input[type=checkbox], #challenge-list [data-free-mode]").first();
    await freeToggle.click();
    await expect(computerCard).not.toHaveClass(/locked/);

    // Klap de module open waarin de computer-les zit.
    await page
      .locator(".challenge-picker-group")
      .filter({ has: page.locator('[data-select-challenge="computer"]') })
      .locator("summary")
      .click();
    await computerCard.click();
    await page.locator('[data-open-challenge="computer"]').click();
    await expect(page.locator("article.node-rom, article.rom")).toHaveCount(1);
    await expect(page.locator("article.node-screen, article.screen")).toHaveCount(1);
  });

  test("klok-runner start en stopt zonder fouten", async ({ page }) => {
    // Plaats een clock + register via Parts zodat er iets te tikken valt.
    const partsSummary = page.locator(".parts-dropdown summary");
    await partsSummary.click();
    await page.locator('[data-part-type="clock"]').click();
    await partsSummary.click();
    await page.locator('[data-part-type="register"]').click();

    const playButton = page.locator("#clock-play-button");
    await playButton.click();
    await expect(playButton).toHaveClass(/is-running/);
    await page.waitForTimeout(1200);
    await playButton.click();
    await expect(playButton).not.toHaveClass(/is-running/);
  });

  test("leskaart heeft tabbladen Theorie/Hints/Tests", async ({ page }) => {
    await page.locator('.app-view-tab[data-app-view="workspace"]').click();
    await page.locator('[data-select-challenge="nand"]').click();

    const tabs = page.locator(".challenge-detail-card .challenge-tab");
    await expect(tabs).toHaveCount(3);

    await page.locator('[data-challenge-tab="hints"]').click();
    await expect(page.locator(".challenge-detail-card .challenge-hints")).toBeVisible();

    await page.locator('[data-challenge-tab="tests"]').click();
    await expect(page.locator(".challenge-detail-card .truth-probe-table")).toBeVisible();

    await page.locator('[data-challenge-tab="theorie"]').click();
    await expect(page.locator(".challenge-detail-card .theory-body")).toBeVisible();
  });

  test("ROM-node inspector accepteert programma", async ({ page }) => {
    const partsSummary = page.locator(".parts-dropdown summary");
    await partsSummary.click();
    await page.locator('[data-part-type="rom"]').click();
    await page.locator("article.node-rom, article.rom").first().click();
    const programField = page.locator("#inspector textarea");
    await expect(programField).toBeVisible();
    await programField.fill("0000000000000101\n1110110000010000");
    await programField.dispatchEvent("input");
    await expect(page.locator("article.node-rom, article.rom").first()).toContainText(/2/);
  });
});
