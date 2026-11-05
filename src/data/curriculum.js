/**
 * Leerpad: geordende modules met les-ids (challenge-ids).
 * Unlock: een les is beschikbaar als alle prerequisites voltooid zijn,
 * of als learner.unlockedAll (vrije modus) aan staat.
 */

/** First lesson of the path (lesson 0); completing it unlocks free build. */
export const INTRO_LESSON_ID = "intro-light";

export const CURRICULUM = [
  {
    id: "start",
    title: "0. Start",
    description: "Eerste casus: leer plaatsen, verbinden en testen.",
    lessonIds: ["intro-light"],
  },
  {
    id: "poorten",
    title: "1. Poorten",
    description: "Bouw de basispoorten vanaf NAND tot multiplexers.",
    lessonIds: [
      "nand",
      "not",
      "and",
      "or",
      "xor",
      "xor-nand-only",
      "mux",
      "dmux",
      "not16",
      "and16",
      "or16",
      "mux16",
      "or4way",
      "mux4way",
      "dmux4way",
      "or8way",
      "mux4way16",
      "mux8way16",
      "dmux8way",
    ],
  },
  {
    id: "rekenen",
    title: "2. Rekenen",
    description: "Half adder, full adder en multi-bit optellers.",
    lessonIds: ["half-adder", "full-adder", "add4", "inc4"],
  },
  {
    id: "geheugen",
    title: "3. Geheugen",
    description: "Registers en een programmateller.",
    lessonIds: ["dff", "register-chip", "register16", "pc"],
  },
  {
    id: "alu",
    title: "4. ALU",
    description: "16-bit rekenwerk en de HACK-ALU.",
    lessonIds: ["add16", "inc16", "alu", "instruction-decoder", "alu-with-registers"],
  },
  {
    id: "computer",
    title: "5. Computer-architectuur",
    description: "RAM, tellers en de CPU.",
    lessonIds: ["ram8", "mod4-counter", "ram64", "ram512", "ram4k", "ram16k", "cpu", "computer"],
  },
];

/** Flattened lesson order across all modules. */
export function getOrderedLessonIds(curriculum = CURRICULUM) {
  return curriculum.flatMap((module) => module.lessonIds);
}

/**
 * Prerequisites for a lesson: previous lesson in curriculum order.
 * First lesson has none.
 */
export function getPrerequisites(lessonId, curriculum = CURRICULUM) {
  const order = getOrderedLessonIds(curriculum);
  const index = order.indexOf(lessonId);
  if (index <= 0) {
    return [];
  }
  return [order[index - 1]];
}

/** Attach prerequisites onto each challenge (mutates in place). */
export function applyPrerequisitesToChallenges(challenges, curriculum = CURRICULUM) {
  for (const challenge of challenges) {
    challenge.prerequisites = getPrerequisites(challenge.id, curriculum);
  }
  return challenges;
}

/**
 * Whether a lesson may be started/submitted.
 * @param {string} lessonId
 * @param {{ completedChallengeIds?: string[], unlockedAll?: boolean }} learner
 * @param {string[]} [prerequisites] — defaults to curriculum order
 */
export function isLessonUnlocked(lessonId, learner, prerequisites) {
  if (learner && learner.unlockedAll) {
    return true;
  }
  const completed = new Set(
    Array.isArray(learner?.completedChallengeIds) ? learner.completedChallengeIds : []
  );
  const prereqs =
    prerequisites !== undefined ? prerequisites : getPrerequisites(lessonId);
  return prereqs.every((id) => completed.has(id));
}

/**
 * Derive completed lesson ids from verified chip definitions (migration / fixtures).
 * Pure: no DOM. evaluateChallengeResult(challenge, definitions) → { done }.
 */
export function deriveCompletedChallengeIds(challenges, userDefinitions, evaluateChallengeResult) {
  if (!Array.isArray(challenges) || typeof evaluateChallengeResult !== "function") {
    return [];
  }
  const definitions = Array.isArray(userDefinitions) ? userDefinitions : [];
  const completed = [];
  for (const challenge of challenges) {
    try {
      const result = evaluateChallengeResult(challenge, definitions);
      if (result && result.done) {
        completed.push(challenge.id);
      }
    } catch {
      // Skip broken evaluations during migration.
    }
  }
  return completed;
}

/** Title of the first unmet prerequisite, or null if unlocked / none. */
export function getRequiredLessonTitle(lessonId, learner, challengesById, curriculum = CURRICULUM) {
  if (isLessonUnlocked(lessonId, learner)) {
    return null;
  }
  const prereqs = getPrerequisites(lessonId, curriculum);
  const completed = new Set(
    Array.isArray(learner?.completedChallengeIds) ? learner.completedChallengeIds : []
  );
  const missing = prereqs.find((id) => !completed.has(id));
  if (!missing) {
    return null;
  }
  const challenge = challengesById?.get?.(missing) || challengesById?.[missing];
  return challenge?.title || missing;
}

export function createDefaultLearner() {
  return {
    completedChallengeIds: [],
    unlockedAll: false,
    quizAnswers: {},
    tutorialDismissed: false,
    coachEnabled: true,
    coachDismissed: {},
    completionOverlayDismissed: false,
    badges: [],
  };
}

