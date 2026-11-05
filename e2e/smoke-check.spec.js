import { test, expect } from "@playwright/test";
import { enableFreeMode, openLessonFromHome, openSandbox, placePart, skipTutorial } from "./helpers.js";

/**
 * Smoke-checks voor de app-schil (home · les · vrij bouwen) en de leerapp-onderdelen
 * buiten de NAND-flow: vrije modus, eindles (ROM+Screen), klok-runner, ROM-inspector.
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

  test("verse gebruiker start op overzicht; canvas pas zichtbaar in een les", async ({ page }) => {
    await expect(page.locator("#app")).toHaveAttribute("data-view", "home");
    await expect(page.locator("#course-view")).toBeVisible();
    await expect(page.locator(".workspace-frame")).toBeHidden();
    expect(await page.locator("#course-view [data-course-module]").count()).toBeGreaterThanOrEqual(5);

    // Vrij bouwen is vergrendeld tot de eerste les af is.
    await expect(page.locator("#nav-sandbox")).toHaveClass(/locked/);
    await page.locator("#nav-sandbox").click({ force: true });
    await expect(page.locator("#app")).toHaveAttribute("data-view", "home");
    await expect(page.locator(".course-sandbox-card")).toHaveClass(/attention/);

    await enableFreeMode(page);
    await page.locator("#nav-sandbox").click();
    await expect(page.locator(".workspace-frame")).toBeVisible();
    await expect(page.locator("#course-view")).toBeHidden();
    await expect(page.locator("#sandbox-panel")).toBeVisible();
    await expect(page.locator("#lesson-panel")).toBeHidden();

    await page.locator('.appbar-tab[data-nav="home"]').click();
    await expect(page.locator("#course-view")).toBeVisible();
  });

  test("Start opent les 0 met coach en zonder klokknoppen", async ({ page }) => {
    await page.locator("[data-course-continue]").click();
    await expect(page.locator(".challenge-detail-card h3")).toContainText(/Light on|Licht aan/);
    await expect(page.locator("#app")).toHaveAttribute("data-view", "lesson");
    await expect(page.locator(".workspace-frame")).toBeVisible();
    await expect(page.locator("#lesson-panel")).toBeVisible();
    await expect(page.locator("[data-tutorial-coach]")).toBeVisible();
    await expect(page.locator("#sim-controls")).toBeHidden();
    await expect(page.locator("#export-button")).toBeHidden();
  });

  test("vrije modus unlockt lessen; computer-les opent met ROM en Screen", async ({ page }) => {
    await expect(page.locator('.course-lesson[data-course-lesson="computer"]')).toBeDisabled();
    await enableFreeMode(page);
    await openLessonFromHome(page, "computer");
    await skipTutorial(page);
    await expect(page.locator("article.node-rom, article.rom")).toHaveCount(1);
    await expect(page.locator("article.node-screen, article.screen")).toHaveCount(1);
    await expect(page.locator("#sim-controls")).toBeVisible();
  });

  test("klok-runner verschijnt bij een klok en start/stopt zonder fouten", async ({ page }) => {
    await openSandbox(page);
    await expect(page.locator("#sim-controls")).toBeHidden();
    await placePart(page, "clock");
    await expect(page.locator("#sim-controls")).toBeVisible();
    await placePart(page, "register");

    const playButton = page.locator("#clock-play-button");
    await playButton.click();
    await expect(playButton).toHaveClass(/is-running/);
    await page.waitForTimeout(1200);
    await playButton.click();
    await expect(playButton).not.toHaveClass(/is-running/);
  });

  test("lespaneel: stappen, hints, gefilterd palet en live controle", async ({ page }) => {
    await enableFreeMode(page);
    await openLessonFromHome(page, "not");
    await skipTutorial(page);

    const steps = page.locator(".lesson-flow [data-lesson-step]");
    await expect(steps.first()).toBeVisible();
    await expect(page.locator('[data-lesson-step="build"]')).toHaveClass(/is-current/);

    // Hintladder: één hint per klik.
    await page.locator("[data-reveal-hint]").click();
    await expect(page.locator(".hint-list li")).toHaveCount(1);

    // Palet: NAND wel, de NOT die je bouwt niet.
    await page.locator(".parts-dropdown summary").click();
    await expect(page.locator('#builtin-palette [data-part-type="gate-nand"]')).toBeVisible();
    await expect(page.locator('#builtin-palette [data-part-type="gate-not"]')).toHaveCount(0);
    await expect(page.locator('#builtin-palette [data-part-type="switch"]')).toHaveCount(0);
    await page.locator('#builtin-palette [data-part-type="gate-nand"]').click();

    // Live controle: nog geen score zolang OUT niet verbonden is.
    await expect(page.locator(".live-check .live-check-note")).toBeVisible();

    const inOut = page
      .locator("article.node")
      .filter({ has: page.locator(".node-label", { hasText: /^IN$/ }) })
      .locator('[data-pin-direction="output"]')
      .first();
    await inOut.click();
    await page.locator('article.gate-nand [data-pin-key="A"][data-pin-direction="input"]').click();
    await inOut.click();
    await page.locator('article.gate-nand [data-pin-key="B"][data-pin-direction="input"]').click();
    await page.locator('article.gate-nand [data-pin-key="OUT"][data-pin-direction="output"]').click();
    await page
      .locator("article.node-output-pin")
      .filter({ has: page.locator(".node-label", { hasText: /^OUT$/ }) })
      .locator('[data-pin-key="IN"][data-pin-direction="input"]')
      .click();

    await expect(page.locator(".live-check-summary")).toHaveClass(/ok/);
    await page.locator('[data-submit-challenge="not"]').click();
    await expect(page.locator('[data-lesson-step="check"]')).toHaveClass(/is-done/);
    await expect(page.locator(".lesson-unlocked-parts")).toContainText("NOT");
  });

  test("hulpmenu toont sneltoetsen; coach uitzetten in instellingen", async ({ page }) => {
    await page.locator("#help-menu summary").click();
    await expect(page.locator(".help-shortcuts")).toContainText("Ctrl+Z");
    await page.locator("#settings-menu summary").click();
    await expect(page.locator(".help-shortcuts")).toBeHidden();
    await page.locator("#coach-enabled-toggle").uncheck();
    await page.locator('.appbar-tab[data-nav="home"]').click();
    await page.locator("[data-course-continue]").click();
    await expect(page.locator("[data-tutorial-coach]")).toBeHidden();
  });

  test("taalschakelaar in het instellingenmenu verandert chrome-tekst", async ({ page }) => {
    const lessonsTab = page.locator('.appbar-tab[data-nav="home"]');
    await expect(lessonsTab).toContainText("Lessons");
    await page.locator("#settings-menu summary").click();
    await page.locator('[data-set-locale="nl"]').click();
    await expect(lessonsTab).toContainText("Lessen");
    await expect(page.locator("#nav-sandbox")).toContainText("Vrij bouwen");
    await page.locator('[data-set-locale="en"]').click();
    await expect(lessonsTab).toContainText("Lessons");
  });

  test("ROM-node inspector accepteert programma", async ({ page }) => {
    await openSandbox(page);
    await placePart(page, "rom");
    await page.locator("article.node-rom, article.rom").first().click();
    await expect(page.locator("#inspector-card")).toBeVisible();
    const programField = page.locator("#inspector textarea");
    await expect(programField).toBeVisible();
    await programField.fill("0000000000000101\n1110110000010000");
    await programField.dispatchEvent("input");
    await expect(page.locator("article.node-rom, article.rom").first()).toContainText(/2/);
  });
});
