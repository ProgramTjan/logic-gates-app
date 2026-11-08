import { test, expect } from "@playwright/test";
import { skipTutorial } from "./helpers.js";

async function clickOutput(page, label) {
  await page
    .locator("article.node")
    .filter({ has: page.locator(".node-label", { hasText: new RegExp(`^${label}$`) }) })
    .locator('[data-pin-direction="output"]')
    .first()
    .click();
}

async function clickOutputPinInput(page, label) {
  await page
    .locator("article.node-output-pin")
    .filter({ has: page.locator(".node-label", { hasText: new RegExp(`^${label}$`) }) })
    .locator('[data-pin-direction="input"]')
    .click();
}

/**
 * Happy path voor een nieuwe gebruiker: welkom → les 0 "Licht aan" met coach
 * → vrij bouwen ontgrendeld → les 1 NAND → les 2 ontgrendeld.
 */
test.describe("Leerflow nieuwe gebruiker", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw new Error(`Page error: ${err.message}`);
    });
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Forge Logic");
  });

  test("les 0 met coach, daarna les 1 NAND", async ({ page }) => {
    // Geen welkomst-overlay meer; het startscherm zelf verwelkomt.
    await expect(page.locator("#onboarding-overlay")).toHaveCount(0);
    await expect(page.locator(".course-hero.is-welcome")).toBeVisible();
    await expect(page.locator("#nav-sandbox")).toHaveClass(/locked/);

    await page.locator("[data-course-continue]").click();
    const coach = page.locator("[data-tutorial-coach]");
    const coachText = page.locator("[data-tutorial-text]");
    await expect(coach).toBeVisible();

    // Twee uitlegstappen bevestigen.
    await page.locator("[data-tutorial-ack]").click();
    await page.locator("[data-tutorial-ack]").click();

    // Coach wijst naar Parts → AND plaatsen.
    await expect(coachText).toContainText("AND");
    await page.locator(".parts-dropdown summary").click();
    await page.locator('[data-part-type="gate-and"]').click();
    await expect(page.locator("article.gate-and")).toHaveCount(1);

    // Draden; na het kiezen van de bron schakelt de coach naar "klik een input".
    await clickOutput(page, "DOOR");
    await expect(coachText).toContainText(/input/i);
    await page.locator('article.gate-and [data-pin-key="A"][data-pin-direction="input"]').click();
    await clickOutput(page, "ALARM");
    await page.locator('article.gate-and [data-pin-key="B"][data-pin-direction="input"]').click();
    await page.locator('article.gate-and [data-pin-key="OUT"][data-pin-direction="output"]').click();
    await clickOutputPinInput(page, "LAMP");

    // Testen met de schakelaars.
    await expect(coachText).toContainText("DOOR");
    await page
      .locator("article.node")
      .filter({ has: page.locator(".node-label", { hasText: /^DOOR$/ }) })
      .locator('[data-node-action="toggle-input-pin"]')
      .click();
    await expect(coachText).toContainText("ALARM");
    await page
      .locator("article.node")
      .filter({ has: page.locator(".node-label", { hasText: /^ALARM$/ }) })
      .locator('[data-node-action="toggle-input-pin"]')
      .click();
    await expect(page.locator(".live-check-summary")).toHaveClass(/ok/);

    await page.locator('[data-submit-challenge="intro-light"]').click();
    await expect(coach).toBeHidden();
    await expect(page.locator('[data-lesson-step="check"]')).toHaveClass(/is-done/);
    await expect(page.locator("#nav-sandbox")).not.toHaveClass(/locked/);

    // Door naar les 1 (NAND).
    await page.locator('[data-next-lesson="nand"]').click();
    await skipTutorial(page);
    await page.locator(".parts-dropdown summary").click();
    await page.locator('[data-part-type="gate-nand"]').click();
    await clickOutput(page, "A");
    await page.locator('article.gate-nand [data-pin-key="A"][data-pin-direction="input"]').click();
    await clickOutput(page, "B");
    await page.locator('article.gate-nand [data-pin-key="B"][data-pin-direction="input"]').click();
    await page.locator('article.gate-nand [data-pin-key="OUT"][data-pin-direction="output"]').click();
    await clickOutputPinInput(page, "OUT");

    await page.locator('[data-submit-challenge="nand"]').click();
    await expect(page.locator(".challenge-detail-card .challenge-status")).toContainText(/Passed|Gehaald|Verified/, {
      timeout: 15_000,
    });
    await expect(page.locator('[data-next-lesson="not"]')).toBeVisible();

    // Nogmaals controleren zonder wijziging → geen nieuwe chipversie.
    const countDefinitions = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("forge-logic-project-v2") || "{}").chipDefinitions?.length || 0);
    await expect.poll(countDefinitions).toBeGreaterThan(0);
    const versionsBefore = await countDefinitions();
    await page.locator('[data-submit-challenge="nand"]').click();
    await page.waitForTimeout(600);
    expect(await countDefinitions()).toBe(versionsBefore);
  });

  test("Laat zien hoe start de coach opnieuw na overslaan", async ({ page }) => {
    await page.locator("[data-course-continue]").click();
    await expect(page.locator("[data-tutorial-coach]")).toBeVisible();
    await page.locator("[data-tutorial-skip]").click();
    await expect(page.locator("[data-tutorial-coach]")).toBeHidden();

    // Opnieuw openen: blijft weg (overgeslagen voor deze les)…
    await page.locator("#challenge-list .lesson-back").click();
    await page.locator("[data-course-continue]").click();
    await expect(page.locator("[data-tutorial-coach]")).toBeHidden();

    // …maar de knop in de Bouw-stap haalt hem terug.
    await page.locator('[data-coach-start="intro-light"]').click();
    await expect(page.locator("[data-tutorial-coach]")).toBeVisible();
  });
});
