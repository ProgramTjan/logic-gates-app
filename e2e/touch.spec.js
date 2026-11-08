import { test, expect } from "@playwright/test";

/**
 * Touch-viewports (UX fase D): staande en liggende tablet, telefoon.
 * hasTouch + isMobile → (pointer: coarse): grote pins, onderdelenstrip, onderpaneel.
 */
async function freshStart(page) {
  page.on("pageerror", (err) => {
    throw new Error(`Page error: ${err.message}`);
  });
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
  await page.locator("[data-course-continue]").tap();
  await page.locator("[data-tutorial-skip]").tap();
}

async function noHorizontalOverflow(page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test.describe("Staande tablet (820×1180, touch)", () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

  test("les 0 bouwen met strip, grote pins en onderpaneel", async ({ page }) => {
    await freshStart(page);
    await noHorizontalOverflow(page);

    // Strip i.p.v. Parts-menu; hele les-schakeling in beeld.
    await expect(page.locator("#parts-strip")).toBeVisible();
    await expect(page.locator(".parts-dropdown")).toBeHidden();
    for (const label of ["DOOR", "ALARM", "LAMP"]) {
      await expect(page.locator("article.node").filter({ hasText: label }).first()).toBeInViewport();
    }

    await page.locator('#parts-strip [data-strip-part="gate-and"]').tap();
    const andGate = page.locator("article.gate-and");
    await expect(andGate).toBeInViewport();

    // Pins zijn groot genoeg voor een vinger.
    const pinBox = await andGate.locator('[data-pin-direction="input"]').first().boundingBox();
    expect(pinBox.height).toBeGreaterThanOrEqual(24);

    // Nieuwe node overlapt geen bestaande node.
    const boxes = await page.locator("article.node").evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom }))
    );
    const last = boxes[boxes.length - 1];
    for (const other of boxes.slice(0, -1)) {
      const overlap = last.l < other.r && last.r > other.l && last.t < other.b && last.b > other.t;
      expect(overlap).toBe(false);
    }

    // Onderpaneel: tikken vouwt op (met live-status + Controleer), nog eens tikken vouwt open.
    const panel = page.locator("#lesson-panel");
    await expect(panel).toHaveAttribute("data-sheet", "half");
    await page.locator("#lesson-panel-handle").tap();
    await expect(panel).toHaveAttribute("data-sheet", "peek");
    await expect(page.locator("[data-peek-check]")).toBeVisible();
    await expect(page.locator(".lesson-panel-body")).toBeHidden();
    await page.locator("#lesson-panel-handle").tap();
    await expect(panel).toHaveAttribute("data-sheet", "half");
  });
});

test.describe("Liggende tablet (1180×820, touch)", () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true });

  test("lespaneel links, geen onderpaneel; inspector ingeklapt", async ({ page }) => {
    await freshStart(page);
    await noHorizontalOverflow(page);
    await expect(page.locator("#lesson-panel-handle")).toBeHidden();
    const panelBox = await page.locator("#lesson-panel").boundingBox();
    const canvasBox = await page.locator("#workspace-canvas").boundingBox();
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(canvasBox.x);

    await page.locator(".parts-dropdown summary").tap();
    await page.locator('[data-part-type="gate-and"]').tap();
    await expect(page.locator("#inspector-card")).toHaveClass(/collapsed/);
  });
});

test.describe("Telefoon (390×844, touch)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("geen overflow; onderdeel plaatsen vouwt het lespaneel op", async ({ page }) => {
    await freshStart(page);
    await noHorizontalOverflow(page);
    await page.locator('#parts-strip [data-strip-part="gate-and"]').tap();
    await expect(page.locator("#lesson-panel")).toHaveAttribute("data-sheet", "peek");
    await expect(page.locator("article.gate-and")).toBeInViewport();
    await noHorizontalOverflow(page);
  });
});
