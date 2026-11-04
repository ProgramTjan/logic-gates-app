import { test, expect } from "@playwright/test";
import { openSandbox } from "./helpers.js";

/**
 * Multi-selectie en klembord: Ctrl+A, Shift+slepen (marquee),
 * kopiëren/plakken over sheets heen, groep-slepen.
 */
test.describe("Selectie & klembord", () => {
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
    await openSandbox(page);
  });

  async function placePart(page, type) {
    const dropdown = page.locator(".parts-dropdown");
    const open = await dropdown.evaluate((el) => el.open);
    if (!open) {
      await page.locator(".parts-dropdown summary").click();
    }
    await page.locator(`[data-part-type="${type}"]`).click();
  }

  test("Ctrl+A + kopiëren/plakken naar andere sheet (met draden)", async ({ page }) => {
    await placePart(page, "gate-nand");
    await placePart(page, "gate-nand");
    // Verbind OUT van de eerste met input A van de tweede.
    await page
      .locator("article.gate-nand")
      .nth(0)
      .locator('[data-pin-key="OUT"][data-pin-direction="output"]')
      .click();
    await page
      .locator("article.gate-nand")
      .nth(1)
      .locator('[data-pin-key="A"][data-pin-direction="input"]')
      .click();

    await page.keyboard.press("Control+a");
    await expect(page.locator("article.node.selected")).toHaveCount(2);
    await page.keyboard.press("Control+c");

    // Nieuwe sheet via modal.
    await page.locator("#new-workspace-button").click();
    const nameField = page.locator("#app-modal-fields input").first();
    await nameField.fill("Plak-test");
    await page.locator("#app-modal-confirm").click();
    await expect(page.locator("#workspace-title")).toContainText("Plak-test");
    await expect(page.locator("article.gate-nand")).toHaveCount(0);

    await page.keyboard.press("Control+v");
    await expect(page.locator("article.gate-nand")).toHaveCount(2);
    // De draad tussen de gekopieerde nodes moet meegekomen zijn.
    await expect(page.locator("#wire-layer [data-wire-id]")).toHaveCount(1);
  });

  test("Shift+slepen maakt een kaderselectie", async ({ page }) => {
    await placePart(page, "gate-nand");
    await placePart(page, "gate-and");

    // Trek het kader strak om beide nodes heen (nodes kunnen buiten de
    // initiële viewport staan, dus eerst in beeld scrollen).
    const first = page.locator("article.node").nth(0);
    await first.scrollIntoViewIfNeeded();
    const b1 = await page.locator("article.node").nth(0).boundingBox();
    const b2 = await page.locator("article.node").nth(1).boundingBox();
    const startX = Math.min(b1.x, b2.x) - 15;
    const startY = Math.min(b1.y, b2.y) - 15;
    const endX = Math.max(b1.x + b1.width, b2.x + b2.width) + 15;
    const endY = Math.max(b1.y + b1.height, b2.y + b2.height) + 15;

    await page.keyboard.down("Shift");
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up("Shift");

    await expect(page.locator("article.node.selected")).toHaveCount(2);
  });

  test("multi-selectie sleept als groep", async ({ page }) => {
    await placePart(page, "gate-nand");
    await placePart(page, "gate-and");
    await page.keyboard.press("Control+a");
    await expect(page.locator("article.node.selected")).toHaveCount(2);

    const positionsBefore = await page.$$eval("article.node", (els) =>
      els.map((el) => ({ left: el.style.left, top: el.style.top }))
    );

    const first = page.locator("article.gate-nand").first();
    const box = await first.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + 130, { steps: 8 });
    await page.mouse.up();

    const positionsAfter = await page.$$eval("article.node", (els) =>
      els.map((el) => ({ left: el.style.left, top: el.style.top }))
    );
    expect(positionsAfter[0]).not.toEqual(positionsBefore[0]);
    expect(positionsAfter[1]).not.toEqual(positionsBefore[1]);
  });
});
