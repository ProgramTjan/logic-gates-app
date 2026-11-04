import { CURRICULUM, getOrderedLessonIds, isLessonUnlocked } from "../data/curriculum.js";
import { S, t } from "../i18n/index.js";
import { localizeChallenge, localizeCurriculumModule } from "../i18n/challenges.js";

/**
 * Home view: the learning path. Owns the lesson overview (modules, per-module lesson list,
 * free-mode toggle) and the entry to free build. Lesson detail lives in the lesson panel.
 */
export function createCourseRenderers(deps) {
  const {
    dom,
    CHALLENGES,
    escapeHtml,
    getLearner,
    openLesson,
    setAppView,
    isSandboxUnlocked,
    setStatus,
    renderAll,
  } = deps;

  const challengesById = new Map(CHALLENGES.map((challenge) => [challenge.id, challenge]));
  const openModules = new Map();

  function isUnlocked(id, learner) {
    return isLessonUnlocked(id, learner, challengesById.get(id)?.prerequisites);
  }

  function getNextOpenLessonId(learner) {
    const order = getOrderedLessonIds(CURRICULUM);
    const completed = learner.completedChallengeIds || [];
    return order.find((id) => isUnlocked(id, learner) && !completed.includes(id)) || null;
  }

  function moduleProgress(module, learner) {
    const completed = new Set(learner.completedChallengeIds || []);
    const total = module.lessonIds.length;
    const done = module.lessonIds.filter((id) => completed.has(id)).length;
    return { done, total, ratio: total ? done / total : 0 };
  }

  function renderProgressRing(ratio) {
    const pct = Math.round(ratio * 100);
    const deg = Math.round(ratio * 360);
    return `<div class="course-ring" style="--progress:${deg}deg" aria-label="${pct}%">
      <span class="course-ring-label">${pct}%</span>
    </div>`;
  }

  function renderLessonList(module, learner, nextId) {
    const completed = new Set(learner.completedChallengeIds || []);
    return module.lessonIds
      .map((id, index) => {
        const challenge = challengesById.get(id);
        if (!challenge) {
          return "";
        }
        const title = localizeChallenge(challenge).title;
        const done = completed.has(id);
        const unlocked = isUnlocked(id, learner);
        const marker = done ? "✓" : unlocked ? String(index + 1) : "🔒";
        return `<li>
          <button type="button" class="course-lesson ${done ? "done" : ""} ${unlocked ? "" : "locked"} ${
            id === nextId ? "next" : ""
          }" data-course-lesson="${escapeHtml(id)}" ${unlocked ? "" : "disabled"}>
            <span class="course-lesson-marker">${marker}</span>
            <span class="course-lesson-title">${escapeHtml(title)}</span>
          </button>
        </li>`;
      })
      .join("");
  }

  function renderCourse() {
    if (!dom.courseView) {
      return;
    }
    const learner = getLearner();
    const nextId = getNextOpenLessonId(learner);
    const nextChallenge = nextId ? challengesById.get(nextId) : null;
    const nextTitle = nextChallenge ? localizeChallenge(nextChallenge).title : null;
    const badges = Array.isArray(learner.badges) ? learner.badges : [];
    const sandboxUnlocked = isSandboxUnlocked();

    const modulesHtml = CURRICULUM.map((module) => {
      const localizedModule = localizeCurriculumModule(module);
      const { done, total, ratio } = moduleProgress(module, learner);
      const hasBadge = badges.includes(module.id);
      const firstOpenInModule = module.lessonIds.find(
        (id) => isUnlocked(id, learner) && !(learner.completedChallengeIds || []).includes(id)
      );
      const anyUnlocked = module.lessonIds.some((id) => isUnlocked(id, learner));
      const startId = firstOpenInModule || (anyUnlocked ? module.lessonIds[0] : null);
      const isOpen = openModules.has(module.id)
        ? openModules.get(module.id)
        : module.lessonIds.includes(nextId);
      return `<article class="course-module-card ${hasBadge ? "has-badge" : ""} ${anyUnlocked ? "" : "locked"}" data-course-module="${escapeHtml(
        module.id
      )}">
        <div class="course-module-top">
          ${renderProgressRing(ratio)}
          <div class="course-module-body">
            <div class="course-module-head">
              <h3>${escapeHtml(localizedModule.title)}</h3>
              ${hasBadge ? `<span class="course-badge" title="${escapeHtml(S.badgeEarned)}">★</span>` : ""}
            </div>
            <p class="course-module-copy">${escapeHtml(localizedModule.description)}</p>
            <p class="course-module-meta">${escapeHtml(t("courseLessonsCount", { n: `${done}/${total}` }))}</p>
          </div>
        </div>
        ${
          startId
            ? `<button type="button" class="primary-button course-module-start" data-course-lesson="${escapeHtml(
                startId
              )}">${done === total ? t("courseView") : done > 0 ? S.continue : S.start}</button>`
            : `<p class="course-module-lock">🔒 ${escapeHtml(S.locked)}</p>`
        }
        <details class="course-lessons" data-course-module-lessons="${escapeHtml(module.id)}"${isOpen ? " open" : ""}>
          <summary>${escapeHtml(t("homeShowLessons"))}</summary>
          <ol class="course-lesson-list">${renderLessonList(module, learner, nextId)}</ol>
        </details>
      </article>`;
    }).join("");

    dom.courseView.innerHTML = `
      <div class="course-hero">
        <p class="eyebrow">${escapeHtml(t("homeEyebrow"))}</p>
        <h2>${escapeHtml(t("homeTitle"))}</h2>
        <p class="course-lead">${escapeHtml(t("homeLead"))}</p>
        <div class="course-hero-actions">
          <button type="button" class="primary-button course-continue" data-course-continue ${nextId ? "" : "disabled"}>
            ${nextTitle ? `${escapeHtml(S.continue)}: ${escapeHtml(nextTitle)}` : escapeHtml(S.courseEmptyDone)}
          </button>
        </div>
      </div>
      <div class="course-modules">${modulesHtml}</div>
      <article class="course-sandbox-card ${sandboxUnlocked ? "" : "locked"}">
        <div>
          <h3>${sandboxUnlocked ? "" : "🔒 "}${escapeHtml(t("homeSandboxTitle"))}</h3>
          <p class="course-module-copy">${escapeHtml(
            sandboxUnlocked ? t("homeSandboxCopy") : t("homeSandboxLocked")
          )}</p>
        </div>
        <button type="button" class="ghost-button" data-nav="sandbox" ${sandboxUnlocked ? "" : "disabled"}>${escapeHtml(
          t("homeSandboxOpen")
        )}</button>
      </article>
      <label class="challenge-free-mode course-free-mode">
        <input type="checkbox" data-toggle-free-mode ${learner.unlockedAll ? "checked" : ""} />
        <span>${escapeHtml(S.freeMode)}</span>
      </label>
    `;
  }

  function handleCourseClick(event) {
    const navBtn = event.target.closest("[data-nav]");
    if (navBtn) {
      setAppView(navBtn.dataset.nav);
      return;
    }
    if (event.target.closest("[data-course-continue]")) {
      const nextId = getNextOpenLessonId(getLearner());
      if (nextId) {
        openLesson(nextId);
      }
      return;
    }
    const lessonBtn = event.target.closest("[data-course-lesson]");
    if (lessonBtn && !lessonBtn.disabled && lessonBtn.dataset.courseLesson) {
      openLesson(lessonBtn.dataset.courseLesson);
    }
  }

  function handleCourseToggle(event) {
    const details = event.target.closest?.("[data-course-module-lessons]");
    if (!details) {
      return;
    }
    const id = details.dataset.courseModuleLessons;
    openModules.set(id, details.open);
  }

  function handleCourseChange(event) {
    const toggle = event.target.closest("[data-toggle-free-mode]");
    if (!toggle) {
      return;
    }
    const learner = getLearner();
    learner.unlockedAll = Boolean(toggle.checked);
    setStatus(learner.unlockedAll ? t("status.freeModeOn") : t("status.freeModeOff"));
    renderAll();
  }

  return { renderCourse, handleCourseClick, handleCourseChange, handleCourseToggle, getNextOpenLessonId };
}