function normalizeCoachDismissed(source) {
  const result = {};
  if (source?.coachDismissed && typeof source.coachDismissed === "object") {
    for (const [id, value] of Object.entries(source.coachDismissed)) {
      if (value) {
        result[String(id)] = true;
      }
    }
  }
  // Legacy: the old single walkthrough (lesson NAND) had one global "dismissed" flag.
  if (source?.tutorialDismissed) {
    result.nand = true;
  }
  return result;
}

function normalizeBadges(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return [...new Set(raw.map((id) => String(id)))];
}

/**
 * Badge per module waarvan alle lessen in completedChallengeIds zitten.
 */
export function computeModuleBadges(completedChallengeIds, curriculum = CURRICULUM) {
  const completed = new Set(
    (Array.isArray(completedChallengeIds) ? completedChallengeIds : []).map((id) => String(id))
  );
  return curriculum
    .filter((module) => module.lessonIds.length > 0 && module.lessonIds.every((id) => completed.has(id)))
    .map((module) => module.id);
}

export function syncLearnerBadges(learner, curriculum = CURRICULUM) {
  const base = learner && typeof learner === "object" ? learner : createDefaultLearner();
  const earned = computeModuleBadges(base.completedChallengeIds, curriculum);
  const prev = normalizeBadges(base.badges);
  const badges = [...new Set([...prev, ...earned])];
  return { ...base, badges };
}

/**
 * Normalize learner state. When completedChallengeIds was never stored,
 * optionally derive from verified chips via deps.deriveCompletedChallengeIds.
 */
export function normalizeLearner(rawLearner, deps = {}) {
  const source = rawLearner && typeof rawLearner === "object" ? rawLearner : null;
  const hadCompletionsField = Boolean(source && Array.isArray(source.completedChallengeIds));
  const unlockedAll = Boolean(source?.unlockedAll);

  let completedChallengeIds;
  if (hadCompletionsField) {
    completedChallengeIds = source.completedChallengeIds.map((id) => String(id));
  } else if (typeof deps.deriveCompletedChallengeIds === "function") {
    const derived = deps.deriveCompletedChallengeIds();
    completedChallengeIds = Array.isArray(derived) ? derived.map((id) => String(id)) : [];
  } else {
    completedChallengeIds = [];
  }

  // Lesson 0 was added later: learners who already made progress don't have to redo it.
  if (completedChallengeIds.length && !completedChallengeIds.includes(INTRO_LESSON_ID)) {
    completedChallengeIds.unshift(INTRO_LESSON_ID);
  }

  const quizAnswers = {};
  if (source?.quizAnswers && typeof source.quizAnswers === "object") {
    for (const [challengeId, value] of Object.entries(source.quizAnswers)) {
      if (value && typeof value === "object") {
        quizAnswers[String(challengeId)] = value;
      }
    }
  }

  const normalized = {
    completedChallengeIds,
    unlockedAll,
    quizAnswers,
    tutorialDismissed: Boolean(source?.tutorialDismissed),
    coachEnabled: source?.coachEnabled !== false,
    coachDismissed: normalizeCoachDismissed(source),
    completionOverlayDismissed: Boolean(source?.completionOverlayDismissed),
    badges: normalizeBadges(source?.badges),
  };
  return syncLearnerBadges(normalized);
}

/** Add challengeId to completed list (immutable-friendly). */
export function markChallengeCompleted(learner, challengeId) {
  const base = learner && typeof learner === "object" ? learner : createDefaultLearner();
  const ids = Array.isArray(base.completedChallengeIds) ? [...base.completedChallengeIds] : [];
  const id = String(challengeId);
  if (!ids.includes(id)) {
    ids.push(id);
  }
  return syncLearnerBadges({
    ...base,
    completedChallengeIds: ids,
    unlockedAll: Boolean(base.unlockedAll),
    quizAnswers: base.quizAnswers && typeof base.quizAnswers === "object" ? { ...base.quizAnswers } : {},
    tutorialDismissed: Boolean(base.tutorialDismissed),
    coachEnabled: base.coachEnabled !== false,
    coachDismissed: base.coachDismissed && typeof base.coachDismissed === "object" ? { ...base.coachDismissed } : {},
    completionOverlayDismissed: Boolean(base.completionOverlayDismissed),
    badges: normalizeBadges(base.badges),
  });
}

/** Persist a quiz answer for a challenge (by question index). */
export function recordQuizAnswer(learner, challengeId, questionIndex, optionIndex) {
  const base = learner && typeof learner === "object" ? learner : createDefaultLearner();
  const quizAnswers = {
    ...(base.quizAnswers && typeof base.quizAnswers === "object" ? base.quizAnswers : {}),
  };
  const key = String(challengeId);
  const prev = quizAnswers[key] && typeof quizAnswers[key] === "object" ? { ...quizAnswers[key] } : {};
  prev[String(questionIndex)] = Number(optionIndex);
  quizAnswers[key] = prev;
  return {
    ...base,
    completedChallengeIds: Array.isArray(base.completedChallengeIds)
      ? [...base.completedChallengeIds]
      : [],
    unlockedAll: Boolean(base.unlockedAll),
    quizAnswers,
    tutorialDismissed: Boolean(base.tutorialDismissed),
    completionOverlayDismissed: Boolean(base.completionOverlayDismissed),
    badges: normalizeBadges(base.badges),
  };
}
