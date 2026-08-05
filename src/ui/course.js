import { CURRICULUM, getOrderedLessonIds, isLessonUnlocked } from "../data/curriculum.js";
import { S, t } from "../i18n/index.js";
import { localizeChallenge, localizeCurriculumModule } from "../i18n/challenges.js";

export function createCourseRenderers(deps) {
  const {
    dom,
    state,
    CHALLENGES,
    escapeHtml,
    getLearner,
    openChallengeWorkspace,
    setAppView,
  } = deps;

  const challengesById = new Map(CHALLENGES.map((challenge) => [challenge.id, challenge]));

  function getNextOpenLessonId(learner) {
    const order = getOrderedLessonIds(CURRICULUM);
    return (
      order.find(
        (id) =>
          isLessonUnlocked(id, learner, challengesById.get(id)?.prerequisites) &&
          !(learner.completedChallengeIds || []).includes(id)
      ) || null
    );
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

  function renderCourse() {
    if (!dom.courseView) {
      return;
    }
    const learner = getLearner();
    const nextId = getNextOpenLessonId(learner);
    const nextChallenge = nextId ? challengesById.get(nextId) : null;
    const nextTitle = nextChallenge ? localizeChallenge(nextChallenge).title : null;
    const badges = Array.isArray(learner.badges) ? learner.badges : [];

    const modulesHtml = CURRICULUM.map((module) => {
      const localizedModule = localizeCurriculumModule(module);
      const { done, total, ratio } = moduleProgress(module, learner);
      const hasBadge = badges.includes(module.id);
      const firstOpenInModule = module.lessonIds.find(
        (id) =>
          isLessonUnlocked(id, learner, challengesById.get(id)?.prerequisites) &&
          !(learner.completedChallengeIds || []).includes(id)
      );
      const startId = firstOpenInModule || module.lessonIds[0];
      return `<article class="course-module-card ${hasBadge ? "has-badge" : ""}">
        ${renderProgressRing(ratio)}
        <div class="course-module-body">
          <div class="course-module-head">
            <h3>${escapeHtml(localizedModule.title)}</h3>
            ${hasBadge ? `<span class="course-badge" title="${escapeHtml(S.badgeEarned)}">★</span>` : ""}
          </div>
          <p class="course-module-copy">${escapeHtml(localizedModule.description)}</p>
          <p class="course-module-meta">${escapeHtml(t("courseLessonsCount", { n: `${done}/${total}` }))}</p>
          <button type="button" class="primary-button course-module-start" data-course-start="${escapeHtml(
            startId
          )}" ${startId ? "" : "disabled"}>
            ${done === total ? t("courseView") : done > 0 ? S.continue : S.start}
          </button>
        </div>
      </article>`;
    }).join("");

    dom.courseView.innerHTML = `
      <div class="course-hero">
        <p class="eyebrow">${escapeHtml(S.course)}</p>
        <h2>${escapeHtml(S.course)}</h2>
        <p class="course-lead">${escapeHtml(S.courseLead)}</p>
        <div class="course-hero-actions">
          <button type="button" class="primary-button" data-course-continue ${nextId ? "" : "disabled"}>
            ${nextTitle ? `${S.continue}: ${escapeHtml(nextTitle)}` : escapeHtml(S.courseEmptyDone)}
          </button>
          <button type="button" class="ghost-button" data-app-view="workspace">${escapeHtml(S.workshop)}</button>
        </div>
      </div>
      <div class="course-modules">${modulesHtml}</div>
    `;
  }

  function handleCourseClick(event) {
    const viewBtn = event.target.closest("[data-app-view]");
    if (viewBtn && typeof setAppView === "function") {
      setAppView(viewBtn.dataset.appView);
      return;
    }
    const continueBtn = event.target.closest("[data-course-continue]");
    if (continueBtn) {
      const nextId = getNextOpenLessonId(getLearner());
      if (nextId) {
        state.selectedChallengeId = nextId;
        if (typeof setAppView === "function") {
          setAppView("workspace");
        }
        openChallengeWorkspace(nextId);
      }
      return;
    }
    const startBtn = event.target.closest("[data-course-start]");
    if (startBtn) {
      const lessonId = startBtn.dataset.courseStart;
      if (lessonId) {
        state.selectedChallengeId = lessonId;
        if (typeof setAppView === "function") {
          setAppView("workspace");
        }
        openChallengeWorkspace(lessonId);
      }
    }
  }

  return { renderCourse, handleCourseClick, getNextOpenLessonId };
}
