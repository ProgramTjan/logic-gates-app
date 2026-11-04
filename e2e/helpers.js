import { expect } from "@playwright/test";

/** Zet vrije modus aan op het overzicht (home). */
export async function enableFreeMode(page) {
  const toggle = page.locator("#course-view [data-toggle-free-mode]");
  if (!(await toggle.isChecked())) {
    await toggle.click();
  }
  await expect(toggle).toBeChecked();
}

/** Opent Vrij bouwen (via vrije modus als het nog vergrendeld is). */
export async function openSandbox(page) {
  const nav = page.locator("#nav-sandbox");
  if (await nav.evaluate((el) => el.classList.contains("locked"))) {
    await enableFreeMode(page);
  }
  await nav.click();
  await expect(page.locator("#app")).toHaveAttribute("data-view", "sandbox");
}

/** Opent een les vanaf het overzicht (klapt de module open indien nodig). */
export async function openLessonFromHome(page, lessonId) {
  await page.locator('.appbar-tab[data-nav="home"]').click();
  const list = page
    .locator(".course-lessons")
    .filter({ has: page.locator(`.course-lesson[data-course-lesson="${lessonId}"]`) });
  if (!(await list.evaluate((el) => el.open))) {
    await list.locator("summary").click();
  }
  await list.locator(`.course-lesson[data-course-lesson="${lessonId}"]`).click();
  await expect(page.locator("#app")).toHaveAttribute("data-view", "lesson");
}

export async function skipTutorial(page) {
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
}

export async function placePart(page, type) {
  const dropdown = page.locator(".parts-dropdown");
  const open = await dropdown.evaluate((el) => el.open);
  if (!open) {
    await page.locator(".parts-dropdown summary").click();
  }
  await page.locator(`[data-part-type="${type}"]`).click();
}
