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

  function renderProgressBar(ratio) {
    return `<div class="course-bar" style="--p:${Math.round(ratio * 100)}%"><span></span></div>`;
  }

  function splitModuleTitle(title) {
    const match = /^(\d+)\.\s*(.+)$/.exec(title);
    return match ? { num: match[1], name: match[2] } : { num: "", name: title };
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
            ${id === nextId ? '<span class="course-lesson-arrow" aria-hidden="true">→</span>' : ""}
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
      const anyUnlocked = module.lessonIds.some((id) => isUnlocked(id, learner));
      const { num, name } = splitModuleTitle(localizedModule.title);
      const numHtml = `<span class="course-module-num">${escapeHtml(num)}</span>`;
      const cardOpen = `<article class="course-module-card ${hasBadge ? "has-badge" : ""} ${
        anyUnlocked ? "" : "locked"
      }" data-course-module="${escapeHtml(module.id)}">`;
      if (!anyUnlocked) {
        return `${cardOpen}
          <div class="course-module-row">
            ${numHtml}
            <span class="course-module-title">${escapeHtml(name)}</span>
            <span class="course-module-lock" aria-label="${escapeHtml(S.locked)}" title="${escapeHtml(
              S.locked
            )}">🔒</span>
          </div>
        </article>`;
      }
      const isOpen = openModules.has(module.id)
        ? openModules.get(module.id)
        : module.lessonIds.includes(nextId);
      return `${cardOpen}
        <details class="course-lessons" data-course-module-lessons="${escapeHtml(module.id)}"${isOpen ? " open" : ""}>
          <summary class="course-module-row" title="${escapeHtml(localizedModule.description)}">
            ${numHtml}
            <span class="course-module-title">${escapeHtml(name)}</span>
            ${hasBadge ? `<span class="course-badge" title="${escapeHtml(S.badgeEarned)}">★</span>` : ""}
            <span class="course-module-count">${done}/${total}</span>
            ${renderProgressBar(ratio)}
          </summary>
          <ol class="course-lesson-list">${renderLessonList(module, learner, nextId)}</ol>
        </details>
      </article>`;
    }).join("");

    const isNewcomer = !(learner.completedChallengeIds || []).length;
    const allLessonIds = getOrderedLessonIds(CURRICULUM);
    const completedSet = new Set(learner.completedChallengeIds || []);
    const totalLessons = allLessonIds.length;
    const doneLessons = allLessonIds.filter((id) => completedSet.has(id)).length;
    const totalDoneRatio = totalLessons ? doneLessons / totalLessons : 0;
    const nextModule = nextId ? CURRICULUM.find((module) => module.lessonIds.includes(nextId)) : null;
    const nextIndex = nextModule ? nextModule.lessonIds.indexOf(nextId) + 1 : 0;
    const nextDescription = nextChallenge ? localizeChallenge(nextChallenge).description : "";
    let heroEyebrow = t("homeEyebrow");
    let heroTitle = S.courseEmptyDone;
    let heroLead = "";
    let continueLabel = S.courseEmptyDone;
    if (isNewcomer) {
      heroEyebrow = t("homeWelcomeEyebrow");
      heroTitle = t("homeWelcomeTitle");
      heroLead = t("homeWelcomeLead");
      continueLabel = nextTitle ? t("homeWelcomeStart", { title: nextTitle }) : S.courseEmptyDone;
    } else if (nextTitle && nextModule) {
      heroEyebrow = t("homeHeroEyebrow", {
        module: localizeCurriculumModule(nextModule).title,
        n: nextIndex,
        total: nextModule.lessonIds.length,
      });
      heroTitle = nextTitle;
      heroLead = nextDescription || "";
      continueLabel = S.continue;
    }

    dom.courseView.innerHTML = `
      <div class="course-hero ${isNewcomer ? "is-welcome" : ""}">
        <p class="eyebrow">${escapeHtml(heroEyebrow)}</p>
        <h2>${escapeHtml(heroTitle)}</h2>
        ${heroLead ? `<p class="course-lead">${escapeHtml(heroLead)}</p>` : ""}
        <div class="course-total" role="group" aria-label="${escapeHtml(
          t("homeTotalProgress", { done: doneLessons, total: totalLessons })
        )}">
          ${renderProgressBar(totalDoneRatio)}
          <span class="course-total-label">${escapeHtml(
            t("homeTotalProgress", { done: doneLessons, total: totalLessons })
          )}</span>
        </div>
        <div class="course-hero-actions">
          <button type="button" class="primary-button course-continue" data-course-continue ${nextId ? "" : "disabled"}>
            ${escapeHtml(continueLabel)}
          </button>
        </div>
      </div>
      <div class="course-modules">${modulesHtml}</div>
      ${
        sandboxUnlocked
          ? `<article class="course-sandbox-card">
        <div>
          <h3>${escapeHtml(t("homeSandboxTitle"))}</h3>
          <p class="course-module-copy">${escapeHtml(t("homeSandboxCopy"))}</p>
        </div>
        <button type="button" class="ghost-button" data-nav="sandbox">${escapeHtml(t("homeSandboxOpen"))}</button>
      </article>`
          : `<article class="course-sandbox-card locked">
        <span class="course-sandbox-lock-title">🔒 ${escapeHtml(t("homeSandboxTitle"))}</span>
        <span class="course-module-copy">${escapeHtml(t("homeSandboxLocked"))}</span>
      </article>`
      }
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

  function handleFreeModeChange(event) {
    const toggle = event.target.closest("[data-toggle-free-mode]");
    if (!toggle) {
      return;
    }
    const learner = getLearner();
    learner.unlockedAll = Boolean(toggle.checked);
    setStatus(learner.unlockedAll ? t("status.freeModeOn") : t("status.freeModeOff"));
    renderAll();
  }

  return { renderCourse, handleCourseClick, handleFreeModeChange, handleCourseToggle, getNextOpenLessonId };
}
