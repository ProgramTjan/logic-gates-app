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

  test("les 0: eerste AND landt tussen de schakelaars en de lamp", async ({ page }) => {
    await page.locator("[data-course-continue]").click();
    await skipTutorial(page);
    await placePart(page, "gate-and");
    const left = async (locator) => (await locator.first().boundingBox()).x;
    const door = await left(page.locator("article.node").filter({ hasText: "DOOR" }));
    const and = await left(page.locator("article.gate-and"));
    const lamp = await left(page.locator("article.node").filter({ hasText: "LAMP" }));
    expect(door).toBeLessThan(and);
    expect(and).toBeLessThan(lamp);

    // Een tweede onderdeel overlapt niets.
    await placePart(page, "gate-and");
    const boxes = await page.locator("article.node").evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom }))
    );
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        expect(a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t).toBe(false);
      }
    }
  });

  test("les 0: draad slepen van uitgang naar ingang, met voorbeeldlijn", async ({ page }) => {
    await page.locator("[data-course-continue]").click();
    await skipTutorial(page);
    await placePart(page, "gate-and");

    const pinCenter = async (label, direction, index = 0) => {
      const box = await page
        .locator("article.node")
        .filter({ hasText: label })
        .first()
        .locator(`[data-pin-direction="${direction}"]`)
        .nth(index)
        .boundingBox();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const wires = page.locator("#wire-layer path.wire");
    const before = await wires.count();

    const from = await pinCenter("DOOR", "output");
    const to = await pinCenter("AND", "input", 0);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
    await expect(page.locator("#wire-layer .wire-preview")).toHaveCount(1);
    await expect(page.locator("#workspace-canvas")).toHaveClass(/is-wiring/);
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    await expect(wires).toHaveCount(before + 1);
    await expect(page.locator("#wire-layer .wire-preview")).toHaveCount(0);
    await expect(page.locator("#workspace-canvas")).not.toHaveClass(/is-wiring/);

    // Slepen en loslaten op leeg canvas annuleert zonder draad.
    const from2 = await pinCenter("ALARM", "output");
    await page.mouse.move(from2.x, from2.y);
    await page.mouse.down();
    await page.mouse.move(from2.x + 60, from2.y + 160, { steps: 6 });
    await page.mouse.up();
    await expect(wires).toHaveCount(before + 1);
    await expect(page.locator("#wire-layer .wire-preview")).toHaveCount(0);
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

  test("coach: ballon naast het lespaneel, niet over de lestekst", async ({ page }) => {
    await page.locator("[data-course-continue]").click();
    const coach = page.locator("[data-tutorial-coach]");
    await expect(coach).toBeVisible();
    await expect(coach).toHaveAttribute("data-arrow", "left");
    const panelBox = await page.locator("#lesson-panel").boundingBox();
    const coachBox = await coach.boundingBox();
    expect(coachBox.x).toBeGreaterThanOrEqual(panelBox.x + panelBox.width);
  });

  test("intro toont alleen de eerste theorie-alinea; de rest staat achter Meer uitleg", async ({ page }) => {
    await enableFreeMode(page);
    await openLessonFromHome(page, "xor");
    await skipTutorial(page);
    const intro = page.locator('[data-lesson-step="intro"]');
    await expect(intro.locator(".theory-paragraph")).toHaveCount(3);
    await expect(intro.locator(".theory-paragraph:visible")).toHaveCount(1);
    await expect(page.locator(".lesson-theory")).not.toHaveAttribute("open", "");
    await expect(page.getByText("NAND(A,B) gives helper H", { exact: false })).toBeHidden();
    await expect(page.locator(".lesson-interface")).toHaveCount(0);
    await page.locator(".lesson-theory summary").click();
    await expect(page.getByText("NAND(A,B) gives helper H", { exact: false })).toBeVisible();
  });

  test("lespaneel: stappen, hints, gefilterd palet en live controle", async ({ page }) => {
    await enableFreeMode(page);
    await openLessonFromHome(page, "not");
    await skipTutorial(page);

    const steps = page.locator(".lesson-flow [data-lesson-step]");
    await expect(steps.first()).toBeVisible();
    // Nieuwe les opent op Intro zonder vinkjes; "Aan de slag" vinkt Intro af en maakt Bouw actief.
    await expect(steps).toHaveCount(4);
    await expect(page.locator('[data-lesson-step="intro"]')).toHaveClass(/is-current/);
    await expect(page.locator(".lesson-flow .lesson-step.is-done")).toHaveCount(0);
    await page.locator("[data-intro-done]").click();
    await expect(page.locator('[data-lesson-step="intro"]')).toHaveClass(/is-done/);
    await expect(page.locator('[data-lesson-step="build"]')).toHaveClass(/is-current/);

    // Hintladder: één hint per klik.
    await page.locator("[data-reveal-hint]").click();
    await expect(page.locator(".hint-list li")).toHaveCount(1);

    // Palet: NAND wel, de NOT die je bouwt niet.
    await expect(page.locator('#parts-strip [data-strip-part="gate-nand"]')).toBeVisible();
    await expect(page.locator('#parts-strip [data-strip-part="gate-not"]')).toHaveCount(0);
    await expect(page.locator('#parts-strip [data-strip-part="switch"]')).toHaveCount(0);
    await page.locator('#parts-strip [data-strip-part="gate-nand"]').click();

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
    await expect(page.locator('[data-lesson-step="build"]')).toHaveClass(/is-done/);
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
