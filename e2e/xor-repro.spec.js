import { test, expect } from "@playwright/test";

/**
 * Reproductie van gebruikersscenario: XOR bouwen met 4 NAND-gates
 * in de xor-les, live werkend, dan indienen.
 */
test.describe("XOR met NAND repro", () => {
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
    // Ga naar Werkplaats en zet vrije modus aan zodat xor bereikbaar is.
    await page.locator('.app-view-tab[data-app-view="workspace"]').click();
    await page.locator("#challenge-list [data-toggle-free-mode]").click();
  });

  async function placePart(page, type) {
    const dropdown = page.locator(".parts-dropdown");
    const open = await dropdown.evaluate((el) => el.open);
    if (!open) {
      await page.locator(".parts-dropdown summary").click();
    }
    await page.locator(`[data-part-type="${type}"]`).click();
  }

  async function clickLabelOutput(page, label) {
    await page
      .locator("article.node")
      .filter({ has: page.locator(".node-label", { hasText: new RegExp(`^${label}$`) }) })
      .locator('[data-pin-direction="output"]')
      .first()
      .click();
  }

  async function clickNandPin(page, index, pinKey, direction) {
    await page
      .locator("article.gate-nand")
      .nth(index)
      .locator(`[data-pin-key="${pinKey}"][data-pin-direction="${direction}"]`)
      .click();
  }

  async function buildAndSubmitXor(page, challengeId) {
    await page.locator(`[data-select-challenge="${challengeId}"]`).click();
    await page.locator(`[data-open-challenge="${challengeId}"]`).click();

    for (let i = 0; i < 4; i += 1) {
      await placePart(page, "gate-nand");
    }
    await expect(page.locator("article.gate-nand")).toHaveCount(4);

    // n0 = NAND(A,B)
    await clickLabelOutput(page, "A");
    await clickNandPin(page, 0, "A", "input");
    await clickLabelOutput(page, "B");
    await clickNandPin(page, 0, "B", "input");
    // n1 = NAND(A, n0)
    await clickLabelOutput(page, "A");
    await clickNandPin(page, 1, "A", "input");
    await clickNandPin(page, 0, "OUT", "output");
    await clickNandPin(page, 1, "B", "input");
    // n2 = NAND(n0, B)
    await clickNandPin(page, 0, "OUT", "output");
    await clickNandPin(page, 2, "A", "input");
    await clickLabelOutput(page, "B");
    await clickNandPin(page, 2, "B", "input");
    // n3 = NAND(n1, n2) -> OUT
    await clickNandPin(page, 1, "OUT", "output");
    await clickNandPin(page, 3, "A", "input");
    await clickNandPin(page, 2, "OUT", "output");
    await clickNandPin(page, 3, "B", "input");
    await clickNandPin(page, 3, "OUT", "output");
    await page
      .locator("article.node-output-pin")
      .filter({ has: page.locator(".node-label", { hasText: /^OUT$/ }) })
      .locator('[data-pin-key="IN"][data-pin-direction="input"]')
      .click();

    // Zoals de gebruiker: eerst live testen door input A te toggelen.
    await page
      .locator("article.node")
      .filter({ has: page.locator(".node-label", { hasText: /^A$/ }) })
      .locator('[data-node-action="toggle-input-pin"]')
      .first()
      .click();

    // Indienen.
    await page.locator(`[data-submit-challenge="${challengeId}"]`).click();

    await expect(page.locator(".challenge-detail-card .challenge-status")).toContainText(
      /Gehaald|Verified/,
      { timeout: 15_000 }
    );
    await expect(page.locator(".challenge-detail-card .submit-feedback.ok")).toBeVisible();
  }

  test("xor-les: 4-NAND XOR bouwen en indienen", async ({ page }) => {
    await buildAndSubmitXor(page, "xor");

    // Chip-bibliotheek toont de opgeslagen chip als uitklapregel met versiebeheer.
    const seriesCard = page
      .locator("#chip-library .chip-series-card")
      .filter({ has: page.locator(".chip-series-name", { hasText: /^XOR$/ }) });
    await expect(seriesCard).toHaveCount(1);
    await seriesCard.locator("summary").click();
    await expect(seriesCard.locator(".chip-version-row")).toHaveCount(1);
    await expect(
      seriesCard.locator('.chip-version-row [data-edit-chip]')
    ).toBeVisible();
  });

  test("xor-nand-only les: zelfde circuit indienen", async ({ page }) => {
    await buildAndSubmitXor(page, "xor-nand-only");
  });

  test("indienen vanaf verkeerde sheet toont duidelijke feedback", async ({ page }) => {
    // Selecteer de xor-les maar blijf op de gewone hoofdsheet.
    await page.locator('[data-select-challenge="xor"]').click();
    await page.locator('[data-submit-challenge="xor"]').click();

    const feedback = page.locator(".challenge-detail-card .submit-feedback.bad");
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText(/challenge-sheet/);
  });
});
